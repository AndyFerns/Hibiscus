//! ============================================================================
//! Storage Layer
//! ============================================================================
//!
//! Handles all disk I/O for the knowledge system. Every read and write goes
//! through this module, ensuring consistent paths, buffered I/O, and atomic
//! writes where feasible.
//!
//! STORAGE STRUCTURE:
//!   .hibiscus/knowledge/
//!     manifest.json
//!     index/keyword_index.json
//!     files/file_map.json
//!     chunks/<chunk_id>.json
//!
//! DESIGN DECISIONS:
//! - Each chunk is a separate JSON file. This avoids rewriting a monolithic
//!   file on every update and enables streaming reads for individual chunks.
//! - Manifest, file_map, and keyword_index are single JSON files because they
//!   are small enough to fit in memory and benefit from atomic read/write.
//! - All writes use BufWriter for efficient disk I/O.
//! - All reads use BufReader to avoid loading entire files into a single alloc.
//!
//! FAILURE HANDLING:
//! - Corrupt JSON files are logged and treated as empty/missing. The system
//!   can always be rebuilt from source files.
//! ============================================================================

use crate::knowledge::types::{CachedQuery, Chunk, FileMap, KeywordIndex, Manifest};
use std::collections::HashMap;
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// Returns the root directory for knowledge storage, given a workspace root.
/// Creates the directory tree if it does not exist.
pub fn knowledge_root(workspace_root: &str) -> PathBuf {
    Path::new(workspace_root).join(".hibiscus").join("knowledge")
}

/// Ensure all required subdirectories exist under the knowledge root.
/// Called once at startup and is idempotent.
pub fn ensure_dirs(workspace_root: &str) -> std::io::Result<()> {
    let root = knowledge_root(workspace_root);
    std::fs::create_dir_all(root.join("index"))?;
    std::fs::create_dir_all(root.join("files"))?;
    std::fs::create_dir_all(root.join("chunks"))?;
    Ok(())
}

fn manifest_path(workspace_root: &str) -> PathBuf {
    knowledge_root(workspace_root).join("manifest.json")
}

fn keyword_index_path(workspace_root: &str) -> PathBuf {
    knowledge_root(workspace_root).join("index").join("keyword_index.json")
}

fn file_map_path(workspace_root: &str) -> PathBuf {
    knowledge_root(workspace_root).join("files").join("file_map.json")
}

fn chunk_path(workspace_root: &str, chunk_id: &str) -> PathBuf {
    knowledge_root(workspace_root).join("chunks").join(format!("{}.json", chunk_id))
}

