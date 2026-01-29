//! ============================================================================
//! Hibiscus File Watcher Module
//! ============================================================================
//!
//! Filesystem watcher for detecting changes to workspace files.
//! Uses the `notify` crate for cross-platform file watching.
//!
//! FEATURES:
//! - Graceful shutdown mechanism (stop_watching command)
//! - Event filtering (ignores .hibiscus folder changes)
//! - Debounced events to prevent event storms
//! - Error recovery and logging
//! - Restartable (can switch workspaces)
//!
//! ARCHITECTURE:
//! - Uses AtomicBool for thread-safe shutdown signaling
//! - Watcher runs in a dedicated thread to avoid blocking
//! - Events are emitted to the frontend via Tauri's event system
//! ============================================================================

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{Emitter, State};

/// State for managing the file watcher lifecycle.
///
/// This is registered as Tauri managed state, allowing commands
/// to control the watcher across different invocations.
pub struct WatcherState {
    /// Flag to signal the watcher thread to stop
    pub running: Arc<AtomicBool>,
    /// Path currently being watched (for logging)
    pub current_path: std::sync::Mutex<Option<String>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            current_path: std::sync::Mutex::new(None),
        }
    }
}

/// Debounce duration for filesystem events.
/// Events within this window are coalesced into a single notification.
const DEBOUNCE_MS: u64 = 300;

/// Timeout for checking shutdown signal.
/// Shorter timeouts mean faster shutdown response.
const RECV_TIMEOUT_MS: u64 = 100;

/// Paths to ignore when processing filesystem events.
/// These are patterns that should not trigger a refresh.
const IGNORED_PATHS: &[&str] = &[
    ".hibiscus",
    ".git",
    ".vscode",
    "node_modules",
    "__pycache__",
    ".DS_Store",
    "Thumbs.db",
];

/// Checks if a path should be ignored based on the IGNORED_PATHS list.
///
/// # Arguments
/// * `path` - The path to check
///
/// # Returns
/// `true` if the path contains any ignored pattern
fn should_ignore_path(path: &PathBuf) -> bool {
    let path_str = path.to_string_lossy();
    IGNORED_PATHS.iter().any(|pattern| path_str.contains(pattern))
}

/// Starts watching a workspace directory for filesystem changes.
///
/// This function spawns a background thread that monitors the specified
/// directory and emits "fs-changed" events when modifications are detected.
///
/// # Arguments
/// * `path` - The directory path to watch
/// * `window` - Tauri window handle for emitting events
/// * `state` - Managed state for controlling the watcher
///
/// # Events Emitted
/// * `fs-changed` - Emitted when relevant filesystem changes occur
///   Payload: Array of changed file paths
///
/// # Notes
/// - Calling this while a watcher is running will stop the old watcher first
/// - The watcher filters out changes to .hibiscus and other ignored paths
/// - Events are debounced to prevent excessive updates
#[tauri::command]
pub fn watch_workspace(path: String, window: tauri::Window, state: State<WatcherState>) {
    // Stop any existing watcher
    state.running.store(false, Ordering::SeqCst);

    // Small delay to let the old watcher thread notice the shutdown
    std::thread::sleep(Duration::from_millis(RECV_TIMEOUT_MS * 2));

    // Update current path for logging
    if let Ok(mut current) = state.current_path.lock() {
        *current = Some(path.clone());
    }

    // Set running flag for new watcher
    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

    let watch_path = path.clone();

    // Spawn watcher thread
    std::thread::spawn(move || {
        println!("[Hibiscus] Starting file watcher for: {}", watch_path);

        // Create channel for receiving filesystem events
        let (tx, rx) = channel();

        // Create the watcher
        let mut watcher: RecommendedWatcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[Hibiscus] Error: Failed to create file watcher: {}", e);
                running.store(false, Ordering::SeqCst);
                // Emit error event to frontend
                let _ = window.emit("fs-watcher-error", e.to_string());
                return;
            }
        };

        // Start watching the path
        if let Err(e) = watcher.watch(watch_path.as_ref(), RecursiveMode::Recursive) {
            eprintln!("[Hibiscus] Error: Failed to watch path '{}': {}", watch_path, e);
            running.store(false, Ordering::SeqCst);
            let _ = window.emit("fs-watcher-error", e.to_string());
            return;
        }

        println!("[Hibiscus] File watcher started successfully");

        // Track last emit time for debouncing
        let mut last_emit = Instant::now() - Duration::from_secs(1);

        // Main event loop
        while running.load(Ordering::SeqCst) {
            // Wait for events with timeout to check running flag periodically
            match rx.recv_timeout(Duration::from_millis(RECV_TIMEOUT_MS)) {
                Ok(Ok(event)) => {
                    // Process the event
                    if let Err(e) = process_event(&event, &window, &mut last_emit) {
                        eprintln!("[Hibiscus] Warning: Error processing event: {}", e);
                    }
                }
                Ok(Err(e)) => {
                    // Watcher error
                    eprintln!("[Hibiscus] Warning: Watcher error: {}", e);
                    // Don't stop on transient errors, just log them
                }
                Err(RecvTimeoutError::Timeout) => {
                    // Normal timeout - continue loop to check running flag
                }
                Err(RecvTimeoutError::Disconnected) => {
                    // Channel disconnected - watcher stopped
                    eprintln!("[Hibiscus] Warning: Watcher channel disconnected");
                    break;
                }
            }
        }

        // Cleanup
        println!("[Hibiscus] File watcher stopped for: {}", watch_path);
        drop(watcher);
    });
}

