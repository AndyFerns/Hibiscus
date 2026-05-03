# API Reference

Hibiscus exposes multiple Rust commands to the React frontend via Tauri's IPC (`@tauri-apps/api/core`). This reference documents all available commands.

**Version**: 0.3.7  
**Last Updated**: May 2026

---

## File Operations

All file operations include path validation to prevent directory traversal attacks.

### Read Operations

#### `read_text_file(path: String) -> Result<String, HibiscusError>`
**File**: `commands/files.rs`

Reads a text file into memory for editor display.

**Parameters:**
- `path`: Absolute path to file

**Returns:**
- `Ok(String)`: File contents
- `Err`: FileNotFound, InvalidPathType, Io errors

**Security:**
- Validates path doesn't contain `..`
- Checks path depth limits (50 levels)
- Verifies path is within workspace bounds

---

#### `read_file_binary(path: String) -> Result<Vec<u8>, HibiscusError>`
**File**: `commands/files.rs`

Reads file as binary data for non-text content.

**Parameters:**
- `path`: Absolute path to file

**Returns:**
- `Ok(Vec<u8>)`: Raw bytes
- `Err`: FileNotFound, Io errors

**Use Cases:**
- PDF rendering
- Image display
- Binary file handling

---

### Write Operations

#### `write_text_file(path: String, contents: String) -> Result<(), HibiscusError>`
**File**: `commands/files.rs`

Writes text content to file using atomic save strategy.

**Parameters:**
- `path`: Absolute path to file
- `contents`: Text content to write

**Save Strategy:**
1. Write to temp file: `filename.hibiscus-save~`
2. Sync to disk
3. Delete original (Windows compatibility)
4. Atomic rename temp to target
5. Cleanup on failure

**Returns:**
- `Ok(())`: Success
- `Err`: PathValidation, Io errors

---

### File/Folder Creation

#### `create_file(path: String) -> Result<(), HibiscusError>`
**File**: `commands/files.rs`

Creates a new empty file.

**Parameters:**
- `path`: Absolute path for new file

**Behavior:**
- Creates parent directories if needed
- Returns error if file exists
- Validates path security

---

#### `create_folder(path: String) -> Result<(), HibiscusError>`
**File**: `commands/files.rs`

Creates a new directory.

**Parameters:**
- `path`: Absolute path for new folder

**Behavior:**
- Creates parent directories recursively
- Returns error if folder exists
- Validates path security

---

#### `create_item(path: String, is_file: bool) -> Result<String, HibiscusError>`
**File**: `commands/create_item.rs`

Unified item creation with per-path locking to prevent race conditions.

**Parameters:**
- `path`: Absolute path for new item
- `is_file`: true = file, false = folder

**Returns:**
- `Ok(String)`: The created item path
- `Err`: AlreadyExists, Io, PathValidation errors

**Locking:**
- Uses per-path mutex to prevent concurrent creation
- Thread-safe across all operations

---

### Deletion Operations

#### `delete_file(path: String) -> Result<(), HibiscusError>`
**File**: `commands/files.rs`

Permanently deletes a file.

**Parameters:**
- `path`: Absolute path to file

**Behavior:**
- Validates file exists and is a file
- Immediate permanent deletion (no trash)
- Updates file watchers

---

#### `delete_folder(path: String, recursive: bool) -> Result<(), HibiscusError>`
**File**: `commands/files.rs`

Deletes a directory.

**Parameters:**
- `path`: Absolute path to folder
- `recursive`: If true, deletes contents; if false, only empty folders

**Behavior:**
- Validates folder exists
- Recursive mode removes all contents
- Non-recursive fails on non-empty folders

---

### Move Operations

#### `move_node(source: String, target: String) -> Result<(), HibiscusError>`
**File**: `commands/files.rs`

Moves a file or folder to a new location.

**Parameters:**
- `source`: Current absolute path
- `target`: Destination absolute path

**Behavior:**
- Works for both files and folders
- Atomic operation when possible
- Updates all internal state
- Handles cross-device moves

---

## Workspace Operations

#### `discover_workspace(root: String) -> WorkspaceDiscovery`
**File**: `commands/workspace.rs`

Scans for existing workspace configuration.

