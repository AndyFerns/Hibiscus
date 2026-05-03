# Workbench Layout System

The **Workbench** is Hibiscus's core layout component that provides an IDE-style panel system. It organizes the interface into distinct zones: top, left, main, right, and bottom.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           TOP (Title Bar)                             │
├──────────────────┬──────────────────────────┬─────────────────────────┤
│                  │                          │                         │
│                  │                          │                         │
│     LEFT         │          MAIN            │        RIGHT            │
│   (Explorer)     │        (Editor)          │    (Calendar/Study)     │
│                  │                          │                         │
│                  │                          │                         │
│                  │                          │                         │
├──────────────────┴──────────────────────────┴─────────────────────────┤
│                         BOTTOM (Status Bar)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Panel Zones

### Top Panel

**Purpose**: Application chrome and global controls

**Contains:**
- **TitleBar**: Custom window frame (Tauri)
- **Menu System**: File, Edit, View, Tools menus
- **Window Controls**: Minimize, Maximize, Close (platform-specific)
- **App Info**: Logo, version indicator

**Height**: Fixed ~32px (platform-dependent)

**Behavior:**
- Always visible
- Cannot be hidden
- Adapts to OS (Windows/macOS/Linux styles)

---

### Left Panel

**Purpose**: File navigation and workspace exploration

**Contains:**
- **TreeView**: File/folder hierarchy
- **Tree Header**: New file/folder buttons
- **Breadcrumbs**: Current path (planned)

**Width**: Resizable (default: 250px, min: 150px, max: 500px)

**Behavior:**
- Toggle visibility: `Ctrl+B`
- Hidden in Focus Mode (optional setting)
- Persists width across sessions
- Can be completely hidden

---

### Main Panel

**Purpose**: Primary work area for editing and viewing content

**Contains:**
- **TabBar**: Open file tabs
- **EditorView**: Monaco editor instance
- **KnowledgeGraphView**: Graph visualization (alternative view)
- **Placeholder**: Empty state when no file open

**Behavior:**
- Always visible (center of attention)
- Switches between Editor and Graph views
- Expands when side panels hidden
- Maintains aspect ratio

---

### Right Panel

**Purpose**: Study tools, calendar, and supplementary views

**Contains:**
- **CalendarView**: Monthly calendar with events
- **DailyPlanner**: Task list for selected date
- **EventModal**: Event creation/editing
- **PomodoroPanel**: Timer controls
- **FlashcardPanel**: Flashcard study interface
- **StatsPanel**: Study statistics
- **NotesSynthesizer**: Document combiner
- **SearchPanel**: Knowledge search interface
- **BacklinksPanel**: Note connections

**Width**: Resizable (default: 350px, min: 280px, max: 600px)

**Behavior:**
- Toggle visibility: `Ctrl+J`
- Tabbed interface for tools
- Persists active tab across sessions
- Can show/hide specific tabs via settings

---

### Bottom Panel

**Purpose**: Status information and quick controls

**Contains:**
- **StatusBar**: Workspace info, cursor position, controls
- **LayoutToggle**: Panel visibility buttons
- **ThemeSelector**: Quick theme switcher
- **PomodoroTimer**: Mini timer widget

**Height**: Fixed ~28px

**Behavior:**
- Always visible
- Cannot be hidden
- Information updates in real-time

---

## Responsive Behavior

### Minimum Window Size

```
Minimum: 800px × 600px
```

Below minimum:
- Horizontal scrolling in panels
- Compressed layouts
- Essential controls remain accessible

### Panel Resizing

**Resizable Panels:** Left, Right

**Resize Behavior:**
- Drag panel border to resize
- Snap to content width (double-click border)
- Respect minimum/maximum constraints
- Persist size to workspace.json

### Collapse States

```
Full Layout:
├─[Left]┤├──────────[Main]──────────┤├─[Right]┤

Left Collapsed:
├────────────────[Main]───────────────┤├─[Right]┤

Right Collapsed:
├─[Left]┤├────────────────[Main]───────────────┤

Both Collapsed:
├──────────────────────[Main]──────────────────┤

Focus Mode:
├──────────────────────[Main]──────────────────┤
  (Title and status bar still visible)
```

