# Hibiscus 🌺

**Hibiscus** is a specialized workspace and code editor designed for **students and academic developers**.

It bridges the gap between a lightweight code editor and a dedicated study planner, allowing you to manage your coursework, coding projects, and exam schedules in a single, distraction-free environment. By integrating file management with time management, Hibiscus reduces context switching and keeps your focus where it belongs.

![Hibiscus UI](public/Hibiscus%20v0.3.7.png)

## ✨ Features

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

## Contributing

As a sole dev working on this project; and being highly passionate about it; I happily welcome contributions! Please follow these steps:

1. **Fork** the repository.
2. **Clone** your fork locally.
3. Create a **Feature Branch** (`git checkout -b feature/AmazingFeature`).
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5. Push to the branch (`git push origin feature/AmazingFeature`).
6. Open a **Pull Request**.

### Guidelines

- **Code Style**: formatting is handled by Prettier (Frontend) and `cargo fmt` (Backend).
- **Correctness**: Ensure no regressions in existing features (File tree, Save logic).
- **Persistence**: If adding new data features, follow the pattern in `src-tauri/src/commands.rs` for safe atomic writes.

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0).
See the LICENSE file for details.

[Mozilla Public License 2.0 (MPL-2.0)](LICENSE)

## Author

Andrew Fernandes
