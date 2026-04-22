//! ============================================================================
//! Debounced Async Queue and Worker Pool
//! ============================================================================
//!
//! Bridges the watcher (which runs in a synchronous OS thread) and the async
//! processing pipeline. The architecture is:
//!
//!   Watcher thread --[mpsc::channel]--> Queue task --[batching]--> Worker pool
//!
//! DESIGN DECISIONS:
//! - The queue is a Tokio task, not a thread, so it cooperates with the
//!   async runtime used by the rest of the pipeline.
//! - Events are debounced and deduplicated before being dispatched to workers.
//!   This means rapid saves on the same file produce a single processing run.
//! - Concurrency is bounded by `num_cpus` (or a fallback of 4) to prevent
//!   CPU contention on machines with many cores.
//! - Each file is processed independently: parse -> chunk -> index -> store.
//!   A failure in one file does not affect others.
//!
//! IMPORTANT: The `KnowledgeState` struct is registered as Tauri managed state
//! in `lib.rs`. It holds the sender half of the channel so that `watcher.rs`
//! can enqueue events, and the workspace root so the pipeline knows where to
//! read/write knowledge data.
//! ============================================================================

use crate::knowledge::chunker;
use crate::knowledge::indexer;
use crate::knowledge::parser;
use crate::knowledge::storage;
use crate::knowledge::types::{FileEvent, FileEventType};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, Semaphore};

/// Debounce window for batching filesystem events before processing.
const DEBOUNCE_MS: u64 = 750;

/// Maximum number of events to batch before forcing a flush, even if the
/// debounce window has not elapsed. Prevents unbounded accumulation during
/// large bulk operations (e.g., git checkout).
const MAX_BATCH_SIZE: usize = 64;

// ---------------------------------------------------------------------------
// KnowledgeState: Tauri managed state
// ---------------------------------------------------------------------------

/// Shared state for the knowledge indexing system.
///
/// Registered with `app.manage(KnowledgeState::new(...))` in `lib.rs`.
/// The watcher thread uses the `sender` to enqueue events; the background
/// consumer task picks them up and processes them.
pub struct KnowledgeState {
    /// Sender half of the event channel. Cloned into the watcher thread.
    pub sender: mpsc::UnboundedSender<FileEvent>,
    /// Receiver half, wrapped in a Mutex because Tokio's receiver is !Sync.
    /// The background task takes ownership of the inner value on startup.
    receiver: Mutex<Option<mpsc::UnboundedReceiver<FileEvent>>>,
    /// Workspace root path. Set when `watch_workspace` is called.
    pub workspace_root: Mutex<Option<String>>,
}

impl KnowledgeState {
    /// Create a new KnowledgeState with a fresh channel.
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            sender: tx,
            receiver: Mutex::new(Some(rx)),
            workspace_root: Mutex::new(None),
        }
    }

    /// Take the receiver out of the state. This can only succeed once;
    /// subsequent calls return `None`. The background consumer task calls
    /// this at startup.
    pub async fn take_receiver(&self) -> Option<mpsc::UnboundedReceiver<FileEvent>> {
        self.receiver.lock().await.take()
    }

    /// Update the workspace root. Called when the user opens a new workspace.
    pub async fn set_workspace_root(&self, root: String) {
        *self.workspace_root.lock().await = Some(root);
    }

    /// Get the current workspace root, if set.
    pub async fn get_workspace_root(&self) -> Option<String> {
        self.workspace_root.lock().await.clone()
    }
}

impl Default for KnowledgeState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Background consumer task
// ---------------------------------------------------------------------------

