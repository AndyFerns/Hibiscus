# File Explorer & Tree View

The **File Explorer** (left panel) is your workspace navigation hub. It displays your folder structure as an interactive tree, supports drag-and-drop organization, and provides quick access to all your files.

---

## Tree View Interface

The TreeView component renders your workspace as a hierarchical file tree:

```
📁 workspace/
├── 📁 documents/
│   ├── 📄 notes.md
│   ├── 📄 ideas.txt
│   └── 📁 archive/
│       └── 📄 old-notes.md
├── 📁 projects/
│   ├── 📄 todo.md
│   └── 📄 plan.md
└── 📄 README.md
```

### Visual Elements

- **Folder Icons**: Closed (📁) and open (📂) states
- **File Icons**: Different icons by file type (📄 for generic)
- **Expand/Collapse**: Chevron indicators for folders with children
- **Active State**: Highlighted background for selected file
- **Hover Effects**: Subtle background change on mouseover

---

## Navigation

### Opening Files

**Double-Click**: Opens file in new editor tab
**Single Click**: Selects file (without opening)

### Expanding/Collapsing Folders

- **Click Arrow**: Toggle folder expand/collapse
- **Double-Click Folder**: Expand and show contents
- **Alt+Click**: Expand/collapse all subfolders recursively

### Keyboard Navigation

When TreeView is focused:

| Key | Action |
|-----|--------|
| `↑ / ↓` | Navigate up/down tree |
| `←` | Collapse folder or go to parent |
| `→` | Expand folder |
| `Enter` | Open selected file/folder |
| `Space` | Toggle folder expand/collapse |

---

## Drag & Drop

Hibiscus features a native HTML5 drag-and-drop system for file organization:

### Moving Files

1. **Drag**: Click and hold any file or folder
2. **Hover**: Move over target folder
3. **Drop**: Release to move the item

### Visual Feedback

- **Dragging State**: Semi-transparent ghost of the item
- **Valid Target**: Target folder highlights with accent color
- **Invalid Target**: Red indicator (e.g., dropping folder into its own child)
- **Drop Success**: Brief flash animation, tree refreshes

### Supported Operations

| Source | Target | Result |
|--------|--------|--------|
| File | Folder | File moved into folder |
| Folder | Folder | Folder becomes subdirectory |
| File | Root | File moved to workspace root |
| Multiple | Folder | All items moved (planned) |

### Backend Operations

File moves use atomic filesystem operations:

```rust
// Pseudo-code of move operation
1. Validate source exists
2. Validate target is directory
3. Check for name conflicts
4. Perform atomic move
5. Update workspace session
6. Refresh tree view
7. Update file watchers
```

---

## Context Menu

Right-click any item for context actions:

### File Operations

- **Open**: Open in editor
- **Open to the Side**: Open in split view (planned)
- **Reveal in File Manager**: Open OS file explorer
- **Copy Path**: Copy absolute path to clipboard
- **Rename**: Inline rename editing
- **Delete**: Move to trash (with confirmation)

### Folder Operations

- **New File**: Create file in this folder
- **New Folder**: Create subdirectory
- **Expand All**: Open all nested folders
- **Collapse All**: Close all nested folders
- **Refresh**: Rescan folder contents

### Bulk Operations (planned)

- **Select Multiple**: Ctrl/Cmd + Click
- **Cut/Copy/Paste**: Standard clipboard operations
- **Delete Multiple**: Confirm once for selection

---

## File Creation

### New File/Folder

**Keyboard Shortcut**: 
- `Ctrl+N` → New File
- `Ctrl+Shift+N` → New Folder

**Context Menu**: Right-click parent → "New File" or "New Folder"

**Tree Header**: Buttons in the panel toolbar

### Creation Modal

The **NewItemModal** provides:

- **Name Input**: With validation and suggestions
- **Path Display**: Shows where item will be created
- **Validation**: 
  - Prevents invalid characters
  - Checks for duplicates
  - Validates name length
- **Quick Create**: Press Enter to confirm

### Suggestions System

When creating files, the modal suggests:

- **Recent Locations**: Folders you've used recently
- **Current Context**: The folder you right-clicked
- **Common Extensions**: `.md`, `.txt`, `.py`, `.js`, etc.

---

## File Watching

The TreeView automatically updates when files change:

### Detected Changes

- **File Created**: New item appears in tree
- **File Deleted**: Item removed with fade animation
- **File Modified**: Visual indicator (dot) for external changes
- **File Moved**: Tree restructures automatically

### External Editor Support

Edit files in other editors while Hibiscus is open:

- Changes reflect immediately in TreeView
- Open files in Hibiscus show "modified externally" indicator
- No manual refresh needed

---

## Workspace Session

The TreeView maintains state across restarts:

### Persisted State

```json
{
  "session": {
    "expanded_nodes": [
      "/workspace/documents",
      "/workspace/projects"
    ],
    "active_node": "/workspace/projects/todo.md",
    "scroll_position": 120
  }
}
```

### Restoration

On workspace load:

1. Tree structure rebuilds from disk
2. Previously expanded folders reopen
3. Last active file is highlighted
4. Scroll position restored

---

## Search Integration

The TreeView connects to the search system:

- **Filter**: Type while focused to filter visible items
- **Search Results**: Highlighted with special styling
- **Quick Open**: Press `Ctrl+P` for fuzzy file finder (planned)

---

## Performance

The TreeView is optimized for large workspaces:

### Optimizations

- **Virtual Scrolling**: Only visible nodes rendered (planned)
- **Lazy Loading**: Folder contents loaded on expand
- **Debounced Updates**: Rapid changes batched
- **Incremental Refresh**: Only changed branches updated

### Limits

- **Max Depth**: 20 levels (configurable)
- **Max Files**: 10,000 items (soft limit)
- **Hidden Files**: Ignored by default

---

## Ignored Patterns

The following are excluded from the tree:

```
.git/
node_modules/
__pycache__/
.hibiscus/
*.tmp
*.log
.hidden files
```

Customize via workspace settings (planned).

---

## Screenshots

*[PHOTO PLACEHOLDER: Tree View Overview]*
*Add screenshot showing the file tree with various file types, expanded and collapsed folders*

*[PHOTO PLACEHOLDER: Drag and Drop]*
*Add screenshot or GIF showing drag-and-drop in action with visual feedback*

*[PHOTO PLACEHOLDER: New Item Modal]*
*Add screenshot showing the file creation modal with path suggestions*

---

## Troubleshooting

### Tree Not Updating

1. Check file watcher is active (status bar indicator)
2. Try manual refresh: Right-click → Refresh
3. Restart Hibiscus if watcher crashed

### Drag & Drop Not Working

- Ensure target folder has write permissions
- Check if source is locked by another process
- Verify you're not dragging into a subfolder of itself

### File Icons Missing

- Icons are SVG-based and built-in
- Check if CSS loaded correctly (restart app)
- Verify file extension is recognized

### Slow Performance

- Consider excluding large directories (node_modules)
- Reduce tree depth if very deeply nested
- Close unnecessary expanded folders

---

## Related Documentation

- [Multi-File Editor](multi-file-editor.md) - Working with opened files
- [Search System](search.md) - Finding files
- [Modal System](modal-system.md) - File creation dialogs
