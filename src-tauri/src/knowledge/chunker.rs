//! ============================================================================
//! Chunking Engine
//! ============================================================================
//!
//! Splits `ParsedDocument` sections into size-bounded `Chunk` values.
//!
//! RULES:
//! - Each chunk is 200-500 words (target range).
//! - Heading context is preserved: every chunk inherits the heading of the
//!   section it was extracted from.
//! - Chunks NEVER cross file boundaries (enforced by processing one
//!   `ParsedDocument` at a time).
//!
//! PERFORMANCE:
//! - Word counting uses `split_ascii_whitespace()` which is a single-pass
//!   iterator -- no regex, no allocation of intermediate vectors.
//! - Chunk IDs are computed via a truncated SHA-256 of (file_path + content).
//!   We use the `std` hasher as a lightweight stand-in since we do not need
//!   cryptographic strength; however we keep the interface compatible with
//!   swapping to a real SHA-256 later if needed.
//! ============================================================================

use crate::knowledge::types::{Chunk, ParsedDocument};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Minimum word count per chunk. Sections smaller than this are emitted as-is
/// rather than being merged (merging across headings would lose context).
const MIN_WORDS: usize = 200;

/// Maximum word count per chunk. Sections larger than this are split at word
/// boundaries to stay within the budget.
const MAX_WORDS: usize = 500;

/// Produce a deterministic chunk ID from a file path and content string.
///
/// Uses `DefaultHasher` (SipHash) for speed. The result is a 16-hex-char
/// string, which is collision-resistant enough for local indexing (the
/// file_map provides ground truth for lookups).
fn compute_chunk_id(file_path: &str, content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    content.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Produce a content hash for change detection.
/// Separate from chunk ID because this hashes content alone (no path).
fn compute_content_hash(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Split a `ParsedDocument` into a vector of `Chunk` values.
///
/// Each section is independently chunked:
/// - If the section has <= MAX_WORDS words, it becomes a single chunk.
/// - If the section exceeds MAX_WORDS, it is split at word boundaries into
///   sub-chunks of approximately MAX_WORDS words each. The last sub-chunk
///   may be smaller than MIN_WORDS if the remainder is small.
///
/// This function consumes the `ParsedDocument` to avoid unnecessary cloning.
pub fn chunk_document(doc: ParsedDocument) -> Vec<Chunk> {
    let file_path = doc.file_path;
    let mut chunks = Vec::new();

    for section in doc.sections {
        let content = section.content.trim();
        if content.is_empty() {
            continue;
        }

        let words: Vec<&str> = content.split_ascii_whitespace().collect();
        let total_words = words.len();

        if total_words <= MAX_WORDS {
            // Section fits in a single chunk -- emit directly.
            let text = words.join(" ");
            let id = compute_chunk_id(&file_path, &text);
            let hash = compute_content_hash(&text);
            chunks.push(Chunk {
                id,
                file: file_path.clone(),
                heading: section.heading.clone(),
                word_count: total_words,
                content: text,
                hash,
            });
        } else {
            // Section exceeds MAX_WORDS: split into sub-chunks.
            // We walk through the word list in MAX_WORDS-sized windows.
            let mut offset = 0;
            while offset < total_words {
                let end = std::cmp::min(offset + MAX_WORDS, total_words);
                // If the remaining tail is very small (< MIN_WORDS / 2),
                // absorb it into the current chunk to avoid tiny fragments.
                let adjusted_end = if end < total_words && (total_words - end) < MIN_WORDS / 2 {
                    total_words
                } else {
                    end
                };
                let sub_words = &words[offset..adjusted_end];
                let text = sub_words.join(" ");
                let id = compute_chunk_id(&file_path, &text);
                let hash = compute_content_hash(&text);
                chunks.push(Chunk {
                    id,
                    file: file_path.clone(),
                    heading: section.heading.clone(),
                    word_count: sub_words.len(),
                    content: text,
                    hash,
                });
                offset = adjusted_end;
            }
        }
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::types::Section;

    #[test]
    fn test_small_section_single_chunk() {
        let doc = ParsedDocument {
            file_path: "test.md".into(),
            sections: vec![Section {
                heading: Some("Intro".into()),
                content: "Hello world this is a test.".into(),
            }],
        };
        let chunks = chunk_document(doc);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].heading.as_deref(), Some("Intro"));
        assert_eq!(chunks[0].word_count, 6);
    }

    #[test]
    fn test_large_section_splits() {
        // Create a section with 600 words (exceeds MAX_WORDS).
        let words: String = (0..600).map(|i| format!("word{}", i)).collect::<Vec<_>>().join(" ");
        let doc = ParsedDocument {
            file_path: "test.md".into(),
            sections: vec![Section {
                heading: None,
                content: words,
            }],
        };
        let chunks = chunk_document(doc);
        assert!(chunks.len() >= 2);
        // All chunks should reference the same file.
        for c in &chunks {
            assert_eq!(c.file, "test.md");
        }
    }

    #[test]
    fn test_empty_section_skipped() {
        let doc = ParsedDocument {
            file_path: "test.md".into(),
            sections: vec![Section {
                heading: Some("Empty".into()),
                content: "   ".into(),
            }],
        };
        let chunks = chunk_document(doc);
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_deterministic_ids() {
        let doc1 = ParsedDocument {
            file_path: "a.md".into(),
            sections: vec![Section {
                heading: None,
                content: "same content".into(),
            }],
        };
        let doc2 = ParsedDocument {
            file_path: "a.md".into(),
            sections: vec![Section {
                heading: None,
                content: "same content".into(),
            }],
        };
        let c1 = chunk_document(doc1);
        let c2 = chunk_document(doc2);
        assert_eq!(c1[0].id, c2[0].id);
    }
}
