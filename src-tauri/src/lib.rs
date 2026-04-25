//! ============================================================================
//! Hibiscus Application Entry Point
//! ============================================================================
//!
//! This is the main library entry point for the Hibiscus Tauri application.
//! It registers all modules, plugins, and Tauri commands.
//!
//! MODULES:
//! - commands: File and workspace operations
//! - error: Typed error handling
//! - tree: Directory tree builder
//! - watcher: Filesystem change monitoring
//! - workspace: Workspace data structures
//! - knowledge: Local-first knowledge indexing system (Phase 1 + Phase 2)
//! ============================================================================

mod commands;
mod error;
mod tree;
mod watcher;
pub mod workspace;
pub mod migration;
pub mod backup;
pub mod knowledge;

use watcher::WatcherState;
use knowledge::queue::{KnowledgeState, spawn_knowledge_worker};
use std::sync::Arc;

/// Entry point for the Tauri application.
///
/// Sets up all plugins, managed state, and command handlers.
///
/// KNOWLEDGE SYSTEM LIFECYCLE:
/// 1. `KnowledgeState` is created and shared via `Arc` before the builder runs.
/// 2. One Arc clone is registered with Tauri's managed state (for command access).
/// 3. Another Arc clone is passed to `spawn_knowledge_worker` in the setup hook.
/// 4. The background worker task takes the receiver from the shared state and
///    begins draining the event channel once events arrive.
/// 5. The watcher thread sends `FileEvent` values through the channel's sender,
///    which the worker picks up, debounces, and processes.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create KnowledgeState upfront and wrap in Arc so we can share it
    // between Tauri's managed state and the background worker task.
    // Tauri's .manage() stores the value in its own Arc internally, but
    // we need a second reference for the worker. Using Arc<KnowledgeState>
    // directly avoids the double-Arc problem.
    let knowledge_state = Arc::new(KnowledgeState::new());

    tauri::Builder::default()
        // Register plugins
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Register managed state for watcher
        .manage(WatcherState::default())
        // Register managed state for knowledge indexing system.
        // We manage the Arc directly so that Tauri commands receive
        // State<Arc<KnowledgeState>>, which lets us clone the Arc cheaply.
        .manage(knowledge_state.clone())
        // Setup hook: spawn the knowledge background worker.
        .setup(move |_app| {
            // Spawn the async worker that drains the event channel.
            // It will block (at the Tokio task level, not thread level)
            // until events arrive via the sender.
            spawn_knowledge_worker(knowledge_state.clone());
            println!("[Knowledge] Background worker spawned.");
            Ok(())
        })
        // Register command handlers
        .invoke_handler(tauri::generate_handler![
            // File operations (async for non-blocking I/O)
            commands::read_text_file,
            commands::write_text_file,
            commands::create_file,
            commands::create_folder,
            commands::delete_file,
            commands::delete_folder,
            commands::move_node,
            // Workspace operations
            commands::load_workspace,
            commands::save_workspace,
            commands::discover_workspace,
            // Tree builder
            commands::build_tree,
            // File watcher controls
            watcher::watch_workspace,
            watcher::stop_watching,
            watcher::is_watching,
            watcher::get_watched_path,
            // Calendar operations
            commands::read_calendar_data,
            commands::save_calendar_data,
            // Theme persistence
            commands::save_theme,
            commands::load_themes,
            commands::delete_theme,
            // Study data persistence
            commands::read_study_data,
            commands::save_study_data,
            // Unified item creation (per-path locked)
            commands::create_item,
            // Knowledge indexing system (Phase 1)
            knowledge::search_knowledge,
            knowledge::get_chunk,
            knowledge::rebuild_knowledge_index,
            // Knowledge indexing system (Phase 2)
            knowledge::search_chunks,
            knowledge::get_topics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hibiscus");
}
