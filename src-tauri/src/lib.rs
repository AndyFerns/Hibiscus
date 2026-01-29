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
//! ============================================================================

mod commands;
mod error;
mod tree;
mod watcher;
mod workspace;

use watcher::WatcherState;

/// Entry point for the Tauri application.
///
/// Sets up all plugins, managed state, and command handlers.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register plugins
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Register managed state for watcher
        .manage(WatcherState::default())
        // Register command handlers
        .invoke_handler(tauri::generate_handler![
            // File operations (async for non-blocking I/O)
            commands::read_text_file,
            commands::write_text_file,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hibiscus");
}
