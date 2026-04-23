//! ============================================================================
//! Core Data Types for the Knowledge Indexing System
//! ============================================================================
//!
//! All shared structs, enums, and type aliases live here so that every other
//! submodule can import from a single canonical location.
//!
//! DESIGN DECISIONS:
//! - Serde derive on everything that touches disk or crosses the Tauri FFI
//!   boundary. This keeps serialization zero-cost at the call site.
//! - Clone is derived sparingly; most pipeline stages consume values by move.
//! - `Chunk.id` is a deterministic hash of (file_path + content) so that
//!   the same logical chunk always gets the same ID, enabling incremental
//!   updates without UUID bookkeeping.
//! ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Watcher -> Queue
// ---------------------------------------------------------------------------

/// The type of filesystem event that triggered processing.
/// Maps directly to notify's event kinds, but simplified to the three
/// cases the pipeline actually cares about.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FileEventType {
    Create,
    Modify,
    Delete,
}

/// A single filesystem event destined for the processing queue.
/// Produced by the watcher integration layer, consumed by the worker pool.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FileEvent {
    pub path: String,
    pub event_type: FileEventType,
}

// ---------------------------------------------------------------------------
// Parser output
// ---------------------------------------------------------------------------

/// A logical section extracted from a source file.
/// For Markdown, this corresponds to a heading + its body.
/// For plain text, this corresponds to a paragraph block.
#[derive(Debug, Clone)]
pub struct Section {
    /// The heading text, if one was found (e.g., "## Introduction" -> "Introduction").
    pub heading: Option<String>,
    /// The body content of this section.
    pub content: String,
}

/// The result of parsing a single file.
/// Contains the original path (for provenance) and the extracted sections.
#[derive(Debug)]
pub struct ParsedDocument {
    pub file_path: String,
    pub sections: Vec<Section>,
}

// ---------------------------------------------------------------------------
// Chunking output / storage schema
// ---------------------------------------------------------------------------

/// A single indexed chunk. This is the atomic unit of storage and retrieval.
///
/// Each chunk is persisted as an individual JSON file under
/// `.hibiscus/knowledge/chunks/<id>.json`.
///
/// PERFORMANCE NOTE: The `id` field is computed as `sha256(file_path + content)`
/// truncated to 16 hex characters. This is NOT cryptographic -- it is purely
/// a content-addressable key for deduplication.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    /// Deterministic content-addressable ID: hash(file_path + content).
    pub id: String,
    /// Absolute path of the source file this chunk was extracted from.
    pub file: String,
    /// The section heading under which this chunk falls, if any.
    pub heading: Option<String>,
    /// The chunk text content.
    pub content: String,
    /// Number of whitespace-delimited words in `content`.
    pub word_count: usize,
    /// SHA-256 hex digest of `content` alone, used for change detection.
    pub hash: String,
}

// ---------------------------------------------------------------------------
// File map: file -> [chunk_ids]
// ---------------------------------------------------------------------------

/// Maps each indexed file path to the list of chunk IDs that were generated
/// from it. Used during incremental updates to remove stale chunks when a
/// file is modified or deleted.
///
/// Persisted at `.hibiscus/knowledge/files/file_map.json`.
pub type FileMap = HashMap<String, Vec<String>>;

// ---------------------------------------------------------------------------
// Keyword index: keyword -> [chunk_ids]
// ---------------------------------------------------------------------------

/// Inverted index mapping normalized keywords to the set of chunk IDs that
/// contain them. Persisted at `.hibiscus/knowledge/index/keyword_index.json`.
///
/// NORMALIZATION: keywords are lowercased and stopwords are excluded.
/// Updates are incremental -- only affected entries are touched.
pub type KeywordIndex = HashMap<String, Vec<String>>;

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/// Top-level metadata about the knowledge store.
/// Persisted at `.hibiscus/knowledge/manifest.json`.
///
/// This is intentionally minimal for Phase 1. Future phases can extend it
/// with schema version, last-full-rebuild timestamp, statistics, etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    /// Schema version for forward-compatibility checks.
    pub version: u32,
    /// Total number of indexed files.
    pub file_count: usize,
    /// Total number of chunks across all files.
    pub chunk_count: usize,
    /// ISO-8601 timestamp of the last indexing run.
    pub last_indexed: String,
}

