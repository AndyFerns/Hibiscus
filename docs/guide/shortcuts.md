# Keyboard Shortcuts

Hibiscus is designed for keyboard-centric power users. Using the integrated `useKeyboardShortcuts` tracking architecture, the following global shortcuts are universally available regardless of your focus state in the app.

## Global Navigation

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Description |
| :--- | :--- | :--- | :--- |
| **Open Workspace** | `Ctrl + O` | `Cmd + O` | Prompts native OS folder selection to change the active root workspace. |
| **Toggle File Explorer** | `Ctrl + B` | `Cmd + B` | Collapses or expands the Left Panel containing the `TreeView`. |
| **Toggle Calendar Planner** | `Ctrl + J` | `Cmd + J` | Collapses or expands the Right Panel containing the study calendar. |
| **Toggle Shortcuts Overlay** | `Ctrl + ?` | `Cmd + ?` | Opens an accessibility modal detailing all mapped hotkeys. |

## Editor Shortcuts (Monaco)

When your cursor is focused inside the main Editor panel, native Monaco shortcuts apply:

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Description |
| :--- | :--- | :--- | :--- |
| **Save File** | `Ctrl + S` | `Cmd + S` | Immediately writes the active buffer to disk, bypassing the 1-second debounce auto-save. |
| **Save All** | `Ctrl + Shift + S` | `Cmd + Shift + S` | Immediately commits all dirty buffers across the workspace to disk. |
| **Command Palette** | `F1` | `F1` | Opens the Monaco command palette. |