/// Processes a filesystem event and emits notifications as needed.
///
/// # Arguments
/// * `event` - The filesystem event to process
/// * `window` - Tauri window for emitting events
/// * `last_emit` - Timestamp of last emission for debouncing
///
/// # Returns
/// * `Ok(())` - Event processed successfully
/// * `Err(String)` - Error during processing
fn process_event(
    event: &Event,
    window: &tauri::Window,
    last_emit: &mut Instant,
) -> Result<(), String> {
    // Filter out access events (we only care about modifications)
    match event.kind {
        EventKind::Access(_) => return Ok(()),
        EventKind::Other => return Ok(()), // Platform-specific noise
        _ => {}
    }

    // Check if all paths should be ignored
    let relevant_paths: Vec<&PathBuf> = event
        .paths
        .iter()
        .filter(|p| !should_ignore_path(p))
        .collect();

    if relevant_paths.is_empty() {
        // All paths were ignored
        return Ok(());
    }

    // Apply debouncing
    let debounce_duration = Duration::from_millis(DEBOUNCE_MS);
    if last_emit.elapsed() < debounce_duration {
        // Too soon since last emit, skip
        return Ok(());
    }

    // Update last emit time
    *last_emit = Instant::now();

    // Convert paths to strings for the frontend
    let path_strings: Vec<String> = relevant_paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    // Emit the event to the frontend
    window
        .emit("fs-changed", &path_strings)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

/// Stops the current file watcher.
///
/// This command signals the watcher thread to stop gracefully.
/// Safe to call even if no watcher is running.
///
/// # Arguments
/// * `state` - Managed watcher state
#[tauri::command]
pub fn stop_watching(state: State<WatcherState>) {
    let was_running = state.running.swap(false, Ordering::SeqCst);

    if was_running {
        if let Ok(current) = state.current_path.lock() {
            if let Some(path) = current.as_ref() {
                println!("[Hibiscus] Stopping file watcher for: {}", path);
            }
        }
    }
}

/// Checks if a watcher is currently running.
///
/// # Arguments
/// * `state` - Managed watcher state
///
/// # Returns
/// `true` if a watcher is currently active
#[tauri::command]
pub fn is_watching(state: State<WatcherState>) -> bool {
    state.running.load(Ordering::SeqCst)
}

/// Gets the currently watched path, if any.
///
/// # Arguments
/// * `state` - Managed watcher state
///
/// # Returns
/// The watched path, or None if not watching
#[tauri::command]
pub fn get_watched_path(state: State<WatcherState>) -> Option<String> {
    if state.running.load(Ordering::SeqCst) {
        state.current_path.lock().ok().and_then(|p| p.clone())
    } else {
        None
    }
}
