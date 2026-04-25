//! ============================================================================
//! Query API (Phase 1 + Phase 2)
//! ============================================================================
//!
//! Exposes Tauri commands for keyword search, chunk retrieval, and topic access.
//!
//! PHASE 1 COMMANDS (maintained for backward compatibility):
//! - `search_knowledge`: keyword -> matching chunk IDs + content.
//! - `get_chunk`: chunk_id -> full chunk data.
//! - `rebuild_knowledge_index`: triggers a full workspace scan.
//!
//! PHASE 2 COMMANDS:
//! - `search_chunks`: ranked keyword search with fuzzy and prefix matching.
//!   Returns results sorted by TF-IDF score with optional pagination.
//! - `get_topics`: returns the lightweight topic map.
//!
//! CACHING (Phase 2):
//! - An in-memory LRU cache (in KnowledgeState) is checked before disk access.
//! - Cache is invalidated on any file change event.
//!
//! RANKING ALGORITHM:
//!   final_score = keyword_score (from precomputed TF-IDF)
//!                 + 0.5 boost for exact keyword match
//!                 + 0.2 boost for prefix match
//!                 + 0.1 boost for fuzzy match (edit distance 1)
//!
//! PERFORMANCE:
//! - All scoring uses precomputed values from the scored index.
//! - No heavy computation at query time.
//! - Results are capped at top-K and support pagination.
//! - Early exit for large result sets.
//!
//! IMPORTANT: All commands are `async` so Tauri does not block the main
//! thread. CPU-bound work is done in `spawn_blocking`.
//! ============================================================================

use crate::knowledge::storage;
use crate::knowledge::types::{
    CachedQuery, RankedSearchResult, SearchResult, TopicMap,
};
use crate::knowledge::queue::KnowledgeState;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

/// Maximum number of recent queries to keep in the disk cache (Phase 1).
const MAX_CACHED_QUERIES: usize = 50;

/// Maximum number of results to consider before sorting (early exit bound).
/// Prevents scanning the entire index for very broad queries.
const MAX_CANDIDATE_RESULTS: usize = 500;

/// Score boost for exact keyword match (the query term appears verbatim).
const EXACT_MATCH_BOOST: f64 = 0.5;

/// Score boost for prefix match (a keyword starts with the query term).
const PREFIX_MATCH_BOOST: f64 = 0.2;

/// Score boost for fuzzy match (edit distance 1 from the query term).
const FUZZY_MATCH_BOOST: f64 = 0.1;

// ===========================================================================
// Phase 1 commands (unchanged interface, maintained for backward compat)
// ===========================================================================