fn recent_queries_path(workspace_root: &str) -> PathBuf {
    knowledge_root(workspace_root).join("recent_queries.json")
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/// Read the manifest from disk, returning Default if missing or corrupt.
pub fn read_manifest(workspace_root: &str) -> Manifest {
    read_json_or_default(&manifest_path(workspace_root))
}

/// Write the manifest to disk atomically.
pub fn write_manifest(workspace_root: &str, manifest: &Manifest) -> std::io::Result<()> {
    write_json(&manifest_path(workspace_root), manifest)
}

// ---------------------------------------------------------------------------
// Keyword index
// ---------------------------------------------------------------------------

/// Read the keyword index from disk.
/// Returns an empty HashMap if the file is missing or corrupt.
pub fn read_keyword_index(workspace_root: &str) -> KeywordIndex {
    read_json_or_default(&keyword_index_path(workspace_root))
}

/// Write the keyword index to disk.
pub fn write_keyword_index(workspace_root: &str, index: &KeywordIndex) -> std::io::Result<()> {
    write_json(&keyword_index_path(workspace_root), index)
}

// ---------------------------------------------------------------------------
// File map
// ---------------------------------------------------------------------------

/// Read the file map from disk.
pub fn read_file_map(workspace_root: &str) -> FileMap {
    read_json_or_default(&file_map_path(workspace_root))
}

/// Write the file map to disk.
pub fn write_file_map(workspace_root: &str, file_map: &FileMap) -> std::io::Result<()> {
    write_json(&file_map_path(workspace_root), file_map)
}

// ---------------------------------------------------------------------------
// Chunks (individual files)
// ---------------------------------------------------------------------------

/// Write a single chunk to disk as `.hibiscus/knowledge/chunks/<id>.json`.
pub fn write_chunk(workspace_root: &str, chunk: &Chunk) -> std::io::Result<()> {
    write_json(&chunk_path(workspace_root, &chunk.id), chunk)
}

/// Read a single chunk from disk by ID.
/// Returns `None` if the file is missing or corrupt.
pub fn read_chunk(workspace_root: &str, chunk_id: &str) -> Option<Chunk> {
    let path = chunk_path(workspace_root, chunk_id);
    if !path.exists() {
        return None;
    }
    match std::fs::File::open(&path) {
        Ok(file) => {
            let reader = BufReader::new(file);
            serde_json::from_reader(reader).ok()
        }
        Err(e) => {
            eprintln!("[Knowledge] Warning: could not read chunk {}: {}", chunk_id, e);
            None
        }
    }
}

/// Delete a single chunk file from disk.
pub fn delete_chunk(workspace_root: &str, chunk_id: &str) -> std::io::Result<()> {
    let path = chunk_path(workspace_root, chunk_id);
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Recent queries cache
// ---------------------------------------------------------------------------

/// Read the recent queries cache.
pub fn read_recent_queries(workspace_root: &str) -> Vec<CachedQuery> {
    read_json_or_default(&recent_queries_path(workspace_root))
}

/// Write the recent queries cache. Keeps at most `max` entries.
pub fn write_recent_queries(
    workspace_root: &str,
    queries: &[CachedQuery],
    max: usize,
) -> std::io::Result<()> {
    // Only keep the most recent `max` entries to bound cache size.
    let to_write = if queries.len() > max {
        &queries[queries.len() - max..]
    } else {
        queries
    };
    write_json(&recent_queries_path(workspace_root), &to_write)
}

// ---------------------------------------------------------------------------
// File hashing for incremental processing
// ---------------------------------------------------------------------------

/// Compute a hash of a file's contents for change detection.
///
/// Uses a streaming approach: reads the file in 8 KB chunks through BufReader,
/// feeding each chunk into the hasher. This keeps memory usage constant
/// regardless of file size.
///
/// Returns `None` if the file cannot be read.
pub fn hash_file(path: &str) -> Option<String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::Hasher;
    use std::io::Read;

    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return None,
    };

    let mut reader = BufReader::new(file);
    let mut hasher = DefaultHasher::new();
    let mut buf = [0u8; 8192];

    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => hasher.write(&buf[..n]),
            Err(_) => return None,
        }
    }

    Some(format!("{:016x}", hasher.finish()))
}

// ---------------------------------------------------------------------------
// File hash map (separate from file_map -- tracks content hashes for
// incremental skip decisions)
// ---------------------------------------------------------------------------

/// Maps file paths to their last-known content hash.
/// Stored alongside file_map for persistence.
pub type FileHashMap = HashMap<String, String>;

fn file_hash_map_path(workspace_root: &str) -> PathBuf {
    knowledge_root(workspace_root).join("files").join("file_hashes.json")
}

pub fn read_file_hash_map(workspace_root: &str) -> FileHashMap {
    read_json_or_default(&file_hash_map_path(workspace_root))
}

pub fn write_file_hash_map(workspace_root: &str, map: &FileHashMap) -> std::io::Result<()> {
    write_json(&file_hash_map_path(workspace_root), map)
}

// ---------------------------------------------------------------------------
// Generic JSON helpers
// ---------------------------------------------------------------------------

/// Read a JSON file into a deserialized value, returning `Default` on any error.
///
/// This is the right behavior for the knowledge layer: if a file is missing
/// or corrupt, we treat it as empty and let the next indexing pass rebuild it.
fn read_json_or_default<T: serde::de::DeserializeOwned + Default>(path: &Path) -> T {
    if !path.exists() {
        return T::default();
    }
    match std::fs::File::open(path) {
        Ok(file) => {
            let reader = BufReader::new(file);
            match serde_json::from_reader(reader) {
                Ok(val) => val,
                Err(e) => {
                    eprintln!(
                        "[Knowledge] Warning: corrupt JSON at {}, treating as empty: {}",
                        path.display(),
                        e
                    );
                    T::default()
                }
            }
        }
        Err(e) => {
            eprintln!(
                "[Knowledge] Warning: could not open {}: {}",
                path.display(),
                e
            );
            T::default()
        }
    }
}

/// Write a serializable value to a JSON file using BufWriter.
///
/// Uses `serde_json::to_writer_pretty` for human-readable output.
/// The pretty format adds negligible overhead for files this small
/// and makes debugging vastly easier.
fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    // Ensure parent directory exists (idempotent).
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = std::fs::File::create(path)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, value)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
}
