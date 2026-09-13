<p align="center">
  <img src="docs/assets/logo/128x128.png" width="128" alt="Hibiscus Logo" />
</p>

<h1 align="center">Hibiscus</h1>

---

<p align="center">
  Bridges the gap between a lightweight code editor and a dedicated study planner, allowing you to manage your coursework, coding projects, and exam schedules in a single, distraction-free environment; reducing context switching and keeping your focus where it belongs
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri" />
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/License-MPL--2.0-blue" />
</p>

<p align="center">
  <a href="https://andyferns.github.io/Hibiscus/">Documentation</a>
  ·
  <a href="https://github.com/AndyFerns/Hibiscus/issues">Issues</a>
  ·
  <a href="https://github.com/AndyFerns/Hibiscus">Source</a>
</p>

---

## Why Hibiscus?

Hibiscus combines the flexibility of a lightweight IDE with the structure of a dedicated academic workspace. Instead of juggling note-taking apps, planners, and editors separately, Hibiscus provides a unified local-first environment optimized for focused study and note-making workflows.

<p align="center">
  <img src="./docs/assets/Hibiscus Main Screen updated.png" alt="Hibiscus UI" />
</p>

## Features

- **High Performance**: Powered by a Rust backend for near-instant startup and low memory usage.
- **Workspace Management**: Native file explorer with recursive tree view and collapsible folders.
- **Code Editor**: Integrated Monaco Editor (VS Code core) for a familiar editing experience.
- **Modern Modal System**: Production-grade modals for file/folder creation with validation and keyboard shortcuts.
- **File Menu Operations**: Complete file management including New File/Folder, Open, Save, Save As, and Exit with unsaved changes protection.
- **Calendar & Planner**:
  - Interactive monthly calendar with event indicators.
  - Split-view daily planner and task list.
  - Event types: Exam, Assignment, Study, Reminder.
  - Data persistence to `.hibiscus/calendar.json`.
- **Study Tools Integration**: Pomodoro timer, flashcards, notes synthesis, and study statistics.
- **Theme System**: Dynamic theming with live editor and custom theme support.
- **Custom UI**:
  - Frameless custom window with native-feel controls.
  - Creating a cohesive, modern aesthetic (Glassmorphism inspired).
  - Resizable split-pane layouts.
  - Keyboard shortcuts (Ctrl+N for new file, Ctrl+Shift+N for new folder).
  - Customizable layout to fir user needs

<p align="center">
  <img src="./docs/assets/Hibiscus Graph and Editor.png" alt="Hibiscus Features" />
</p>

## Tech Stack

### Frontend

- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Styling**: Vanilla CSS (Variables, Grid, Flexbox)

### Backend

- **Core**: Tauri v2.0 (Rust)
- **Features**: 
  - Async File I/O (`tokio`)
  - Filesystem Watcher (`notify`)
  - Command System for frontend-backend bridge

## Project Structure

### `src/` (Frontend)

- **`components/`**: Reusable UI components.
  - `Editor/`: Monaco editor wrapper.
  - `Layout/`: Main workbench grid.
  - `RightPanel/`: Calendar and Planner logic.
  - `TitleBar/`: Custom window controls.
  - `TreeView/`: File explorer.
- **`hooks/`**: Custom React hooks for business logic.
  - `useCalendarController`: Manages events, tasks, and persistence.
  - `useWorkspaceController`: Handles file tree and active files.
- **`styles/`**: Global CSS variables and resets.
- **`types/`**: Shared TypeScript definitions.

### `src-tauri/` (Backend)

- **`src/`**: Rust source code.
  - `main.rs`: Application entry point.
  - `lib.rs`: Plugin and command registration.
  - `commands.rs`: Tauri command implementations (File I/O, Calendar).
  - `watcher.rs`: Recursive file watcher logic.
  - `tree.rs`: Directory traversal algorithms.

## Getting Started

### Prerequisites

- **Node.js**: v18 or newer
- **Rust**: Latest stable (install via [rustup](https://rustup.rs/))
- **Build Tools**:
  - **Windows**: Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `build-essential`, `libwebkit2gtk-4.0-dev`, etc. (Check Tauri docs)

### Installation

1. **Clone the repository**:

  ```bash
    git clone https://github.com/AndyFerns/Hibiscus.git
    cd hibiscus
  ```

2. **Install dependencies**:

  ```bash
    npm install
  ```

3. Run Locally

Start the app in development mode with hot-reloading:

```bash
npm run tauri dev
```

This command starts the Vite dev server and the Tauri wrapper application simultaneously with hot-reload enabled.

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0).
See the LICENSE file for details.

[Mozilla Public License 2.0 (MPL-2.0)](LICENSE)

## Privacy

Hibiscus is strictly local-first: your notes, files, calendar, index, and preferences never leave your device. No accounts, no telemetry, no cloud sync. See [PRIVACY.md](PRIVACY.md) for the full policy.

## Author

Andrew Fernandes
