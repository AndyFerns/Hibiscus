# API Reference

Hibiscus exposes multiple Rust commands to the React frontend via Tauri's IPC (`@tauri-apps/api/core`). Below is a comprehensive list of all exposed endpoints along with their Rust signatures and intended uses.

## File Operations (`files.rs`)

### `read_text_file(path: String) -> Result<String, HibiscusError>`
Reads a text-based file fully into memory and returning it as a string to the editor buffer. Handles basic validation to prevent reading paths outside root bounds.

### `write_text_file(path: String, contents: String) -> Result<(), HibiscusError>`
Writes changes from the Monaco buffer onto the disk natively. Triggers atomic saves when viable to prevent partial writes.

## Workspace Management (`workspace.rs`)

### `discover_workspace(path: String) -> Result<Option<String>, HibiscusError>`
Scans upwards from the given directory path searching for an initialized `.hibiscus` directory.

### `load_workspace(path: String) -> Result<WorkspaceFile, HibiscusError>`
Reads `.hibiscus/workspace.json`, applies necessary schemas migrations (`migration.rs`), and parses the resulting tree configuration to feed the frontend session data.

### `save_workspace(path: String, workspace: WorkspaceFile) -> Result<(), HibiscusError>`
Saves tracking information (like recently active files, open sidebar state) into the workspace config. Triggers `backup.rs` file rotation inherently.

## File Structure (`tree.rs`)

### `get_directory_tree(path: String) -> Result<Node, HibiscusError>`
Recursively models and returns the folder hierarchy within the active workspace root. Ignores configured system paths (`.git`, `node_modules`, `__pycache__`).

## Calendar API (`calendar.rs`)

### `read_calendar_data(root: String) -> Result<serde_json::Value, HibiscusError>`
Reads the user's planner data directly via their root workspace path. Implements native schema upgrades internally upon initialization.

### `save_calendar_data(root: String, data: serde_json::Value) -> Result<(), HibiscusError>`
Dumps user modifications (events, scheduled tasks) into the calendar disk instance. Also triggers autonomous `.bak` creation via the backup module.

## Filesystem Watcher (`watcher.rs`)

### `watch_workspace(path: String)`
Spawns an asynchronous native Thread utilizing the `notify` crate, accumulating modifying file operations within a debounced pool to be emitted natively utilizing the `fs-changed` payload channel.

### `stop_watching()`
Gracefully halts the currently active thread watcher, usually occurring right before swapping user contexts/roots.
