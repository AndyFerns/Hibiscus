// ============================================================================
// DOCUMENT INSPECTION (integrity cross-check for binary viewers)
// ============================================================================
//
// `inspect_document` gives the frontend viewers a trustworthy description of
// a binary file before they try to render it:
//
// - a SHA-256 of the bytes on disk, which the frontend re-computes over the
//   bytes it received to prove nothing was lost or mangled in transit, and
//   which is used as a cache key so unchanged files are never re-rendered;
// - the file's *actual* type from its magic bytes, so a `.pdf` that is really
//   an HTML error page (or a renamed zip) is reported instead of crashing the
//   viewer;
// - structural checks that catch the common kinds of corruption: truncated
//   PDFs (no %%EOF), zips with a missing central directory, and Office files
//   whose main XML part is missing or fails its CRC.
//
// The work runs on a blocking thread: hashing and zip validation are CPU and
// I/O bound and must not stall the async runtime.
// ============================================================================

use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use sha2::{Digest, Sha256};

use super::path::validate_path;
use crate::error::HibiscusError;

/// Result of inspecting a document on disk.
#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentReport {
    /// Size in bytes.
    pub size: u64,
    /// Last-modified time in milliseconds since the Unix epoch (0 if unknown).
    pub modified_ms: u64,
    /// Lower-case hex SHA-256 of the file contents.
    pub sha256: String,
    /// Detected content kind (pdf, docx, pptx, xlsx, zip, png, jpeg, gif,
    /// webp, bmp, ico, tiff, svg, html, empty, unknown).
    pub kind: String,
    /// Kind implied by the file extension.
    pub expected_kind: String,
    /// Whether the file looks intact and matches its extension.
    pub ok: bool,
    /// Human-readable explanation when `ok` is false.
    pub reason: Option<String>,
}

/// Maps an extension to the content kind we expect to find.
fn expected_kind_for(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "jpg" | "jpeg" => "jpeg".into(),
        "tif" | "tiff" => "tiff".into(),
        other => other.to_string(),
    }
}

/// Identifies the content of `bytes` from its leading magic bytes.
fn sniff_kind(bytes: &[u8]) -> &'static str {
    if bytes.is_empty() {
        return "empty";
    }
    let head = &bytes[..bytes.len().min(1024)];
    let starts = |sig: &[u8]| bytes.starts_with(sig);

    // PDF readers accept the header anywhere in the first 1 KB.
    if find(head, b"%PDF-").is_some() {
        return "pdf";
    }
    if starts(b"PK\x03\x04") || starts(b"PK\x05\x06") {
        return "zip";
    }
    if starts(b"\x89PNG\r\n\x1a\n") {
        return "png";
    }
    if starts(&[0xFF, 0xD8, 0xFF]) {
        return "jpeg";
    }
    if starts(b"GIF87a") || starts(b"GIF89a") {
        return "gif";
    }
    if bytes.len() >= 12 && starts(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return "webp";
    }
    if starts(b"BM") {
        return "bmp";
    }
    if starts(&[0x00, 0x00, 0x01, 0x00]) {
        return "ico";
    }
    if starts(b"II*\x00") || starts(b"MM\x00*") {
        return "tiff";
    }

    // Text-based formats: look past a BOM and leading whitespace.
    let text = String::from_utf8_lossy(&head[..head.len().min(1024)]).to_ascii_lowercase();
    let trimmed = text.trim_start_matches('\u{feff}').trim_start();
    if trimmed.contains("<svg") {
        return "svg";
    }
    if trimmed.starts_with("<!doctype html") || trimmed.starts_with("<html") {
        return "html";
    }
    "unknown"
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// Opens an OOXML package and classifies it, verifying the main part decodes.
fn inspect_zip(bytes: &[u8]) -> Result<&'static str, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| format!("The file is not a valid zip package ({e}). It may be truncated or corrupted."))?;

    let has = |archive: &zip::ZipArchive<Cursor<&[u8]>>, name: &str| archive.index_for_name(name).is_some();

    let (kind, main_part) = if has(&archive, "word/document.xml") {
        ("docx", "word/document.xml")
    } else if has(&archive, "ppt/presentation.xml") {
        ("pptx", "ppt/presentation.xml")
    } else if has(&archive, "xl/workbook.xml") {
        ("xlsx", "xl/workbook.xml")
    } else {
        return Ok("zip");
    };

    if !has(&archive, "[Content_Types].xml") {
        return Err("The Office package is missing [Content_Types].xml.".into());
    }

    // Reading the part to the end makes the zip crate verify its CRC-32.
    let mut part = archive
        .by_name(main_part)
        .map_err(|e| format!("Couldn't open {main_part}: {e}"))?;
    let mut sink = Vec::with_capacity(part.size().min(16 * 1024 * 1024) as usize);
    part.read_to_end(&mut sink)
        .map_err(|e| format!("{main_part} is damaged ({e})."))?;

    Ok(kind)
}

