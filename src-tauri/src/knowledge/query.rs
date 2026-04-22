//! ============================================================================
//! Minimal Query API
//! ============================================================================
//!
//! Exposes Tauri commands for keyword search and chunk retrieval.
//!
//! DESIGN:
//! - `search_knowledge`: keyword -> matching chunk IDs + content.
//! - `get_chunk`: chunk_id -> full chunk data.
//! - `rebuild_knowledge_index`: triggers a full workspace scan using the
//!   same incremental logic (unchanged files are skipped).
//!
//! CACHING:
//! - Recent queries are cached in `recent_queries.json`. The cache is checked
//!   before hitting the keyword index. Cache entries are invalidated implicitly
//!   when the underlying index changes (the cache stores chunk IDs, so stale
//!   IDs will simply return no data on retrieval).
//!
//! IMPORTANT: These commands are `async` so Tauri does not block the main
//! thread. The actual work is done in `spawn_blocking` because it involves
//! synchronous disk I/O.
//! ============================================================================

use crate::knowledge::storage;
use crate::knowledge::types::{CachedQuery, SearchResult};
use crate::knowledge::queue::KnowledgeState;
use std::sync::Arc;
use tauri::State;

/// Maximum number of recent queries to keep in the cache.
const MAX_CACHED_QUERIES: usize = 50;

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

    // Check the recent queries cache first.
    let ws = workspace_root.clone();
    let kw = normalized.clone();

    let result = tokio::task::spawn_blocking(move || {
        search_blocking(&ws, &kw)
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?;

    result
}

/// Blocking implementation of keyword search.
/// Runs inside `spawn_blocking` to avoid blocking the async runtime.
fn search_blocking(workspace_root: &str, keyword: &str) -> Result<Vec<SearchResult>, String> {
    // Check cache.
    let cached = storage::read_recent_queries(workspace_root);
    if let Some(entry) = cached.iter().find(|q| q.keyword == keyword) {
        // Cache hit: load chunks by ID and return.
        let results = load_search_results(workspace_root, &entry.chunk_ids);
        if !results.is_empty() {
            return Ok(results);
        }
        // If all cached IDs are stale (no chunks found), fall through to
        // a fresh lookup.
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
    // Remove any existing entry for this keyword to avoid duplicates.
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
///
/// # Arguments
/// * `chunk_id` - The chunk ID to look up.
/// * `state` - Knowledge managed state.
///
/// # Returns
/// The chunk as a `SearchResult`, or an error if not found.
#[tauri::command]
pub async fn get_chunk(
    chunk_id: String,
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<SearchResult, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    let id = chunk_id.clone();
    let ws = workspace_root.clone();

    tokio::task::spawn_blocking(move || {
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
    .map_err(|e| format!("Get chunk task failed: {}", e))?
}

/// Trigger a full workspace scan and re-index.
///
/// This uses the same incremental logic as event-driven updates: files whose
/// content hash has not changed since the last index run are skipped entirely.
/// Only truly new or modified files are re-processed.
///
/// # Arguments
/// * `state` - Knowledge managed state.
///
/// # Returns
/// The number of files scanned (including skipped ones).
#[tauri::command]
pub async fn rebuild_knowledge_index(
    state: State<'_, Arc<KnowledgeState>>,
) -> Result<usize, String> {
    let workspace_root = state
        .get_workspace_root()
        .await
        .ok_or_else(|| "No workspace root set".to_string())?;

    let ws = workspace_root.clone();
    tokio::task::spawn_blocking(move || {
        crate::knowledge::queue::initial_scan(&ws)
    })
    .await
    .map_err(|e| format!("Rebuild task failed: {}", e))?
}
