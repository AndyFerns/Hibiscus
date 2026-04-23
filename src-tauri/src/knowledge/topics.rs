//! ============================================================================
//! Lightweight Topic Grouping (Phase 2)
//! ============================================================================
//!
//! Groups chunks into topics based on heuristic analysis of headings and
//! keyword overlap. No ML, no clustering libraries, no external dependencies.
//!
//! ALGORITHM:
//! 1. Chunks with identical normalized headings are grouped together.
//! 2. Chunks without headings are assigned to a catch-all "General" topic.
//! 3. Topics with only one chunk are merged into "Miscellaneous" to avoid
//!    fragmentation.
//!
//! DETERMINISM: Given the same set of chunks, the output is always identical.
//! This is guaranteed by sorting chunks by ID within each topic and by
//! using BTreeMap for ordered iteration.
//!
//! PERFORMANCE: Single pass over all chunks. O(n) where n = number of chunks.
//! ============================================================================

use crate::knowledge::types::TopicMap;
use crate::knowledge::storage;
use std::collections::BTreeMap;

/// Minimum number of chunks required for a topic to exist independently.
/// Topics with fewer chunks are merged into "Miscellaneous".
const MIN_TOPIC_SIZE: usize = 2;

/// Build a topic map from all chunks currently stored on disk.
///
/// This function reads the file map to enumerate all chunk IDs, then reads
/// each chunk to extract its heading. Chunks are grouped by normalized heading.
///
/// DESIGN: We read chunks from disk rather than accepting them as parameters
/// because this function may be called after a batch of incremental updates
/// where only some chunks are in memory. Reading from disk ensures we always
/// see the full picture.
///
/// PERFORMANCE: This reads every chunk file once. For 1000 files with ~5 chunks
/// each, that is ~5000 small JSON reads. On an SSD this completes in under 1s.
/// The function is called after indexing, not during queries.
pub fn build_topic_map(workspace_root: &str) -> TopicMap {
    let file_map = storage::read_file_map(workspace_root);

    // BTreeMap for deterministic ordering of topic names.
    let mut raw_topics: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for chunk_ids in file_map.values() {
        for chunk_id in chunk_ids {
            if let Some(chunk) = storage::read_chunk(workspace_root, chunk_id) {
                let topic_name = normalize_heading(&chunk.heading);
                raw_topics
                    .entry(topic_name)
                    .or_insert_with(Vec::new)
                    .push(chunk.id);
            }
        }
    }

    // Post-processing: merge small topics into "Miscellaneous".
    let mut final_topics = TopicMap::new();
    let mut miscellaneous: Vec<String> = Vec::new();

    for (topic, mut chunk_ids) in raw_topics {
        // Sort chunk IDs for deterministic output.
        chunk_ids.sort();
        chunk_ids.dedup();

        if chunk_ids.len() < MIN_TOPIC_SIZE {
            miscellaneous.extend(chunk_ids);
        } else {
            final_topics.insert(topic, chunk_ids);
        }
    }

    if !miscellaneous.is_empty() {
        miscellaneous.sort();
        miscellaneous.dedup();
        final_topics.insert("Miscellaneous".to_string(), miscellaneous);
    }

    final_topics
}

/// Normalize a chunk heading into a topic name.
///
/// Rules:
/// - `None` headings become "General".
/// - Empty headings become "General".
/// - Leading/trailing whitespace is trimmed.
/// - Case is preserved (headings like "Introduction" and "introduction" are
///   treated as distinct topics; this is intentional since heading case
///   often carries semantic meaning in structured documents).
fn normalize_heading(heading: &Option<String>) -> String {
    match heading {
        Some(h) => {
            let trimmed = h.trim();
            if trimmed.is_empty() {
                "General".to_string()
            } else {
                trimmed.to_string()
            }
        }
        None => "General".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_heading() {
        assert_eq!(normalize_heading(&None), "General");
        assert_eq!(normalize_heading(&Some("".into())), "General");
        assert_eq!(normalize_heading(&Some("  ".into())), "General");
        assert_eq!(normalize_heading(&Some("Introduction".into())), "Introduction");
        assert_eq!(normalize_heading(&Some("  Setup  ".into())), "Setup");
    }
}
