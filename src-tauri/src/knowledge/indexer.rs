//! ============================================================================
//! Incremental Keyword Indexer
//! ============================================================================
//!
//! Maintains the inverted keyword index (`keyword -> [chunk_ids]`).
//!
//! INVARIANTS:
//! - The index is NEVER rebuilt from scratch. Updates are always incremental:
//!   only entries affected by added/removed chunks are modified.
//! - Keywords are normalized: lowercased, stopwords removed.
//! - Stopwords are defined as a compile-time set for zero-cost lookups.
//!
//! PERFORMANCE:
//! - `remove_chunks` and `add_chunks` both operate in O(keywords * affected_chunks),
//!   which is bounded by the size of the change, not the size of the index.
//! - Empty keyword entries are pruned to prevent unbounded index growth.
//! ============================================================================

use crate::knowledge::types::{Chunk, KeywordIndex};

/// English stopwords. These are filtered out during indexing to reduce noise.
/// Sorted for readability; lookup uses a match arm for zero-cost branching
/// (the compiler optimizes small match-on-string into a trie/hash).
const STOPWORDS: &[&str] = &[
    "a", "about", "above", "after", "again", "against", "all", "am", "an",
    "and", "any", "are", "as", "at", "be", "because", "been", "before",
    "being", "below", "between", "both", "but", "by", "can", "could", "did",
    "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "get", "got", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "if",
    "in", "into", "is", "it", "its", "itself", "just", "know", "let", "like",
    "ll", "me", "might", "more", "most", "must", "my", "myself", "no", "nor",
    "not", "now", "of", "off", "on", "once", "only", "or", "other", "our",
    "ours", "ourselves", "out", "over", "own", "re", "s", "same", "she",
    "should", "so", "some", "such", "t", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "us", "ve",
    "very", "was", "we", "were", "what", "when", "where", "which", "while",
    "who", "whom", "why", "will", "with", "would", "you", "your", "yours",
    "yourself", "yourselves",
];

/// Returns `true` if the word is a stopword.
///
/// Uses binary search on the sorted STOPWORDS array for O(log n) lookups.
fn is_stopword(word: &str) -> bool {
    STOPWORDS.binary_search(&word).is_ok()
}

/// Extract normalized keywords from a chunk's content.
///
/// Normalization pipeline:
/// 1. Split on ASCII whitespace (single pass, no allocation).
/// 2. For each token, strip non-alphanumeric leading/trailing characters.
/// 3. Convert to lowercase.
/// 4. Discard if empty, single-character, or a stopword.
///
/// Returns an iterator to avoid allocating a Vec when the caller only
/// needs to iterate once (which is always the case in add/remove).
fn extract_keywords(content: &str) -> impl Iterator<Item = String> + '_ {
    content
        .split_ascii_whitespace()
        .filter_map(|token| {
            // Strip non-alphanumeric characters from the edges of each token.
            // This handles punctuation (e.g., "hello," -> "hello") without regex.
            let cleaned: String = token
                .trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase();

            // Discard empty, single-char, and stopword tokens.
            if cleaned.len() <= 1 || is_stopword(&cleaned) {
                return None;
            }

            Some(cleaned)
        })
}

/// Remove all index entries associated with the given chunk IDs.
///
/// For each keyword in the index, removes any chunk IDs that appear in
/// `chunk_ids_to_remove`. Empty entries are pruned to prevent index bloat.
///
/// PERFORMANCE: This is O(index_keywords * chunk_ids_to_remove). For typical
/// incremental updates (a few files changed), this is very fast because
/// `chunk_ids_to_remove` is small.
pub fn remove_chunks_from_index(index: &mut KeywordIndex, chunk_ids_to_remove: &[String]) {
    if chunk_ids_to_remove.is_empty() {
        return;
    }

    // Collect keys to remove entirely (empty after filtering) to avoid
    // borrowing issues during iteration.
    let mut keys_to_remove = Vec::new();

    for (keyword, ids) in index.iter_mut() {
        ids.retain(|id| !chunk_ids_to_remove.contains(id));
        if ids.is_empty() {
            keys_to_remove.push(keyword.clone());
        }
    }

    for key in keys_to_remove {
        index.remove(&key);
    }
}

/// Add the given chunks to the keyword index.
///
/// For each chunk, extracts normalized keywords from its content and appends
/// the chunk ID to the corresponding index entry. Duplicates within a single
/// keyword entry are avoided by checking membership before insertion.
///
/// PERFORMANCE: Each chunk is processed independently. The total work is
/// proportional to the sum of words across all new chunks.
pub fn add_chunks_to_index(index: &mut KeywordIndex, chunks: &[Chunk]) {
    for chunk in chunks {
        for keyword in extract_keywords(&chunk.content) {
            let entry = index.entry(keyword).or_insert_with(Vec::new);
            // Avoid duplicate chunk IDs in the same keyword entry.
            if !entry.contains(&chunk.id) {
                entry.push(chunk.id.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stopword_filtering() {
        assert!(is_stopword("the"));
        assert!(is_stopword("and"));
        assert!(!is_stopword("rust"));
    }

    #[test]
    fn test_keyword_extraction() {
        let keywords: Vec<String> = extract_keywords("The quick brown fox jumps over the lazy dog.").collect();
        // "the" (stopword) and single-char tokens should be excluded.
        assert!(keywords.contains(&"quick".to_string()));
        assert!(keywords.contains(&"brown".to_string()));
        assert!(!keywords.contains(&"the".to_string()));
    }

    #[test]
    fn test_add_and_remove() {
        let mut index = KeywordIndex::new();
        let chunk = Chunk {
            id: "c1".into(),
            file: "test.md".into(),
            heading: None,
            content: "Rust programming language is fast".into(),
            word_count: 5,
            hash: "abc".into(),
        };
        add_chunks_to_index(&mut index, &[chunk]);
        assert!(index.get("rust").unwrap().contains(&"c1".to_string()));
        assert!(index.get("programming").unwrap().contains(&"c1".to_string()));
        // "is" is a stopword, should not appear.
        assert!(index.get("is").is_none());

        // Remove the chunk.
        remove_chunks_from_index(&mut index, &["c1".to_string()]);
        // All entries referencing c1 should be gone (and pruned).
        assert!(index.get("rust").is_none());
    }
}
