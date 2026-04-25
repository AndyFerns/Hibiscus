# Multi-File Tabbed Editor

Hibiscus features a powerful multi-file tabbed editor system that allows you to work with multiple files simultaneously while maintaining exceptional performance and a clean, intuitive interface. The implementation leverages Monaco Editor's internal model swapping to provide seamless tab switching without component remounting.

## Tab Management

### Opening Files

You can open files in several ways:

- **Double-click** any file in the file tree to open it in a new tab
- **Right-click** files and select "Open" from the context menu
- **Search results** automatically open files in new tabs when clicked
- Files are opened as tabs, not replacing the current editor content

### Tab Bar Interface

The tab bar sits above the editor and provides:

- **Horizontal scrolling** with mouse wheel support for many tabs
- **Visual indicators** for unsaved changes (dirty state)
- **Close buttons** on individual tabs
- **Active tab highlighting** with theme-consistent styling
- **File names** with proper truncation for long names

### Tab Navigation

Switch between tabs using:

- **Click** any tab to make it active
- **Ctrl+W** to close the active tab
- **Mouse wheel** over tab bar to scroll horizontally
- Tab order is maintained based on when files were opened

### Performance Architecture

The tab system is designed for high performance:

- **No component remounting** when switching tabs
- **Monaco model swapping** for instant content changes
- **O(1) content lookups** using optimized data structures
- **Ordered file list** maintains tab sequence
- **Buffer map** provides instant content access

## Session Persistence

### Automatic Session Saving

Hibiscus automatically preserves your editing session:

- **Session file**: `.hibiscus/session.json` stores open files and active tab
- **Debounced saving**: 300ms delay prevents excessive disk I/O
- **Atomic operations**: Ensures session integrity
- **Background persistence**: Saves automatically as you work

### Session Restoration

When you reopen a workspace:

- **Automatic restore** of previously open files
- **Active tab recovery** to your last editing position
- **Content preservation** for all open files
- **One-time restoration** fires exactly when workspace loads

### Session Data Structure

The session stores:

- **Open file paths** in correct tab order
- **Active file path** for current tab
- **File metadata** for quick restoration
- **Workspace context** for proper file resolution

## File Tree Drag-and-Drop

### Native HTML5 Implementation

The file tree supports drag-and-drop without external dependencies:

- **Native HTML5 DnD API** for maximum compatibility
- **Visual feedback** during drag operations
- **Drop target highlighting** for valid destinations
- **Smooth animations** and transitions

### Drag Operations

You can:

- **Drag files** between folders to move them
- **Drag folders** to reorganize directory structure
- **Multiple file selection** support (planned)
- **Cancel operations** by dragging outside valid targets

### Visual Feedback States

CSS states provide clear visual indicators:

- **--dragging**: Applied to nodes being dragged
- **--drop-target**: Applied to valid drop destinations
- **--invalid-drop**: Applied to invalid drop targets
- **Smooth transitions** between states

### Backend File Movement

File movements use robust backend operations:

- **Atomic operations** when supported by the filesystem
- **Error handling** for permission issues
- **Tree refresh** after successful moves
- **Session update** for moved files

## Editor Integration

### Monaco Editor Features

The editor maintains all Monaco capabilities:

- **Syntax highlighting** for all supported languages
- **Code completion** and IntelliSense
- **Multiple cursors** and selection modes
- **Find and replace** functionality
- **Theme integration** with Hibiscus theming system

### File Switching Performance

Tab switching is optimized for speed:

- **Instant content swap** without editor recreation
- **Preserved cursor position** and selection
- **Maintained scroll position** within files
- **Smooth transitions** between files

### Memory Management

The system efficiently manages memory:

- **Buffer cleanup** for closed tabs
- **Lazy loading** for large files
- **Memory leaks prevention** through proper cleanup
- **Optimized data structures** for file tracking

## Keyboard Shortcuts

### Tab Management

- **Ctrl+W**: Close active tab
- **Ctrl+Tab**: Cycle through tabs (planned)
- **Ctrl+Shift+Tab**: Reverse tab cycle (planned)

### File Operations

- **Ctrl+S**: Save current file
- **Ctrl+Shift+S**: Save all open files
- **Ctrl+O**: Open new file (workspace browser)

## File Operations

### Saving Files

Files are saved with multiple mechanisms:

- **Auto-save**: 1-second debounced saving
- **Manual save**: Ctrl+S for immediate save
- **Save all**: Ctrl+Shift+S for all open files
- **Dirty indicators**: Visual feedback for unsaved changes

### File Closing

When closing tabs:

- **Auto-prompt** for unsaved changes
- **Session update** removes closed files
- **Buffer cleanup** frees memory
- **Tab reordering** maintains sequence

## Error Handling

### File System Errors

The system handles various error conditions:

- **Permission denied** when moving files
- **File not found** during restoration
- **Disk full** scenarios
- **Network drive** connectivity issues

### Session Recovery

Session persistence includes error recovery:

- **Corrupted session** fallback to empty state
- **Missing files** gracefully skipped
- **Partial restoration** for available files
- **Error logging** for debugging

## Development Notes

### Architecture Decisions

Key design choices in the implementation:

- **Ordered list + Map** combination for performance
- **Monaco model swapping** instead of component remounting
- **Native DnD API** instead of external libraries
- **Debounced session saving** for performance
- **Clean SVG icons** instead of emoji for consistency

### Performance Optimizations

Several optimizations ensure smooth operation:

- **O(1) file content lookup** using Map data structure
- **Minimal re-renders** through careful state management
- **Efficient tab scrolling** with native browser optimization
- **Background session persistence** without blocking UI

### Future Enhancements

Planned improvements for the multi-file editor:

- **Tab grouping** and organization
- **Split-screen editing** with multiple panes
- **Tab pinning** for frequently used files
- **Recent files** quick access
- **File templates** and quick creation