/// Core inspection logic over an in-memory buffer (unit-testable).
pub(crate) fn inspect_bytes(path: &Path, bytes: &[u8], modified_ms: u64) -> DocumentReport {
    let sha256 = {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        hasher
            .finalize()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    };
    let expected_kind = expected_kind_for(path);
    let mut kind = sniff_kind(bytes).to_string();
    let mut reason: Option<String> = None;

    match kind.as_str() {
        "empty" => reason = Some("The file is empty (0 bytes).".into()),
        "pdf" => {
            let tail = &bytes[bytes.len().saturating_sub(1024)..];
            if find(tail, b"%%EOF").is_none() {
                reason = Some(
                    "The PDF has no end-of-file marker, so it is probably truncated (an interrupted download or copy)."
                        .into(),
                );
            }
        }
        "zip" => match inspect_zip(bytes) {
            Ok(k) => kind = k.to_string(),
            Err(e) => reason = Some(e),
        },
        _ => {}
    }

    // Extension vs content mismatch, unless something more specific failed.
    if reason.is_none() && kind != expected_kind {
        let compatible = matches!(
            (expected_kind.as_str(), kind.as_str()),
            ("svg", "svg") | ("xml", "svg") | ("htm", "html")
        );
        if !compatible {
            reason = Some(match kind.as_str() {
                "html" => format!(
                    "This .{expected_kind} file actually contains a web page (HTML), often a saved error or login page."
                ),
                "unknown" => format!("This doesn't look like a .{expected_kind} file."),
                other => format!("This .{expected_kind} file actually contains {other} data."),
            });
        }
    }

    DocumentReport {
        size: bytes.len() as u64,
        modified_ms,
        sha256,
        kind,
        expected_kind,
        ok: reason.is_none(),
        reason,
    }
}

/// Inspects a document on disk: hash, detected type and integrity checks.
///
/// # Security
/// Path is validated to prevent directory traversal attacks.
#[tauri::command]
pub async fn inspect_document(path: String) -> Result<DocumentReport, HibiscusError> {
    let path = PathBuf::from(&path);
    validate_path(&path)?;

    if !path.exists() {
        return Err(HibiscusError::FileNotFound(path.to_string_lossy().into()));
    }
    if !path.is_file() {
        return Err(HibiscusError::InvalidPathType {
            path: path.to_string_lossy().into(),
            expected: "file".into(),
            actual: "directory".into(),
        });
    }

    tokio::task::spawn_blocking(move || {
        let modified_ms = std::fs::metadata(&path)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let bytes = std::fs::read(&path).map_err(|e| {
            HibiscusError::Io(format!("Failed to read '{}': {}", path.display(), e))
        })?;
        Ok(inspect_bytes(&path, &bytes, modified_ms))
    })
    .await
    .map_err(|e| HibiscusError::Io(format!("Inspection task failed: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn office_zip(main_part: &str, with_content_types: bool) -> Vec<u8> {
        let mut buf = Cursor::new(Vec::new());
        {
            let mut zw = zip::ZipWriter::new(&mut buf);
            let opts: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default();
            if with_content_types {
                zw.start_file("[Content_Types].xml", opts).unwrap();
                zw.write_all(b"<Types/>").unwrap();
            }
            zw.start_file(main_part, opts).unwrap();
            zw.write_all(b"<root>hello hello hello hello</root>").unwrap();
            zw.finish().unwrap();
        }
        buf.into_inner()
    }

    fn report(name: &str, bytes: &[u8]) -> DocumentReport {
        inspect_bytes(Path::new(name), bytes, 0)
    }

    #[test]
    fn valid_pdf_is_ok() {
        let r = report("a.pdf", b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
        assert!(r.ok, "{:?}", r.reason);
        assert_eq!(r.kind, "pdf");
        assert_eq!(r.sha256.len(), 64);
    }

    #[test]
    fn truncated_pdf_is_flagged() {
        let r = report("a.pdf", b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstream\x00\x01");
        assert!(!r.ok);
        assert!(r.reason.unwrap().contains("truncated"));
    }

    #[test]
    fn html_disguised_as_pdf_is_flagged() {
        let r = report("a.pdf", b"<!DOCTYPE html><html><body>403</body></html>");
        assert!(!r.ok);
        assert_eq!(r.kind, "html");
        assert!(r.reason.unwrap().contains("web page"));
    }

    #[test]
    fn empty_file_is_flagged() {
        let r = report("a.docx", b"");
        assert!(!r.ok);
        assert_eq!(r.kind, "empty");
    }

    #[test]
    fn valid_docx_and_pptx_are_ok() {
        let docx = report("a.docx", &office_zip("word/document.xml", true));
        assert!(docx.ok, "{:?}", docx.reason);
        assert_eq!(docx.kind, "docx");

        let pptx = report("a.pptx", &office_zip("ppt/presentation.xml", true));
        assert!(pptx.ok, "{:?}", pptx.reason);
        assert_eq!(pptx.kind, "pptx");
    }

    #[test]
    fn docx_saved_as_pptx_is_flagged() {
        let r = report("a.pptx", &office_zip("word/document.xml", true));
        assert!(!r.ok);
        assert_eq!(r.kind, "docx");
    }

    #[test]
    fn missing_content_types_is_flagged() {
        let r = report("a.docx", &office_zip("word/document.xml", false));
        assert!(!r.ok);
        assert!(r.reason.unwrap().contains("Content_Types"));
    }

    #[test]
    fn truncated_zip_is_flagged() {
        let full = office_zip("word/document.xml", true);
        let r = report("a.docx", &full[..full.len() / 2]);
        assert!(!r.ok);
        assert!(r.reason.unwrap().contains("zip"));
    }

    #[test]
    fn images_are_sniffed() {
        assert!(report("a.png", b"\x89PNG\r\n\x1a\n....").ok);
        assert!(report("a.jpg", &[0xFF, 0xD8, 0xFF, 0xE0]).ok);
        assert!(report("a.svg", b"<?xml version=\"1.0\"?><svg xmlns=\"x\"></svg>").ok);
        assert!(!report("a.png", &[0xFF, 0xD8, 0xFF, 0xE0]).ok);
    }

    #[tokio::test]
    async fn command_reads_from_disk() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("doc.pdf");
        std::fs::write(&file, b"%PDF-1.4\n%%EOF").unwrap();
        let r = inspect_document(file.to_string_lossy().into()).await.unwrap();
        assert!(r.ok);
        assert_eq!(r.size, 14);
        assert!(r.modified_ms > 0);
    }
}
