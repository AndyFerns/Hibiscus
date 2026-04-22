//! ============================================================================
//! Trait-Based Parser System
//! ============================================================================
//!
//! Provides a `Parser` trait and concrete implementations for Markdown and
//! plain-text files. The trait-based design allows adding new formats (e.g.
//! .org, .rst) without modifying existing code.
//!
//! FAILURE HANDLING:
//! - All parse errors are returned as `ParseError` -- the caller (worker pool)
//!   logs the error and skips the file. No panics.
//! - File reads use buffered I/O to keep memory usage proportional to file
//!   size, not the number of files being processed concurrently.
//!
//! PERFORMANCE:
//! - Markdown heading detection uses byte-level checks (starts_with '#')
//!   instead of regex, since we only need ATX-style headings.
//! - Paragraph splitting in the TXT parser uses a single pass over the string.
//! ============================================================================

use crate::knowledge::types::{ParseError, ParsedDocument, Section};
use std::io::{BufRead, BufReader};
use std::path::Path;

// ---------------------------------------------------------------------------
// Parser trait
// ---------------------------------------------------------------------------

/// Trait for file format parsers.
///
/// Each implementation handles a specific set of file extensions and
/// transforms raw file content into a sequence of `Section` values.
pub trait Parser {
    /// Returns `true` if this parser can handle files with the given extension.
    fn supports(&self, ext: &str) -> bool;

    /// Parse the file at `path` into a `ParsedDocument`.
    ///
    /// Implementations MUST:
    /// - Use buffered I/O (BufReader) for the file read.
    /// - Return `ParseError` on failure -- never panic.
    /// - Produce at least one section even for trivially small files.
    fn parse(&self, path: &str) -> Result<ParsedDocument, ParseError>;
}

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------

/// Parses Markdown files by splitting on ATX-style headings (`#`, `##`, etc.).
///
/// Each heading starts a new section whose `heading` field contains the
/// heading text (without the `#` prefix). Content before the first heading
/// goes into a section with `heading: None`.
pub struct MarkdownParser;

impl Parser for MarkdownParser {
    fn supports(&self, ext: &str) -> bool {
        ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown")
    }

    fn parse(&self, path: &str) -> Result<ParsedDocument, ParseError> {
        let file = std::fs::File::open(path)
            .map_err(|e| ParseError::IoError(format!("{}: {}", path, e)))?;
        let reader = BufReader::new(file);

        let mut sections: Vec<Section> = Vec::new();
        let mut current_heading: Option<String> = None;
        // Pre-allocate a reasonable buffer; most sections are under 4 KB.
        let mut current_content = String::with_capacity(4096);

        for line_result in reader.lines() {
            let line = line_result
                .map_err(|e| ParseError::IoError(format!("{}: {}", path, e)))?;

            // Detect ATX headings: lines starting with one or more '#' followed
            // by a space. This is a byte-level check -- no regex needed.
            if line.starts_with('#') {
                // Count the heading level (number of leading '#' characters).
                let level_end = line.bytes().take_while(|&b| b == b'#').count();
                // A valid ATX heading requires a space after the '#' sequence,
                // or the line is exactly the '#' characters (empty heading).
                let rest = &line[level_end..];
                if rest.is_empty() || rest.starts_with(' ') {
                    // Flush the current section before starting a new one.
                    let trimmed = current_content.trim().to_string();
                    if !trimmed.is_empty() || current_heading.is_some() {
                        sections.push(Section {
                            heading: current_heading.take(),
                            content: trimmed,
                        });
                    }
                    current_heading = Some(rest.trim().to_string());
                    current_content.clear();
                    continue;
                }
            }

            // Accumulate content lines, separated by newlines.
            if !current_content.is_empty() {
                current_content.push('\n');
            }
            current_content.push_str(&line);
        }

        // Flush the last section.
        let trimmed = current_content.trim().to_string();
        if !trimmed.is_empty() || current_heading.is_some() {
            sections.push(Section {
                heading: current_heading,
                content: trimmed,
            });
        }

        // Guarantee at least one section for non-empty files.
        if sections.is_empty() {
            sections.push(Section {
                heading: None,
                content: String::new(),
            });
        }

        Ok(ParsedDocument {
            file_path: path.to_string(),
            sections,
        })
    }
}

// ---------------------------------------------------------------------------
// Plain-text parser
// ---------------------------------------------------------------------------

/// Parses plain-text files by splitting on blank-line-separated paragraphs.
///
/// Each paragraph becomes a `Section` with `heading: None`. This is the
/// simplest reasonable chunking strategy for unstructured text.
pub struct TxtParser;

impl Parser for TxtParser {
    fn supports(&self, ext: &str) -> bool {
        ext.eq_ignore_ascii_case("txt")
    }

    fn parse(&self, path: &str) -> Result<ParsedDocument, ParseError> {
        let file = std::fs::File::open(path)
            .map_err(|e| ParseError::IoError(format!("{}: {}", path, e)))?;
        let reader = BufReader::new(file);

        let mut sections: Vec<Section> = Vec::new();
        let mut current_paragraph = String::with_capacity(4096);

        for line_result in reader.lines() {
            let line = line_result
                .map_err(|e| ParseError::IoError(format!("{}: {}", path, e)))?;

            if line.trim().is_empty() {
                // Blank line: flush the current paragraph as a section.
                let trimmed = current_paragraph.trim().to_string();
                if !trimmed.is_empty() {
                    sections.push(Section {
                        heading: None,
                        content: trimmed,
                    });
                    current_paragraph.clear();
                }
            } else {
                if !current_paragraph.is_empty() {
                    current_paragraph.push('\n');
                }
                current_paragraph.push_str(&line);
            }
        }

        // Flush the last paragraph.
        let trimmed = current_paragraph.trim().to_string();
        if !trimmed.is_empty() {
            sections.push(Section {
                heading: None,
                content: trimmed,
            });
        }

        if sections.is_empty() {
            sections.push(Section {
                heading: None,
                content: String::new(),
            });
        }

        Ok(ParsedDocument {
            file_path: path.to_string(),
            sections,
        })
    }
}

// ---------------------------------------------------------------------------
// Parser registry
// ---------------------------------------------------------------------------

/// Returns the appropriate parser for a given file path, or `None` if the
/// extension is not supported.
///
/// This is a lightweight dispatch function -- no dynamic allocation, no
/// trait objects. The caller gets a concrete reference.
pub fn parser_for_path(path: &str) -> Option<Box<dyn Parser>> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let md = MarkdownParser;
    let txt = TxtParser;

    if md.supports(ext) {
        Some(Box::new(MarkdownParser))
    } else if txt.supports(ext) {
        Some(Box::new(TxtParser))
    } else {
        None
    }
}
