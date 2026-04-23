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

use crate::knowledge::types::{Chunk, KeywordIndex, ScoredKeywordEntry, ScoredKeywordIndex,
                                MAX_CHUNKS_PER_KEYWORD};

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

// ===========================================================================
// Phase 2: TF-IDF scored index
// ===========================================================================

/// Rebuild the scored keyword index from the existing Phase 1 keyword index.
///
/// This function is called as a post-indexing step after the Phase 1 index
/// has been updated. It computes a lightweight TF-IDF score for each keyword:
///
///   score = log(1 + tf) * log(total_chunks / df)
///
/// Where:
///   - tf  = term frequency (number of chunks containing this keyword)
///   - df  = document frequency (same as tf for our inverted index)
///   - total_chunks = total number of chunks in the index
///
/// DESIGN DECISIONS:
/// - Scores are precomputed and stored. Query time does zero math.
/// - Very common words (appearing in >50% of chunks) are discarded to
///   keep the scored index lean and prevent noisy results.
/// - Each keyword entry is capped at MAX_CHUNKS_PER_KEYWORD references
///   to bound memory usage for ultra-common terms that survive filtering.
/// - The output is a new `ScoredKeywordIndex` that lives alongside the
///   Phase 1 `KeywordIndex`. Phase 1 is still maintained for backward compat.
pub fn rebuild_scored_index(
    keyword_index: &KeywordIndex,
    total_chunks: usize,
) -> ScoredKeywordIndex {
    let total = if total_chunks == 0 { 1 } else { total_chunks };
    let half_total = total / 2;

    let mut scored = ScoredKeywordIndex::new();

    for (keyword, chunk_ids) in keyword_index {
        let df = chunk_ids.len();

        // Discard ultra-common words (appearing in >50% of all chunks).
        // These provide no discriminating power for search.
        if df > half_total && total > 10 {
            continue;
        }

        // TF-IDF light: log(1 + tf) * log(total / df)
        // Both factors are > 0 when df > 0 and total > 0.
        let tf = df as f64;
        let score = (1.0 + tf).ln() * (total as f64 / df as f64).ln();

        // Cap the number of chunk references to prevent bloat.
        let capped_ids = if chunk_ids.len() > MAX_CHUNKS_PER_KEYWORD {
            chunk_ids[..MAX_CHUNKS_PER_KEYWORD].to_vec()
        } else {
            chunk_ids.clone()
        };

        scored.insert(
            keyword.clone(),
            ScoredKeywordEntry {
                chunks: capped_ids,
                score,
            },
        );
    }

    scored
}

/// Remove chunk IDs from the scored keyword index.
/// Mirrors `remove_chunks_from_index` for the scored variant.
pub fn remove_chunks_from_scored_index(
    index: &mut ScoredKeywordIndex,
    chunk_ids_to_remove: &[String],
) {
    if chunk_ids_to_remove.is_empty() {
        return;
    }

    let mut keys_to_remove = Vec::new();

    for (keyword, entry) in index.iter_mut() {
        entry.chunks.retain(|id| !chunk_ids_to_remove.contains(id));
        if entry.chunks.is_empty() {
            keys_to_remove.push(keyword.clone());
        }
    }

    for key in keys_to_remove {
        index.remove(&key);
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

    #[test]
    fn test_scored_index_basic() {
        let mut index = KeywordIndex::new();
        let chunk1 = Chunk {
            id: "c1".into(),
            file: "a.md".into(),
            heading: None,
            content: "Rust programming language".into(),
            word_count: 3,
            hash: "h1".into(),
        };
        let chunk2 = Chunk {
            id: "c2".into(),
            file: "b.md".into(),
            heading: None,
            content: "Rust systems programming".into(),
            word_count: 3,
            hash: "h2".into(),
        };
        add_chunks_to_index(&mut index, &[chunk1, chunk2]);
        let scored = rebuild_scored_index(&index, 2);

        // "rust" appears in both chunks -- should have a lower score than
        // "language" which appears in only one.
        let rust_score = scored.get("rust").map(|e| e.score).unwrap_or(0.0);
        let lang_score = scored.get("language").map(|e| e.score).unwrap_or(0.0);
        assert!(lang_score > rust_score, "Rarer terms should score higher");
    }
}