/// Search the knowledge index for chunks matching a keyword.
///
/// The keyword is normalized (lowercased, trimmed) before lookup.
/// Results include the full chunk content so the frontend does not need
/// a second round-trip to fetch each chunk.
///
/// # Arguments
/// * `keyword` - The search term.
/// * `state` - Knowledge managed state (provides workspace root).
///
/// # Returns
/// A list of `SearchResult` values, or an error string.
#[tauri::command]
pub async fn search_knowledge(
    keyword: String,
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<Vec<SearchResult>, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    let normalized = keyword.trim().to_lowercase();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let ws = workspace_root.clone();
    let kw = normalized.clone();

    let result = tokio::task::spawn_blocking(move || {
        search_blocking(&ws, &kw)
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?;

    result
}

/// Blocking implementation of keyword search (Phase 1).
/// Runs inside `spawn_blocking` to avoid blocking the async runtime.
fn search_blocking(workspace_root: &str, keyword: &str) -> Result<Vec<SearchResult>, String> {
    // Check cache.
    let cached = storage::read_recent_queries(workspace_root);
    if let Some(entry) = cached.iter().find(|q| q.keyword == keyword) {
        let results = load_search_results(workspace_root, &entry.chunk_ids);
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // Cache miss or stale: look up the keyword index.
    let index = storage::read_keyword_index(workspace_root);
    let chunk_ids = match index.get(keyword) {
        Some(ids) => ids.clone(),
        None => return Ok(Vec::new()),
    };

    let results = load_search_results(workspace_root, &chunk_ids);

    // Update cache with new entry.
    let mut cached = cached;
    cached.retain(|q| q.keyword != keyword);
    cached.push(CachedQuery {
        keyword: keyword.to_string(),
        chunk_ids,
    });
    let _ = storage::write_recent_queries(workspace_root, &cached, MAX_CACHED_QUERIES);

    Ok(results)
}

/// Load chunks by ID and convert to SearchResult values.
/// Chunks that are missing or corrupt are silently skipped.
fn load_search_results(workspace_root: &str, chunk_ids: &[String]) -> Vec<SearchResult> {
    chunk_ids
        .iter()
        .filter_map(|id| {
            storage::read_chunk(workspace_root, id).map(|chunk| SearchResult {
                chunk_id: chunk.id,
                file: chunk.file,
                heading: chunk.heading,
                content: chunk.content,
                word_count: chunk.word_count,
            })
        })
        .collect()
}

/// Retrieve a single chunk by its ID.
#[tauri::command]
pub async fn get_chunk(
    chunk_id: String,
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<SearchResult, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    // Phase 2: check in-memory chunk cache first.
    {
        let mut cache = state.cache.lock().await;
        if let Some(json_str) = cache.chunk_cache.get(&chunk_id) {
            if let Ok(result) = serde_json::from_str::<SearchResult>(&json_str) {
                return Ok(result);
            }
        }
    }

    let id = chunk_id.clone();
    let ws = workspace_root.clone();

    let result = tokio::task::spawn_blocking(move || {
        storage::read_chunk(&ws, &id)
            .map(|chunk| SearchResult {
                chunk_id: chunk.id,
                file: chunk.file,
                heading: chunk.heading,
                content: chunk.content,
                word_count: chunk.word_count,
            })
            .ok_or_else(|| format!("Chunk not found: {}", chunk_id))
    })
    .await
    .map_err(|e| format!("Get chunk task failed: {}", e))??;

    // Cache the result for future lookups.
    if let Ok(json_str) = serde_json::to_string(&result) {
        let mut cache = state.cache.lock().await;
        cache.chunk_cache.insert(result.chunk_id.clone(), json_str);
    }

    Ok(result)
}

/// Trigger a full workspace scan and re-index.
#[tauri::command]
pub async fn rebuild_knowledge_index(
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<usize, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    // Invalidate all caches since the index is being rebuilt.
    {
        let mut cache = state.cache.lock().await;
        cache.invalidate_all();
    }

    let ws = workspace_root.clone();
    tokio::task::spawn_blocking(move || {
        crate::knowledge::queue::initial_scan(&ws)
    })
    .await
    .map_err(|e| format!("Rebuild task failed: {}", e))?
}

// ===========================================================================
// Phase 2 commands
// ===========================================================================

/// Ranked keyword search with fuzzy and prefix matching.
///
/// Uses the precomputed scored keyword index (TF-IDF) for instant ranking.
/// Supports pagination via `offset` and `limit` parameters.
///
/// # Ranking
/// For each query term, the engine:
/// 1. Checks for exact match in the scored index (full TF-IDF score).
/// 2. Scans for prefix matches (keywords starting with the query term).
/// 3. Scans for fuzzy matches (edit distance 1 from the query term).
///
/// Chunk scores are accumulated across all query terms. Results are sorted
/// by descending score and paginated.
///
/// # Arguments
/// * `query` - The search query string (may contain multiple words).
/// * `offset` - Number of results to skip (default 0).
/// * `limit` - Maximum number of results to return (default 20).
/// * `state` - Knowledge managed state.
///
/// # Returns
/// A list of `RankedSearchResult` values sorted by relevance score.
#[tauri::command]
pub async fn search_chunks(
    query: String,
    offset: Option<usize>,
    limit: Option<usize>,
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<Vec<RankedSearchResult>, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    let query_normalized = query.trim().to_lowercase();
    if query_normalized.is_empty() {
        return Ok(Vec::new());
    }

    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(20).min(100); // Cap at 100

    // Phase 2: check in-memory query cache first.
    let cache_key = format!("{}:{}:{}", query_normalized, offset, limit);
    {
        let mut cache = state.cache.lock().await;
        if let Some(cached_pairs) = cache.query_cache.get(&cache_key) {
            // Cache hit: load chunks by cached IDs and scores.
            let ws = workspace_root.clone();
            let pairs = cached_pairs.clone();
            let results = tokio::task::spawn_blocking(move || {
                load_ranked_results_from_pairs(&ws, &pairs)
            })
            .await
            .map_err(|e| format!("Cache load failed: {}", e))?;
            return Ok(results);
        }
    }

    let ws = workspace_root.clone();
    let qn = query_normalized.clone();

    let (ranked_pairs, results) = tokio::task::spawn_blocking(move || {
        ranked_search_blocking(&ws, &qn, offset, limit)
    })
    .await
    .map_err(|e| format!("Ranked search failed: {}", e))?;

    // Cache the result pairs (chunk_id, score) for future lookups.
    {
        let mut cache = state.cache.lock().await;
        cache.query_cache.insert(cache_key, ranked_pairs);
    }

    Ok(results)
}

/// Blocking implementation of ranked search.
/// Returns both the (chunk_id, score) pairs for caching and the full results.
fn ranked_search_blocking(
    workspace_root: &str,
    query: &str,
    offset: usize,
    limit: usize,
) -> (Vec<(String, f64)>, Vec<RankedSearchResult>) {
    let scored_index = storage::read_scored_index(workspace_root);

    // Split query into individual terms for multi-keyword search.
    let terms: Vec<&str> = query.split_ascii_whitespace().collect();
    if terms.is_empty() {
        return (Vec::new(), Vec::new());
    }

    // Accumulate scores per chunk across all query terms.
    let mut chunk_scores: HashMap<String, f64> = HashMap::new();

    for term in &terms {
        // 1. Exact match: full TF-IDF score + exact boost.
        if let Some(entry) = scored_index.get(*term) {
            for chunk_id in &entry.chunks {
                *chunk_scores.entry(chunk_id.clone()).or_insert(0.0)
                    += entry.score + EXACT_MATCH_BOOST;
            }
        }

        // 2. Prefix match: scan index for keywords starting with the term.
        // 3. Fuzzy match: scan index for keywords within edit distance 1.
        //
        // PERFORMANCE: This is a linear scan of the scored index keys.
        // For typical indices (10K-50K keywords), this completes in <1ms.
        // We skip the exact match key to avoid double-counting.
        let mut candidates_added = 0;
        for (keyword, entry) in &scored_index {
            if candidates_added >= MAX_CANDIDATE_RESULTS {
                break;
            }

            if keyword == *term {
                continue; // Already handled as exact match.
            }

            if keyword.starts_with(*term) {
                // Prefix match.
                for chunk_id in &entry.chunks {
                    *chunk_scores.entry(chunk_id.clone()).or_insert(0.0)
                        += entry.score * PREFIX_MATCH_BOOST;
                    candidates_added += 1;
                }
            } else if is_fuzzy_match(term, keyword) {
                // Fuzzy match (edit distance 1).
                for chunk_id in &entry.chunks {
                    *chunk_scores.entry(chunk_id.clone()).or_insert(0.0)
                        += entry.score * FUZZY_MATCH_BOOST;
                    candidates_added += 1;
                }
            }
        }
    }

    if chunk_scores.is_empty() {
        return (Vec::new(), Vec::new());
    }

    // Sort by score descending, then by chunk_id for determinism.
    let mut scored_chunks: Vec<(String, f64)> = chunk_scores.into_iter().collect();
    scored_chunks.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
    });

    // Apply pagination.
    let paginated: Vec<(String, f64)> = scored_chunks
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();

    // Load chunk data for the paginated results.
    let results = load_ranked_results_from_pairs(workspace_root, &paginated);

    (paginated, results)
}

/// Load chunks by (chunk_id, score) pairs and build RankedSearchResult values.
fn load_ranked_results_from_pairs(
    workspace_root: &str,
    pairs: &[(String, f64)],
) -> Vec<RankedSearchResult> {
    pairs
        .iter()
        .filter_map(|(chunk_id, score)| {
            storage::read_chunk(workspace_root, chunk_id).map(|chunk| RankedSearchResult {
                chunk_id: chunk.id,
                file: chunk.file,
                heading: chunk.heading,
                content: chunk.content,
                word_count: chunk.word_count,
                score: *score,
            })
        })
        .collect()
}

/// Lightweight fuzzy match: returns true if two strings differ by exactly
/// one character (insertion, deletion, or substitution).
///
/// This is a simplified Levenshtein distance check optimized for the common
/// case of short keywords (3-15 characters). It runs in O(max(m,n)) time
/// for strings of length m and n.
///
/// DESIGN: We only check edit distance = 1 because:
/// - Distance 0 = exact match (handled separately).
/// - Distance 1 = catches common typos (e.g., "rust" vs "rast").
/// - Distance 2+ = too many false positives for short keywords.
fn is_fuzzy_match(query: &str, keyword: &str) -> bool {
    let q_len = query.len();
    let k_len = keyword.len();

    // Edit distance > 1 is impossible if lengths differ by > 1.
    if q_len.abs_diff(k_len) > 1 {
        return false;
    }

    // Skip very short terms to avoid false positives.
    if q_len < 3 || k_len < 3 {
        return false;
    }

    let q_bytes = query.as_bytes();
    let k_bytes = keyword.as_bytes();

    if q_len == k_len {
        // Same length: check for exactly one substitution.
        let diffs = q_bytes.iter().zip(k_bytes.iter()).filter(|(a, b)| a != b).count();
        diffs == 1
    } else {
        // Different lengths: check for exactly one insertion/deletion.
        let (shorter, longer) = if q_len < k_len {
            (q_bytes, k_bytes)
        } else {
            (k_bytes, q_bytes)
        };

        let mut i = 0;
        let mut j = 0;
        let mut diffs = 0;

        while i < shorter.len() && j < longer.len() {
            if shorter[i] != longer[j] {
                diffs += 1;
                if diffs > 1 {
                    return false;
                }
                j += 1; // Skip one character in the longer string.
            } else {
                i += 1;
                j += 1;
            }
        }

        diffs <= 1
    }
}

/// Retrieve the topic map.
///
/// # Arguments
/// * `state` - Knowledge managed state.
///
/// # Returns
/// The topic map as a HashMap of topic name -> [chunk_ids].
#[tauri::command]
pub async fn get_topics(
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<TopicMap, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    let ws = workspace_root.clone();
    tokio::task::spawn_blocking(move || {
        Ok(storage::read_topics(&ws))
    })
    .await
    .map_err(|e| format!("Get topics task failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fuzzy_match_substitution() {
        assert!(is_fuzzy_match("rust", "rast"));   // one substitution
        assert!(!is_fuzzy_match("rust", "rust"));  // identical = distance 0, not fuzzy
        assert!(is_fuzzy_match("test", "tast"));   // one substitution
    }

    #[test]
    fn test_fuzzy_match_insertion() {
        assert!(is_fuzzy_match("rust", "rusts")); // one insertion
        assert!(is_fuzzy_match("test", "tests")); // one insertion
    }

    #[test]
    fn test_fuzzy_match_too_different() {
        assert!(!is_fuzzy_match("rust", "java")); // too many differences
        assert!(!is_fuzzy_match("ab", "cd"));     // too short
    }

    #[test]
    fn test_fuzzy_match_length_difference() {
        assert!(!is_fuzzy_match("rust", "rustlang")); // length diff > 1
    }
}
