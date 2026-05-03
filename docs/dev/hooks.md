# React Hooks & Controllers

Hibiscus uses a controller pattern where business logic is encapsulated in custom React hooks. This document describes the main hooks that power the application.

---

## Hook Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      App.tsx                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Custom Hooks (Controllers)                │   │
│  ├─────────────┬─────────────┬─────────────┬───────────┤   │
│  │useWorkspace │  useEditor  │  useStudy   │useKnowledge│  │
│  │ Controller  │ Controller  │   Context   │  Index    │   │
│  └─────────────┴─────────────┴─────────────┴───────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              UI Components                          │   │
│  │  TreeView  │  EditorView  │  RightPanel  │  etc.   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## useWorkspaceController

**File**: `src/hooks/useWorkspaceController.ts`

Manages workspace state, file tree, and navigation.

### State

```typescript
interface WorkspaceState {
  workspace: {
    tree: Node[]           // File tree structure
    session: Session | null // Active session data
  }
  workspaceRoot: string | null  // Root directory path
  recentFiles: RecentFile[]     // Recently accessed files
}
```

### Actions

| Action | Description |
|--------|-------------|
| `changeWorkspace()` | Open folder dialog, load new workspace |
| `closeWorkspace()` | Close current workspace |
| `openNode(node)` | Open file/folder from tree |
| `moveNode(source, target)` | Drag-and-drop file movement |
| `openFileDialog()` | Show native file open dialog |

### Usage

```typescript
const {
  workspace,
  workspaceRoot,
  changeWorkspace,
  openNode,
  moveNode,
} = useWorkspaceController()
```

### Backend Integration

Invokes Tauri commands:
- `discover_workspace` - Check for existing workspace
- `load_workspace` - Load workspace.json
- `save_workspace` - Persist session changes
- `build_tree` - Build file tree
- `move_node` - Move files/folders

---

## useEditorController

**File**: `src/hooks/useEditorController.ts`

Manages multi-file editor state, content buffers, and tab system.

### State

```typescript
interface EditorState {
  // Active file
  activeFile: OpenFile | null
  activeFilePath: string | null
  fileContent: string
  fileVersion: number  // Monaco model version
  
  // Multi-file state
  openFiles: OpenFile[]     // Ordered list of open files
  activeFileId: string | null
  
  // Dirty tracking
  dirtyFiles: Set<string>   // Files with unsaved changes
}
```

### Actions

| Action | Description |
|--------|-------------|
| `openFile(node)` | Open file in new tab |
| `switchTab(fileId)` | Switch to existing tab |
| `closeTab(fileId)` | Close tab (prompts if dirty) |
| `onChange(content)` | Handle editor content change |
| `saveCurrentFile()` | Save active file |
| `saveAllFiles()` | Save all dirty files |
| `saveAsFile()` | Save with new name/path |

### Monaco Integration

- Creates/destroys Monaco models per file
- Swaps editor models on tab switch (no remount)
- Tracks dirty state via model change events

### Usage

```typescript
const {
  activeFile,
  fileContent,
  openFiles,
  activeFileId,
  onChange,
  saveCurrentFile,
  switchTab,
  closeTab,
  buffersRef,  // For knowledge index access
} = useEditorController(workspaceRoot)
```

---

## useKeyboardShortcuts

**File**: `src/hooks/useKeyboardShortcuts.ts`

Centralized keyboard shortcut management with single event listener.

### Configuration

```typescript
interface ShortcutConfig {
  onOpenFolder?: () => void
  onToggleLeftPanel?: () => void
  onToggleRightPanel?: () => void
  onToggleFocusMode?: () => void
  onOpenSearch?: () => void
  onOpenPomodoro?: () => void
  onOpenSettings?: () => void
  onToggleShortcutOverlay?: () => void
  onToggleMarkdownPreview?: () => void
  onToggleGraphView?: () => void
}
```

### Important: Single Instance