**Parameters:**
- `root`: Directory to check for `.hibiscus/workspace.json`

**Returns:**
```rust
struct WorkspaceDiscovery {
    found: bool,
    path: Option<String>,
}
```

---

#### `load_workspace(path: String) -> Result<WorkspaceFile, HibiscusError>`
**File**: `commands/workspace.rs`

Loads workspace configuration with schema migration.

**Parameters:**
- `path`: Path to `workspace.json`

**Behavior:**
- Reads and parses JSON
- Applies schema migrations
- Validates structure
- Returns default if file missing

**Returns:**
- `Ok(WorkspaceFile)`: Parsed workspace data
- `Err`: Io, JsonParse errors

---

#### `save_workspace(path: String, workspace: WorkspaceFile) -> Result<(), HibiscusError>`
**File**: `commands/workspace.rs`

Persists workspace configuration.

**Parameters:**
- `path`: Path to save `workspace.json`
- `workspace`: Workspace data structure

**Behavior:**
- Atomic write (temp file + rename)
- Triggers backup creation
- Creates parent directories

---

## Tree Operations

#### `build_tree(root: String) -> Result<Vec<Node>, HibiscusError>`
**File**: `commands/tree.rs`

Builds recursive directory tree structure.

**Parameters:**
- `root`: Root directory to scan

**Returns:**
- `Ok(Vec<Node>)`: Tree nodes

**Behavior:**
- Respects max depth (20 levels)
- Ignores: `.git`, `node_modules`, `__pycache__`, `.hibiscus`, hidden files
- Sorts: folders first, then files, alphabetically
- Uses parallel scanning for performance

---

## File Watcher

#### `watch_workspace(path: String) -> Result<(), String>`
**File**: `watcher.rs`

Starts filesystem watcher for real-time updates.

**Parameters:**
- `path`: Root directory to watch

**Behavior:**
- Spawns async notify thread
- Debounces events (300ms)
- Emits `fs-changed` events to frontend
- Watches recursively

---

#### `stop_watching() -> Result<(), String>`
**File**: `watcher.rs`

Stops the active filesystem watcher.

**Behavior:**
- Gracefully shuts down watcher thread
- Clears internal state
- Safe to call when not watching

---

#### `is_watching() -> bool`
**File**: `watcher.rs`

Check if watcher is currently active.

**Returns:**
- `true`: Watcher running
- `false`: Watcher stopped

---

#### `get_watched_path() -> Option<String>`
**File**: `watcher.rs`

Get currently watched path.

**Returns:**
- `Some(String)`: Active watch path
- `None`: No active watcher

---

## Calendar Operations

#### `read_calendar_data(root: String) -> Result<serde_json::Value, HibiscusError>`
**File**: `commands/calendar.rs`

Loads calendar events and tasks.

**Parameters:**
- `root`: Workspace root path

**Returns:**
- Calendar data JSON with events, tasks, settings
- Default empty structure if file missing

**Data Structure:**
```json
{
  "events": [...],
  "tasks": [...],
  "settings": {
    "view": "month",
    "startOfWeek": "monday"
  }
}
```

---

#### `save_calendar_data(root: String, data: serde_json::Value) -> Result<(), HibiscusError>`
**File**: `commands/calendar.rs`

Persists calendar modifications.

**Parameters:**
- `root`: Workspace root path
- `data`: Calendar JSON data

**Behavior:**
- Atomic write
- Creates backup before modification
- Schema validation

---

## Theme Operations

#### `load_themes(root: String) -> Result<ThemeCollection, HibiscusError>`
**File**: `commands/themes.rs`

Loads all custom themes from workspace.

**Parameters:**
- `root`: Workspace root path

**Returns:**
- Collection of custom theme definitions
- Empty collection if no custom themes

---

#### `save_theme(root: String, theme: ThemeDefinition) -> Result<(), HibiscusError>`
**File**: `commands/themes.rs`

Saves a custom theme.

**Parameters:**
- `root`: Workspace root path
- `theme`: Theme definition object

**Behavior:**
- Writes to `.hibiscus/themes/<name>.json`
- Creates themes directory if needed
- Validates theme structure

---

#### `delete_theme(root: String, name: String) -> Result<(), HibiscusError>`
**File**: `commands/themes.rs`