impl Default for Manifest {
    fn default() -> Self {
        Self {
            version: 1,
            file_count: 0,
            chunk_count: 0,
            last_indexed: String::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

/// A single search result returned by the query API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub chunk_id: String,
    pub file: String,
    pub heading: Option<String>,
    pub content: String,
    pub word_count: usize,
}

/// Cached query result for the lightweight recent-queries cache.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedQuery {
    pub keyword: String,
    pub chunk_ids: Vec<String>,
}

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

/// Errors that can occur during file parsing.
/// These are recoverable: the pipeline logs and skips the file.
#[derive(Debug)]
pub enum ParseError {
    /// The file could not be read from disk.
    IoError(String),
    /// The file extension is not supported by any registered parser.
    UnsupportedFormat(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::IoError(msg) => write!(f, "IO error: {}", msg),
            ParseError::UnsupportedFormat(ext) => write!(f, "Unsupported format: {}", ext),
        }
    }
}

// ===========================================================================
// Phase 2 types
// ===========================================================================

// ---------------------------------------------------------------------------
// Scored keyword index (TF-IDF light)
// ---------------------------------------------------------------------------

/// A single entry in the scored keyword index.
/// Stores precomputed relevance scores so that query-time ranking is free.
///
/// SCORING: The `score` field is a lightweight TF-IDF approximation:
///   score = log(1 + term_frequency) / log(total_chunks)
/// Computed once during indexing. Never recomputed at query time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredKeywordEntry {
    /// Chunk IDs that contain this keyword.
    pub chunks: Vec<String>,
    /// Precomputed relevance score for this keyword.
    /// Higher scores indicate more discriminating (rare, meaningful) terms.
    pub score: f64,
}

/// The scored inverted index mapping keywords to chunk IDs with precomputed
/// TF-IDF scores. Persisted at `.hibiscus/knowledge/index/scored_index.json`.
///
/// This replaces the Phase 1 `KeywordIndex` for query purposes but both
/// are maintained during indexing for backward compatibility.
pub type ScoredKeywordIndex = HashMap<String, ScoredKeywordEntry>;

// ---------------------------------------------------------------------------
// Topic grouping
// ---------------------------------------------------------------------------

/// Maps topic names (derived from chunk headings) to the chunk IDs that
/// belong to that topic. Persisted at `.hibiscus/knowledge/topics.json`.
///
/// DETERMINISM: Grouping is based on normalized heading text and keyword
/// overlap. Same input always produces the same output (no randomness).
pub type TopicMap = HashMap<String, Vec<String>>;

// ---------------------------------------------------------------------------
// Ranked search results (Phase 2 query output)
// ---------------------------------------------------------------------------

/// A search result enriched with a relevance score for ranked display.
/// Returned by the Phase 2 `search_chunks` command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedSearchResult {
    pub chunk_id: String,
    pub file: String,
    pub heading: Option<String>,
    pub content: String,
    pub word_count: usize,
    /// Composite relevance score. Higher is better.
    /// Incorporates TF-IDF score, exact match boost, and prefix match boost.
    pub score: f64,
}

/// Query parameters for the Phase 2 search_chunks command.
/// Supports pagination via `offset` and `limit`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    /// The search term (may contain multiple words, handled as individual keywords).
    pub query: String,
    /// Number of results to skip (for pagination). Defaults to 0.
    #[serde(default)]
    pub offset: usize,
    /// Maximum number of results to return. Defaults to 20.
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_limit() -> usize {
    20
}

// ---------------------------------------------------------------------------
// LRU cache key (Phase 2)
// ---------------------------------------------------------------------------

/// Maximum number of chunk references a single keyword can hold in the
/// scored index. Prevents a single ultra-common word from bloating the index.
pub const MAX_CHUNKS_PER_KEYWORD: usize = 200;

/// File size threshold for deferred parsing (10 MB).
/// Files larger than this are logged and skipped to prevent memory spikes.
pub const LARGE_FILE_THRESHOLD: u64 = 10 * 1024 * 1024;