---

## Focus Mode

**Activation:**
- Menu: View → Focus Mode
- Shortcut: `Ctrl+Shift+F`
- Auto-activate with Pomodoro (setting)

**Behavior:**
```
Normal Mode → Focus Mode:
- Left panel:    Visible → Hidden
- Right panel:   Visible → Hidden  
- Main panel:    60% width → 100% width
- Status bar:    Visible → Visible (with Focus indicator)
- Title bar:     Visible → Visible
```

**Settings:**
```json
{
  "general": {
    "focusModeHidesExplorer": true,
    "focusModeAutoStart": false
  }
}
```

---

## Panel State Persistence

Workspace state is saved to `.hibiscus/workspace.json`:

```json
{
  "session": {
    "show_left_panel": true,
    "show_right_panel": false,
    "left_panel_width": 250,
    "right_panel_width": 350,
    "center_view": "editor"
  }
}
```

**Persistence Triggers:**
- Panel resize (debounced 500ms)
- Panel toggle
- Window close
- Manual save (`Ctrl+Shift+S`)

---

## Implementation Details

### CSS Grid Layout

```css
.workbench {
  display: grid;
  grid-template-areas:
    "top    top    top"
    "left   main   right"
    "bottom bottom bottom";
  grid-template-rows: auto 1fr auto;
  grid-template-columns: auto 1fr auto;
  height: 100vh;
  overflow: hidden;
}
```

### Panel Components

Each panel zone accepts a React element:

```typescript
interface WorkbenchProps {
  top: React.ReactNode      // TitleBar
  left?: React.ReactNode    // TreeView (optional)
  main: React.ReactNode     // Editor area
  right?: React.ReactNode   // RightPanel (optional)
  bottom: React.ReactNode   // StatusBar
  showRightPanel?: boolean  // Right panel visibility
}
```

---

## Keyboard Navigation

### Panel Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle left panel |
| `Ctrl+J` | Toggle right panel |
| `Ctrl+Shift+F` | Toggle focus mode |
| `Ctrl+G` | Toggle editor/graph view |

### Focus Management

- `F6`: Cycle focus between panels
- `Esc`: Return focus to editor
- `Ctrl+0`: Focus file explorer
- `Ctrl+1-9`: Focus specific tab

---

## Customization

### Panel Sizes

Users can customize default sizes in Settings:

```json
{
  "layout": {
    "leftPanelWidth": 250,
    "rightPanelWidth": 350,
    "defaultCenterView": "editor"
  }
}
```

### Panel Visibility

Choose which panels appear:

- Show/hide left panel by default
- Show/hide right panel by default
- Remember last state or use defaults

---

## Screenshots

*[PHOTO PLACEHOLDER: Full Workbench Layout]*
*Add screenshot showing all panels visible: left tree, center editor, right calendar, top title bar, bottom status bar*

*[PHOTO PLACEHOLDER: Focus Mode]*
*Add screenshot showing focus mode with only editor visible*

*[PHOTO PLACEHOLDER: Knowledge Graph View]*
*Add screenshot showing workbench with knowledge graph in main panel*

---

## Troubleshooting

### Panel Not Showing

1. Check `showLeftPanel` / `showRightPanel` state
2. Verify panel content is not null
3. Try toggling with keyboard shortcut
4. Check for CSS `display: none` overrides

### Resize Not Working

1. Ensure mouse events not captured by iframe/content
2. Check resize handle element exists
3. Verify not at min/max width constraints
4. Try resizing window first

### Layout Broken

1. Check CSS grid properties
2. Verify no negative margins
3. Ensure all panels have defined sizes
4. Restart Hibiscus

### Focus Mode Stuck

1. Toggle with `Ctrl+Shift+F`
2. Disable auto-focus in settings
3. Reset workspace state
4. Check for JavaScript errors

---

## Related Documentation

- [Multi-File Editor](multi-file-editor.md) - Main panel content
- [File Tree](file-tree.md) - Left panel content
- [Calendar](calendar.md) - Right panel content
- [Study Tools](study-tools.md) - Right panel tools
- [Status Bar](status-bar.md) - Bottom panel content