**CRITICAL**: Only ONE `useKeyboardShortcuts` call per app. Multiple instances register duplicate listeners causing:
- Shortcuts firing twice
- Interference between handlers
- `preventDefault` issues

### Usage

```typescript
// In App.tsx only:
useKeyboardShortcuts({
  onOpenFolder: changeWorkspace,
  onToggleLeftPanel: toggleLeftPanel,
  onToggleFocusMode: toggleFocusMode,
  // ... other handlers
})
```

### Shortcut Map

| Shortcut | Handler |
|----------|---------|
| `Ctrl+O` | `onOpenFolder` |
| `Ctrl+B` | `onToggleLeftPanel` |
| `Ctrl+J` | `onToggleRightPanel` |
| `Ctrl+Shift+F` | `onOpenSearch` |
| `Ctrl+Alt+P` | `onOpenPomodoro` |
| `Ctrl+,` | `onOpenSettings` |
| `Ctrl+?` | `onToggleShortcutOverlay` |
| `Ctrl+G` | `onToggleGraphView` |

---

## useKnowledgeIndex

**File**: `src/features/knowledge/useKnowledgeIndex.ts`

Client-side knowledge graph indexing with incremental updates.

### State

```typescript
interface KnowledgeIndex {
  notes: Map<string, IndexedNote>    // path -> parsed note
  backlinks: Map<string, string[]>   // path -> incoming links
  version: number                    // For memoization
}
```

### Indexed Data

Each note contains:
- `path`: File path
- `name`: Display name (from filename)
- `links`: Array of `[[wiki-links]]`
- `tags`: Array of `#hashtags`

### Actions

| Action | Description |
|--------|-------------|
| `updateNote(path, content)` | Re-parse single note |
| `deleteNote(path)` | Remove note from index |
| `renameNote(oldPath, newPath)` | Update path reference |

### Parsing

Uses regex extraction:
```typescript
const LINK_RE = /\[\[(.*?)\]\]/g    // [[wiki-links]]
const TAG_RE = /(^|\s)#([a-zA-Z0-9\-_]+)/g  // #tags
```

### Integration

```typescript
const { index, updateNote } = useKnowledgeIndex(
  workspace.tree,    // File tree for initial scan
  buffersRef       // Editor buffers for live content
)

// Build graph data
const knowledgeGraph = useMemo(
  () => buildGraph(index),
  [index.version]
)
```

---

## usePomodoro

**File**: `src/features/pomodoro/usePomodoro.ts`

Pomodoro timer with focus mode integration.

### State

```typescript
interface PomodoroState {
  phase: "work" | "short_break" | "long_break"
  timeRemaining: number      // Seconds
  isRunning: boolean
  sessionsCompleted: number
  totalSessions: number
}
```

### Actions

| Action | Description |
|--------|-------------|
| `start()` | Start timer |
| `pause()` | Pause timer |
| `reset()` | Reset to initial phase time |
| `skip()` | Skip to next phase |

### Configuration

```typescript
interface PomodoroConfig {
  workDuration: number        // Default: 25 min
  shortBreakDuration: number  // Default: 5 min
  longBreakDuration: number   // Default: 15 min
  sessionsBeforeLongBreak: number  // Default: 4
  autoStartBreaks: boolean
  autoStartPomodoros: boolean
}
```

### Callbacks

```typescript
const [state, actions] = usePomodoro({
  settings: config,
  onFocusMode: setFocusMode,      // Auto-toggle focus mode
  onSessionComplete: recordSession  // Log to statistics
})
```

---

## useFlashcards

**File**: `src/features/flashcards/useFlashcards.ts`

Flashcard deck management with persistence.

### State

```typescript
interface FlashcardsState {
  decks: FlashcardDeck[]
  activeDeckId: string | null
  currentCardIndex: number
  isFlipped: boolean
}
```

### Actions

