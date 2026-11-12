# Editor System

Hibiscus features a powerful Monaco-based editor with support for syntax highlighting, multiple files, markdown preview, and seamless theme integration.

---

## Editor View

The **EditorView** component wraps Microsoft's Monaco Editor with Hibiscus-specific enhancements:

### Core Features

- **Syntax Highlighting**: 50+ languages supported
- **Auto-completion**: IntelliSense for many languages
- **Error Diagnostics**: Real-time error highlighting
- **Multiple Cursors**: Alt+Click for multi-cursor editing
- **Find & Replace**: Ctrl+F / Ctrl+H
- **Minimap**: Code overview (toggle in settings)
- **Line Numbers**: Toggleable gutter display
- **Word Wrap**: Soft wrapping for long lines

### Editor Layout

```
┌─────────────────────────────────────────────────────┐
│ Tab Bar (open files)                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1 │  # Heading                     │               │
│  2 │  Content here...              │  ┌─────────┐  │
│  3 │  - List item 1                │  │ Preview │  │
│  4 │  - List item 2                │  │ Panel   │  │
│  5 │                                │  │ (50%)   │  │
│  6 │  ## Section 2                  │  │         │  │
│  7 │  More content...              │  │         │  │
│    │                                │  └─────────┘  │
│    │  [Editor: 50%]   [Preview: 50%]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## File Renderer

The **FileRenderer** component handles different file types:

### Supported Formats

| Type | Extension | Rendering Mode |
|------|-----------|----------------|
| Markdown | `.md`, `.markdown` | Editor + Live preview |
| Text | `.txt` | Editor with syntax highlight |
| Code | `.js`, `.ts`, `.py`, `.rs`, etc. | Editor with syntax highlight |
| PDF | `.pdf` | Virtualized paginated viewer |
| DOCX | `.docx` | Paginated document viewer |
| PPTX | `.pptx` | Slide-by-slide viewer |
| Images | `.png`, `.jpg`, `.gif`, `.webp`, `.bmp`, `.ico`, `.svg` | Image viewer (zoom, pan) |

#### Binary Document Viewers (PDF, DOCX, PPTX, images)

These files are **read-only** in Hibiscus. They open in a dedicated viewer rather than Monaco.

**Shared toolbar:**
- Page or slide navigation (type a number, or use PgUp/PgDn and Home/End)
- Zoom (buttons, Ctrl + wheel, Ctrl `+` / `-`), with fit width (Ctrl `0`) and fit page
- A thumbnails toggle (PDF) and **Extract to Note** (PDF and DOCX)
- Hibiscus remembers your last page and zoom for each file

**Integrity check:** before anything is rendered, the backend `inspect_document` command does the following:
- hashes the file
- detects its real type
- looks for damage: a truncated PDF, a broken or incomplete zip, missing Office parts, or a file whose content doesn't match its extension

The viewer then re-hashes the bytes it received and compares the two hashes. A damaged file shows an explanation with **Retry**, **Try to open anyway** and **Show in folder**, instead of a blank page.

**PDF viewer:**
- Only the pages on screen, plus two either side, are rendered. Large PDFs scroll smoothly and memory use stays flat.
- Page sizes are known up front, so the scrollbar is accurate and nothing jumps while pages render.
- Thumbnails are optional and also virtualized.
- CJK text and the standard PDF fonts render correctly (pdf.js character maps and fonts ship with the app).
- When the file changes on disk it is re-checked, and only reloaded if its content actually changed.

**DOCX viewer:**
- Renders real pages with headers, footers and footnotes via `docx-preview`.
- Embedded raw HTML and comments are not rendered. Links open in your system browser, and bookmarks scroll within the document.

**PPTX viewer:**
- Shows one slide at a time, scaled to fit the pane. Use the slide strip at the bottom, or the arrow keys, to move between slides.

**Image viewer:**
- Fit to pane or actual size, zoom, and drag to pan. A checkerboard background shows transparency.
- SVGs are displayed as images, so any scripts inside them never run.

#### Why binary files are read-only

Monaco is kept mounted and hidden at all times (it must never unmount, to avoid the persistent corruption bug). This means it is bound to whatever buffer is in memory for the active file, including the empty placeholder for PDFs and DOCX files. Multiple code paths in `useEditorController` could previously reach `write_text_file` with that empty buffer — silently zeroing the document:

- Auto-save (1 s debounce after any `onChange` event, even from Monaco while hidden)
- "Save As" (wrote the buffer instead of copying bytes)
- Unmount handler (flushed all dirty buffers)
- Session restore (reloaded all paths as text, discarding the binary file's tab)

Every one of these paths now checks `isBinaryFile(path)` and bails out early. `copy_file` is used for binary Save As. Regression tests in `tests/binaryFileSafety.test.ts` cover all failure modes.

### Markdown Preview

Toggle markdown preview with `Ctrl+Shift+V`:

**Features:**
- Live preview updates as you type
- GitHub-flavored Markdown support
- Syntax highlighting in code blocks
- Task list checkboxes clickable
- Links clickable (internal and external)

**Preview Features:**
- Scroll sync (editor ↔ preview) (planned)
- Export to HTML (planned)
- Print-friendly styling

#### Extract to Note

The **"Extract to Note"** button in the document toolbar triggers the `extract_document_to_note` Tauri command. It runs the full knowledge parser (same one the indexer uses) and writes a structured Markdown file alongside the original document:

```
document.pdf         →   document-note.md   (or document-note-2.md if that exists)
research.docx        →   research-note.md
```

The resulting note has YAML frontmatter recording the source path, and the body preserves the heading structure extracted from the document (page numbers for PDFs, Word heading styles for DOCX). The indexer picks it up immediately as a regular note, making it searchable, linkable, and visible in the graph. This is the recommended path if you need to add wiki-links or annotations to a PDF or DOCX — edit the note, not the original.

---

### File Loading States

```
Loading...     → Reading file from disk
Parsing...     → Determining file type
Rendering...   → Setting up editor model
Ready          → Editor ready for input
```

---

## Monaco Integration

### Editor Configuration

The editor is configured via `editorConfig.ts`:

```typescript
export const defaultEditorOptions = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  minimap: { enabled: true },
  wordWrap: "on",
  lineNumbers: "on",
  automaticLayout: true,
  scrollBeyondLastLine: false,
  renderWhitespace: "selection",
  tabSize: 2,
  insertSpaces: true,
}
```

### Theme Adaptation

Monaco themes are dynamically generated from Hibiscus CSS variables:

**Process:**
1. Read CSS variables from `:root`
2. Convert to Monaco theme format
3. Apply via `editor.defineTheme()`
4. Update when Hibiscus theme changes

**Example Adaptation:**
```typescript
// CSS variables → Monaco theme
const theme = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: css.textPrimary },
    { token: "comment", foreground: css.textMuted },
    { token: "keyword", foreground: css.accent },
  ],
  colors: {
    "editor.background": css.bgPrimary,
    "editor.foreground": css.textPrimary,
    "editor.lineHighlightBackground": css.bgSecondary,
  }
}
```

---

## Tab Bar Integration

The editor works seamlessly with the tab bar:

### Tab States

- **Clean**: No unsaved changes
- **Dirty**: Unsaved modifications (dot indicator)
- **Active**: Currently visible tab
- **Background**: Open but not visible

### Model Management

Monaco uses a model-per-file system:

1. **File Opened**: Model created from file content
2. **Tab Switched**: Editor swaps to new model (instant)
3. **File Closed**: Model disposed to free memory
4. **File Saved**: Model marked as clean

### Performance

- **No Remounting**: Editor component persists across tab switches
- **Lazy Loading**: Models created only when files opened
- **Memory Cleanup**: Closed file models disposed
- **Cursor Restoration**: Position restored when reopening files

---

## Auto-Save

Hibiscus features intelligent auto-save:

### Save Behavior

- **Auto-save**: 1-second debounce after typing stops
- **Manual Save**: Ctrl+S for immediate save
- **Save All**: Ctrl+Shift+S for all dirty files
- **Dirty Indicator**: Dot in tab shows unsaved changes

### Save Strategy

Files are saved atomically to prevent corruption:

```
1. Write to temp file: .filename.hibiscus-save~
2. Sync to disk
3. Delete original (Windows)
4. Rename temp to original
5. Cleanup on any failure
```

---

## Keyboard Shortcuts

### Editor Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |
| `Ctrl+Shift+S` | Save all files |
| `Ctrl+F` | Find in file |
| `Ctrl+H` | Replace in file |
| `Ctrl+G` | Go to line |
| `Ctrl+/` | Toggle line comment |
| `Ctrl+D` | Select next occurrence |
| `Ctrl+L` | Select current line |
| `Alt+↑/↓` | Move line up/down |
| `Ctrl+Shift+K` | Delete current line |
| `Ctrl+Space` | Trigger autocomplete |
| `F1` | Command palette |

### Monaco Shortcuts

Standard Monaco shortcuts work:

- **Multi-cursor**: Alt+Click
- **Column selection**: Alt+Shift+Drag
- **Expand selection**: Shift+Alt+→
- **Shrink selection**: Shift+Alt+←

---

## Cursor Position Tracking

The editor tracks cursor position for the status bar:

```typescript
interface CursorPosition {
  line: number      // 1-indexed line number
  column: number    // 1-indexed column number
}
```

**Status Bar Display:**
```
Ln 42, Col 7
```

---

## File Change Detection

### External Changes

When a file is modified outside Hibiscus:

1. File watcher detects change
2. Compare SHA-256 hash
3. If different, mark as "modified externally"
4. User chooses: Reload | Keep current | Merge (planned)

### Conflict Resolution

For conflicts between disk and buffer:

```
┌─────────────────────────────────────────┐
│  File Changed on Disk                   │
├─────────────────────────────────────────┤
│  "notes.md" was modified by another     │
│  program. What would you like to do?   │
│                                          │
│  [Keep Current]  [Reload from Disk]      │
└─────────────────────────────────────────┘
```

---

## Error Handling

### File Read Errors

- **Permission Denied**: Show error notification
- **File Not Found**: Remove from tree/session
- **Binary File**: Open in hex viewer (planned)
- **Too Large**: Warn and offer read-only mode

### Editor Errors

- **Parse Errors**: Highlight in editor
- **Save Errors**: Show error, keep dirty state
- **Model Errors**: Recreate model from file

---

## Screenshots

*[PHOTO PLACEHOLDER: Editor with Markdown Preview]*
*Add screenshot showing split view with editor on left and markdown preview on right*

*[PHOTO PLACEHOLDER: Syntax Highlighting]*
*Add screenshot showing code editor with syntax highlighting for a programming language*

*[PHOTO PLACEHOLDER: Editor in Focus Mode]*
*Add screenshot showing editor taking full width in focus mode*

---

## Troubleshooting

### Editor Not Loading

1. Check Monaco loader initialized
2. Verify no JavaScript errors in console
3. Try restarting Hibiscus

### Preview Not Showing

- Only works for markdown files
- Check `showMarkdownPreview` setting
- Toggle with `Ctrl+Shift+V`

### Slow Performance

- Disable minimap for large files
- Turn off word wrap for code files
- Close unused tabs to free memory

### Theme Not Applied

- Editor themes sync with Hibiscus theme
- Restart may be needed after theme change
- Check CSS variables are properly defined

---

## Related Documentation

- [Multi-File Editor](multi-file-editor.md) - Tab management
- [Theming System](theming.md) - Editor color schemes
- [Keyboard Shortcuts](shortcuts.md) - Complete shortcut reference