Deletes a custom theme.

**Parameters:**
- `root`: Workspace root path
- `name`: Theme name to delete

**Behavior:**
- Removes theme file
- Safe to call for non-existent themes

---

## Study Data Operations

#### `read_study_data(root: String) -> Result<StudyData, HibiscusError>`
**File**: `commands/study.rs`

Loads all study-related data.

**Parameters:**
- `root`: Workspace root path

**Returns:**
```rust
struct StudyData {
    sessions: Vec<StudySession>,
    flashcards: Vec<FlashcardDeck>,
    settings: StudySettings,
}
```

**Data Includes:**
- Pomodoro session history
- Flashcard decks and cards
- Study statistics
- User preferences

---

#### `save_study_data(root: String, data: StudyData) -> Result<(), HibiscusError>`
**File**: `commands/study.rs`

Persists study data.

**Parameters:**
- `root`: Workspace root path
- `data`: Complete study data structure

**Behavior:**
- Atomic write
- Creates backup
- Validates data integrity

---

## Knowledge Indexing (Phase 1)

#### `search_knowledge(keyword: String, state: State) -> Result<Vec<SearchResult>, String>`
**Module**: `knowledge`

Basic keyword search (legacy, Phase 1).

**Parameters:**
- `keyword`: Search term (normalized automatically)
- `state`: Managed KnowledgeState

**Returns:**
- List of matching chunks with content

**Note:** Use `search_chunks` (Phase 2) for production queries.

---

#### `get_chunk(chunk_id: String, state: State) -> Result<SearchResult, String>`
**Module**: `knowledge`

Retrieves a specific chunk by ID.

**Parameters:**
- `chunk_id`: Unique chunk identifier
- `state`: Managed KnowledgeState

**Returns:**
- Single chunk with full content

---

#### `rebuild_knowledge_index(state: State) -> Result<usize, String>`
**Module**: `knowledge`

Triggers full workspace re-index.

**Parameters:**
- `state`: Managed KnowledgeState

**Returns:**
- Number of files processed (including skipped)

**Behavior:**
- Scans entire workspace
- Uses content hashes to skip unchanged files
- Processes in background worker
- Non-blocking operation

---

## Knowledge Indexing (Phase 2)

#### `search_chunks(query: String, offset: Option<usize>, limit: Option<usize>, state: State) -> Result<Vec<RankedSearchResult>, String>`
**Module**: `knowledge/query.rs`

Advanced ranked search with TF-IDF scoring.

**Parameters:**
- `query`: Search query (supports multi-word)
- `offset`: Pagination offset (default: 0)
- `limit`: Max results (default: 20)
- `state`: Managed KnowledgeState

**Returns:**
```rust
struct RankedSearchResult {
    chunk_id: String,
    content: String,
    file_path: String,
    topic: Option<String>,
    score: f64,        // TF-IDF relevance score
}
```

**Features:**
- TF-IDF ranking
- Fuzzy matching (edit distance ≤ 1)
- Prefix matching
- Multi-word query support
- LRU result caching

---

#### `get_topics(state: State) -> Result<TopicMap, String>`
**Module**: `knowledge/topics.rs`

Retrieves topic clustering data.

**Parameters:**
- `state`: Managed KnowledgeState

**Returns:**
```rust
struct TopicMap {
    topics: HashMap<String, Vec<String>>,  // topic -> chunk_ids
}
```

**Behavior:**
- Topics extracted from headings
- Deterministic clustering
- No ML or external dependencies

---

## Path Utilities

#### `normalize_path(path: String) -> String`
**File**: `commands/path.rs`

Normalizes path separators for current platform.

**Parameters:**
- `path`: Input path string

**Returns:**
- Normalized path with correct separators