| Action | Description |
|--------|-------------|
| `addDeck(name)` | Create new deck |
| `deleteDeck(id)` | Remove deck |
| `addCard(front, back)` | Add card to active deck |
| `deleteCard(deckId, cardId)` | Remove specific card |
| `nextCard()` | Navigate forward |
| `prevCard()` | Navigate backward |
| `flip()` | Toggle card face |
| `shuffle()` | Randomize deck order |

### Persistence

Automatically saves to `.hibiscus/study/flashcards.json`

---

## useNotesSynthesis

**File**: `src/features/notes/useNotesSynthesis.ts`

Document combiner for merging multiple files.

### State

```typescript
interface NotesState {
  selectedFiles: string[]     // Paths to include
  preview: string | null      // Generated preview
  isGenerating: boolean
}
```

### Actions

| Action | Description |
|--------|-------------|
| `addFile(path)` | Include file in synthesis |
| `removeFile(path)` | Exclude file |
| `generatePreview()` | Create merged document preview |
| `saveOutput(filename)` | Save to workspace |
| `clear()` | Reset selection |

### Supported Formats

- `.md` - Markdown (strips redundant H1s)
- `.txt` - Plain text
- `.pdf` - Text extraction (planned)
- `.docx` - Document parsing (planned)

---

## useStudyStats

**File**: `src/features/stats/useStudyStats.ts`

Study session tracking with analytics.

### State

```typescript
interface StatsState {
  data: {
    sessions: StudySession[]
  }
  totalStudyMinutes: number
  totalSessions: number
  currentStreak: number        // Consecutive days
  avgDailyMinutes: number
}
```

### Session Structure

```typescript
interface StudySession {
  id: string
  date: string        // ISO date
  startTime: string   // ISO datetime
  duration: number    // Seconds
  type: "pomodoro" | "manual"
  completedFull: boolean
}
```

### Actions

| Action | Description |
|--------|-------------|
| `recordSession(session)` | Log completed session |
| `deleteSession(id)` | Remove session |
| `getDailyAggregates(days)` | Get chart data |

### Persistence

Saved to `.hibiscus/study/stats.json` via `save_study_data` command.

---

## useSettings

**File**: `src/features/settings/useSettings.ts`

Application settings with dual persistence (local + backend).

### Settings Structure

```typescript
interface Settings {
  general: {
    focusModeHidesExplorer: boolean
    autoSave: boolean
    showLineNumbers: boolean
  }
  pomodoro: PomodoroConfig
  editor: {
    fontSize: number
    fontFamily: string
    tabSize: number
    wordWrap: boolean
  }
}
```

### Persistence Strategy

1. **Immediate**: Update local React state
2. **Debounced**: Save to backend (1s delay)
3. **Atomic**: Write to `settings.json`

### Actions

| Action | Description |
|--------|-------------|
| `updateSettings(path, value)` | Update nested setting |
| `resetToDefaults()` | Restore all defaults |

---

## Hook Interactions

### Data Flow

```
User Action
    ↓
UI Component
    ↓
Custom Hook (Controller)
    ↓
Tauri Invoke / Local State
    ↓
Backend / File System
```

### Hook Dependencies

```
useWorkspaceController
    ↓ (provides workspaceRoot)
useEditorController
    ↓ (provides buffersRef)
useKnowledgeIndex

useStudy (Context)
    ↓
usePomodoro, useFlashcards, useNotesSynthesis, useStudyStats
```

---

## Testing Hooks

Hooks are designed for testability:

```typescript
// Example: Testing usePomodoro
test('timer counts down', () => {
  const { result } = renderHook(() => usePomodoro({
    settings: { workDuration: 25 }
  }))
  
  act(() => {
    result.current[1].start()
  })
  
  expect(result.current[0].isRunning).toBe(true)
})
```

---

## Related Documentation

- [Architecture](architecture.md) - System design
- [API Reference](api-reference.md) - Backend commands
- [Contributing](contributing.md) - Code guidelines