/// Spawn the background consumer task that drains the event channel,
/// batches events, and dispatches them to the worker pool.
///
/// This should be called once during app startup (in `lib.rs` setup hook).
/// The task runs for the lifetime of the application.
pub fn spawn_knowledge_worker(state: Arc<KnowledgeState>) {
    tauri::async_runtime::spawn(async move {
        // Take ownership of the receiver. If it has already been taken
        // (e.g., double init), exit silently.
        let mut receiver = match state.take_receiver().await {
            Some(rx) => rx,
            None => {
                eprintln!("[Knowledge] Worker: receiver already taken, exiting.");
                return;
            }
        };

        println!("[Knowledge] Background worker started.");

        // Determine concurrency limit: number of logical CPUs, minimum 2.
        let max_concurrency = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .max(2);
        let semaphore = Arc::new(Semaphore::new(max_concurrency));

        loop {
            // Wait for the first event (blocking the task, not a thread).
            let first = match receiver.recv().await {
                Some(ev) => ev,
                None => {
                    println!("[Knowledge] Event channel closed, worker shutting down.");
                    break;
                }
            };

            // Accumulate a batch: collect all events that arrive within the
            // debounce window, up to MAX_BATCH_SIZE.
            let mut batch: HashMap<String, FileEventType> = HashMap::new();
            batch.insert(first.path.clone(), first.event_type.clone());

            let deadline = tokio::time::Instant::now()
                + tokio::time::Duration::from_millis(DEBOUNCE_MS);

            loop {
                if batch.len() >= MAX_BATCH_SIZE {
                    break;
                }
                let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
                if remaining.is_zero() {
                    break;
                }
                match tokio::time::timeout(remaining, receiver.recv()).await {
                    Ok(Some(ev)) => {
                        // Later events for the same path overwrite earlier ones.
                        // This handles rapid Create -> Modify sequences naturally.
                        batch.insert(ev.path.clone(), ev.event_type);
                    }
                    Ok(None) => {
                        // Channel closed while batching.
                        break;
                    }
                    Err(_) => {
                        // Timeout: debounce window elapsed.
                        break;
                    }
                }
            }

            // Deduplicate: the HashMap already ensures one entry per path.
            // Now dispatch each file to the worker pool.
            let workspace_root = match state.get_workspace_root().await {
                Some(root) => root,
                None => {
                    eprintln!("[Knowledge] No workspace root set, skipping batch.");
                    continue;
                }
            };

            // Ensure storage directories exist before processing.
            if let Err(e) = storage::ensure_dirs(&workspace_root) {
                eprintln!("[Knowledge] Failed to create storage dirs: {}", e);
                continue;
            }

            for (path, event_type) in batch {
                let ws = workspace_root.clone();
                let sem = semaphore.clone();

                tauri::async_runtime::spawn(async move {
                    // Acquire a permit to bound concurrency.
                    let _permit = match sem.acquire().await {
                        Ok(p) => p,
                        Err(_) => return,
                    };

                    // Use spawn_blocking for the CPU-bound + synchronous I/O work.
                    // This prevents blocking the Tokio runtime's async threads.
                    let result = tokio::task::spawn_blocking(move || {
                        process_file_event(&ws, &path, &event_type)
                    })
                    .await;

                    match result {
                        Ok(Ok(())) => {}
                        Ok(Err(e)) => {
                            eprintln!("[Knowledge] Processing error: {}", e);
                        }
                        Err(e) => {
                            eprintln!("[Knowledge] Task panic: {}", e);
                        }
                    }
                });
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Per-file processing (runs inside spawn_blocking)
// ---------------------------------------------------------------------------

/// Process a single file event: parse, chunk, index, store.
///
/// This function is designed to be called from `spawn_blocking` because it
/// performs synchronous disk I/O. All operations are scoped to a single file,
/// so failures here do not affect other files in the batch.
///
/// The incremental processing flow:
/// 1. For Delete events: remove old chunks and index entries.
/// 2. For Create/Modify: hash the file and compare to the stored hash.
///    - If unchanged: skip entirely (no work).
///    - If changed: remove old data, re-parse, re-chunk, re-index.
fn process_file_event(
    workspace_root: &str,
    file_path: &str,
    event_type: &FileEventType,
) -> Result<(), String> {
    match event_type {
        FileEventType::Delete => {
            remove_file_data(workspace_root, file_path)?;
            println!("[Knowledge] Removed index data for deleted file: {}", file_path);
        }
        FileEventType::Create | FileEventType::Modify => {
            // Filter: only process .md and .txt files.
            if !is_indexable_file(file_path) {
                return Ok(());
            }

            // Incremental check: compare file hash to stored hash.
            let current_hash = storage::hash_file(file_path)
                .ok_or_else(|| format!("Could not hash file: {}", file_path))?;

            let mut hash_map = storage::read_file_hash_map(workspace_root);
            if let Some(stored_hash) = hash_map.get(file_path) {
                if *stored_hash == current_hash {
                    // File unchanged -- skip entirely.
                    return Ok(());
                }
            }

            // File is new or changed. Remove old data first.
            remove_file_data(workspace_root, file_path)?;

            // Parse the file.
            let parser = parser::parser_for_path(file_path)
                .ok_or_else(|| format!("No parser for: {}", file_path))?;

            let doc = match parser.parse(file_path) {
                Ok(d) => d,
                Err(e) => {
                    // Log and skip on parse failure -- do not propagate.
                    eprintln!("[Knowledge] Parse failed for {}: {}", file_path, e);
                    return Ok(());
                }
            };

            // Chunk the parsed document.
            let chunks = chunker::chunk_document(doc);
            if chunks.is_empty() {
                return Ok(());
            }

            // Write chunks to disk.
            let chunk_ids: Vec<String> = chunks.iter().map(|c| c.id.clone()).collect();
            for chunk in &chunks {
                storage::write_chunk(workspace_root, chunk)
                    .map_err(|e| format!("Failed to write chunk {}: {}", chunk.id, e))?;
            }

            // Update file map.
            let mut file_map = storage::read_file_map(workspace_root);
            file_map.insert(file_path.to_string(), chunk_ids);
            storage::write_file_map(workspace_root, &file_map)
                .map_err(|e| format!("Failed to write file map: {}", e))?;

            // Update keyword index incrementally.
            let mut index = storage::read_keyword_index(workspace_root);
            indexer::add_chunks_to_index(&mut index, &chunks);
            storage::write_keyword_index(workspace_root, &index)
                .map_err(|e| format!("Failed to write keyword index: {}", e))?;

            // Update file hash.
            hash_map.insert(file_path.to_string(), current_hash);
            storage::write_file_hash_map(workspace_root, &hash_map)
                .map_err(|e| format!("Failed to write file hashes: {}", e))?;

            // Update manifest.
            let mut manifest = storage::read_manifest(workspace_root);
            manifest.file_count = file_map.len();
            manifest.chunk_count = file_map.values().map(|ids| ids.len()).sum();
            manifest.last_indexed = chrono_now_iso();
            storage::write_manifest(workspace_root, &manifest)
                .map_err(|e| format!("Failed to write manifest: {}", e))?;

            println!(
                "[Knowledge] Indexed {} ({} chunks)",
                file_path,
                chunks.len()
            );
        }
    }

    Ok(())
}

/// Remove all stored data for a single file: chunks, file_map entry,
/// keyword index entries, and file hash entry.
fn remove_file_data(workspace_root: &str, file_path: &str) -> Result<(), String> {
    let mut file_map = storage::read_file_map(workspace_root);
    let chunk_ids = file_map.remove(file_path).unwrap_or_default();

    if chunk_ids.is_empty() {
        return Ok(());
    }

    // Delete chunk files from disk.
    for id in &chunk_ids {
        let _ = storage::delete_chunk(workspace_root, id);
    }

    // Remove from keyword index.
    let mut index = storage::read_keyword_index(workspace_root);
    indexer::remove_chunks_from_index(&mut index, &chunk_ids);
    storage::write_keyword_index(workspace_root, &index)
        .map_err(|e| format!("Failed to write keyword index: {}", e))?;

    // Persist updated file map.
    storage::write_file_map(workspace_root, &file_map)
        .map_err(|e| format!("Failed to write file map: {}", e))?;

    // Remove file hash.
    let mut hash_map = storage::read_file_hash_map(workspace_root);
    hash_map.remove(file_path);
    storage::write_file_hash_map(workspace_root, &hash_map)
        .map_err(|e| format!("Failed to write file hashes: {}", e))?;

    // Update manifest.
    let mut manifest = storage::read_manifest(workspace_root);
    manifest.file_count = file_map.len();
    manifest.chunk_count = file_map.values().map(|ids| ids.len()).sum();
    manifest.last_indexed = chrono_now_iso();
    storage::write_manifest(workspace_root, &manifest)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    Ok(())
}

/// Check if a file path has an indexable extension (.md or .txt).
fn is_indexable_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".txt")
}

/// Produce a UTC ISO-8601 timestamp string without pulling in the `chrono` crate.
/// Uses `SystemTime` which is available in std.
fn chrono_now_iso() -> String {
    use std::time::SystemTime;

    match SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        Ok(d) => {
            let secs = d.as_secs();
            // Simple UTC timestamp: good enough for manifest metadata.
            // Full ISO-8601 would require calendar math; we use Unix epoch seconds
            // as an unambiguous, sortable timestamp.
            format!("{}", secs)
        }
        Err(_) => "0".to_string(),
    }
}

// ---------------------------------------------------------------------------
// Initial indexing: scan workspace and index all existing files
// ---------------------------------------------------------------------------

/// Scan the workspace for all indexable files and process them.
/// Called when a workspace is first opened or when a full reindex is requested.
///
/// This is NOT a "full rebuild" of the index -- it uses the same incremental
/// hash-based skip logic as event-driven updates. Files that are already
/// indexed and unchanged will be skipped.
pub fn initial_scan(workspace_root: &str) -> Result<usize, String> {
    storage::ensure_dirs(workspace_root)
        .map_err(|e| format!("Failed to create storage dirs: {}", e))?;

    let mut count = 0;
    scan_directory(workspace_root, workspace_root, &mut count)?;
    Ok(count)
}

/// Recursively scan a directory for indexable files.
fn scan_directory(
    workspace_root: &str,
    dir_path: &str,
    count: &mut usize,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path, e))?;

    // Collect file paths that need processing, avoiding holding the
    // directory iterator open during processing.
    let mut files_to_process: Vec<String> = Vec::new();
    let mut subdirs: Vec<String> = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        // Skip ignored directories.
        if path_str.contains(".hibiscus")
            || path_str.contains(".git")
            || path_str.contains("node_modules")
            || path_str.contains(".vscode")
            || path_str.contains("__pycache__")
        {
            continue;
        }

        if path.is_dir() {
            subdirs.push(path_str);
        } else if is_indexable_file(&path_str) {
            files_to_process.push(path_str);
        }
    }

    // Process files in this directory.
    for file_path in files_to_process {
        match process_file_event(workspace_root, &file_path, &FileEventType::Create) {
            Ok(()) => *count += 1,
            Err(e) => eprintln!("[Knowledge] Scan error for {}: {}", file_path, e),
        }
    }

    // Recurse into subdirectories.
    for subdir in subdirs {
        scan_directory(workspace_root, &subdir, count)?;
    }

    Ok(())
}