**Behavior:**
- Converts `/` to `\` on Windows
- Converts `\` to `/` on Unix
- Handles mixed separators

---

#### `join_paths(base: String, segments: Vec<String>) -> String`
**File**: `commands/path.rs`

Safely joins path segments.

**Parameters:**
- `base`: Base path
- `segments`: Path components to append

**Returns:**
- Combined path string

**Behavior:**
- Handles trailing/leading slashes
- Validates each segment
- Prevents traversal attempts

---

## Error Types

All commands return `HibiscusError` on failure:

```rust
pub enum HibiscusError {
    Io(String),                    // File system errors
    FileNotFound(String),          // Missing files
    InvalidPathType { path: String, expected: String, actual: String },
    PathValidation(String),        // Security violations
    JsonParse(String),             // JSON errors
    AlreadyExists(String),         // Creation conflicts
    WorkspaceNotFound,             // Missing workspace
    Migration(String),             // Schema upgrade failures
    Knowledge(String),             // Indexing errors
    Theme(String),                 // Theme-related errors
}
```

**Serialization:**
Errors serialize to frontend-friendly strings while preserving type information for programmatic handling.

---

## Event System

### Backend → Frontend Events

#### `fs-changed`
**Source**: `watcher.rs`

Emitted when filesystem changes detected.

**Payload:**
```typescript
interface FsChangedEvent {
  type: "create" | "modify" | "delete" | "rename";
  path: string;
  oldPath?: string;  // For renames
}
```

**Frontend Usage:**
```typescript
import { listen } from "@tauri-apps/api/event";

listen("fs-changed", (event) => {
  console.log("File changed:", event.payload);
  refreshTree();
});
```

---

## Usage Examples

### Reading a File

```typescript
import { invoke } from "@tauri-apps/api/core";

const content = await invoke<string>("read_text_file", {
  path: "/workspace/notes.md"
});
```

### Creating a File

```typescript
await invoke("create_item", {
  path: "/workspace/new-file.md",
  is_file: true
});
```

### Searching Knowledge

```typescript
const results = await invoke("search_chunks", {
  query: "rust async",
  limit: 10
});
```

### Listening for Changes

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen("fs-changed", (event) => {
  // Update UI
});

// Cleanup
unlisten();
```

---

## Command Summary Table

| Command | File | Async | Purpose |
|---------|------|-------|---------|
| `read_text_file` | files.rs | ✓ | Read text content |
| `read_file_binary` | files.rs | ✓ | Read binary content |
| `write_text_file` | files.rs | ✓ | Write text content |
| `create_file` | files.rs | ✓ | Create empty file |
| `create_folder` | files.rs | ✓ | Create directory |
| `delete_file` | files.rs | ✓ | Delete file |
| `delete_folder` | files.rs | ✓ | Delete directory |
| `move_node` | files.rs | ✓ | Move file/folder |
| `create_item` | create_item.rs | ✓ | Unified creation with locking |
| `discover_workspace` | workspace.rs | ✗ | Find workspace |
| `load_workspace` | workspace.rs | ✓ | Load workspace data |
| `save_workspace` | workspace.rs | ✓ | Save workspace data |
| `build_tree` | tree.rs | ✗ | Build file tree |
| `watch_workspace` | watcher.rs | ✗ | Start file watcher |
| `stop_watching` | watcher.rs | ✗ | Stop file watcher |
| `is_watching` | watcher.rs | ✗ | Check watcher status |
| `get_watched_path` | watcher.rs | ✗ | Get watched path |
| `read_calendar_data` | calendar.rs | ✓ | Load calendar |
| `save_calendar_data` | calendar.rs | ✓ | Save calendar |
| `load_themes` | themes.rs | ✓ | Load custom themes |
| `save_theme` | themes.rs | ✓ | Save custom theme |
| `delete_theme` | themes.rs | ✓ | Delete custom theme |
| `read_study_data` | study.rs | ✓ | Load study data |
| `save_study_data` | study.rs | ✓ | Save study data |
| `normalize_path` | path.rs | ✗ | Normalize separators |
| `join_paths` | path.rs | ✗ | Join path segments |
| `search_knowledge` | knowledge | ✓ | Legacy search |
| `get_chunk` | knowledge | ✓ | Get chunk by ID |
| `rebuild_knowledge_index` | knowledge | ✓ | Rebuild index |
| `search_chunks` | knowledge | ✓ | Ranked search |
| `get_topics` | knowledge | ✓ | Get topic map |

---

## Related Documentation

- [Architecture](architecture.md) - System overview
- [Knowledge Pipeline](knowledge-pipeline.md) - Indexing system details
- [Contributing](contributing.md) - Development guidelines
