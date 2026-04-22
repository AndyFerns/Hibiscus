//! ============================================================================
//! Hibiscus Knowledge Indexing System (Phase 1)
//! ============================================================================
//!
//! A local-first, incremental knowledge indexing pipeline that watches
//! workspace files (.md, .txt), parses them into chunks, builds a keyword
//! index, and exposes a minimal query API for chunk retrieval.
//!
//! CORE INVARIANTS:
//! - Knowledge layer is DERIVED, REBUILDABLE, and READ-ONLY with respect to
//!   user files. We never mutate anything outside `.hibiscus/knowledge/`.
//! - Everything is incremental: unchanged files are skipped via content hashing.
//! - Fully async pipeline with bounded concurrency.
//! - Memory-efficient: chunks are streamed from disk, never bulk-loaded.
//!
//! PIPELINE:
//!   Watcher -> Debounced Queue -> Worker Pool -> Parser -> Chunker
//!           -> Indexer -> Storage -> Query API
//!
//! MODULE LAYOUT:
//! - types:   Core data structures (FileEvent, Chunk, ParsedDocument, etc.)
//! - parser:  Trait-based parsing for .md and .txt files
//! - chunker: Splits parsed sections into size-bounded chunks
//! - indexer: Incremental keyword index maintenance
//! - storage: Disk I/O for chunks, file_map, keyword_index, manifest
//! - queue:   Debounced async event queue and worker pool
//! - query:   Minimal keyword search API
//! ============================================================================

pub mod types;
pub mod parser;
pub mod chunker;
pub mod indexer;
pub mod storage;
pub mod queue;
pub mod query;

// Re-export the Tauri-facing API so lib.rs can register commands directly.
// Using wildcard re-export because Tauri's #[tauri::command] macro generates
// hidden __cmd__ symbols that must be accessible at the same path.
pub use query::*;
pub use queue::KnowledgeState;
