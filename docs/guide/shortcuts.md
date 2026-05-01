# Keyboard Shortcuts

Hibiscus is designed for keyboard-centric power users. Using the integrated `useKeyboardShortcuts` tracking architecture, the following global shortcuts are universally available regardless of your focus state in the app.

## Global Navigation

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Description |
| :--- | :--- | :--- | :--- |
| **Open Workspace** | `Ctrl + O` | `Cmd + O` | Prompts native OS folder selection to change the active root workspace. |
| **Toggle File Explorer** | `Ctrl + B` | `Cmd + B` | Collapses or expands the Left Panel containing the `TreeView`. |
| **Toggle Right Panel** | `Ctrl + J` | `Cmd + J` | Collapses or expands the Right Panel containing study tools. |
| **Open Search** | `Ctrl + Shift + F` | `Cmd + Shift + F` | Opens right panel if collapsed and switches to search tab. |
| **Open Pomodoro** | `Ctrl + Alt + P` | `Cmd + Alt + P` | Opens right panel and switches to Pomodoro timer. |
| **Toggle Knowledge Graph** | `Ctrl + G` | `Cmd + G` | Switch between editor and knowledge graph view. |
| **Toggle Focus Mode** | `Ctrl + F` (chord) → `M` | `Cmd + F` (chord) → `M` | Enters focus mode by typing Ctrl+F, then M. |
| **Toggle Shortcuts Overlay** | `Ctrl + ?` | `Cmd + ?` | Opens an accessibility modal detailing all mapped hotkeys. |
| **Open Settings** | `Ctrl + ,` | `Cmd + ,` | Opens the application settings modal. |

## Editor Shortcuts (Monaco)

When your cursor is focused inside of main Editor panel, native Monaco shortcuts apply:

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Description |
| :--- | :--- | :--- | :--- |
| **Save File** | `Ctrl + S` | `Cmd + S` | Immediately writes the active buffer to disk, bypassing the 1-second debounce auto-save. |
| **Save All** | `Ctrl + Shift + S` | `Cmd + Shift + S` | Immediately commits all dirty buffers across the workspace to disk. |
| **Command Palette** | `F1` | `F1` | Opens the Monaco command palette. |

## Search Navigation (When Search is Active)

| Action | Shortcut | Description |
| :--- | :--- |
| **Next Result** | `Tab` | Navigate to next search result (auto-opens file) |
| **Previous Result** | `Shift + Tab` | Navigate to previous search result (auto-opens file) |
| **Open Result** | `Enter` or `Space` | Open selected search result at exact location |

## Knowledge Graph Navigation

| Action | Shortcut | Description |
| :--- | :--- |
| **Toggle Graph View** | `Ctrl + G` | Switch between editor and knowledge graph view |
| **Return to Editor** | `Esc` | Exit graph view and return to editor |
| **Navigate to Node** | `Click` | Click any node in graph to open that file |
| **Zoom In/Out** | `Mouse Wheel` | Zoom in and out of the graph view |
| **Pan View** | `Drag` | Click and drag to pan the graph view |

## Study Tools Navigation

| Action | Shortcut | Description |
| :--- | :--- |
| **Pomodoro Start/Stop** | `Space` (when Pomodoro is focused) | Start or pause the current Pomodoro session |
| **Flashcard Navigation** | `Arrow Keys` | Navigate between flashcards in study mode |
| **Flip Card** | `Space` or `Enter` | Flip current flashcard to see answer |
