// ! ============================================================================
// ! Hibiscus Commands Module
// ! ============================================================================
// ! Aggregates all Tauri command handlers.
// !
// ! Each submodule is grouped by domain:
// ! - files: file read/write
// ! - workspace: workspace.json operations
// ! - tree: directory tree builder
// ! - calendar: calendar persistence
// ! - path: shared path validation utilities
// ! ============================================================================

mod path;
mod files;
mod workspace;
mod tree;
mod calendar;

// Re-export commands so lib.rs can keep using `commands::xyz`
pub use files::*;
pub use workspace::*;
pub use tree::*;
pub use calendar::*;