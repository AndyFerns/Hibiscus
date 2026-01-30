# Hibiscus 🌺

**Hibiscus** is a specialized workspace and code editor designed for **students and academic developers**.

It bridges the gap between a lightweight code editor and a dedicated study planner, allowing you to manage your coursework, coding projects, and exam schedules in a single, distraction-free environment. By integrating file management with time management, Hibiscus reduces context switching and keeps your focus where it belongs.

![Hibiscus UI](https://via.placeholder.com/800x450?text=Hibiscus+UI+Preview) *(Replace with actual screenshot)*

## ✨ Key Features

### Intelligent Study Planner

The integrated right-panel is built specifically for academic workflows:

- **Contextual File Linking**: Directly link lecture notes (`.md`) or project files to calendar events. Clicking "Physics Final" instantly opens your review notes in the editor.
- **Academic Categorization**: Native support for **Exams** (Red), **Assignments** (Orange), and **Study Sessions** (Blue) so you can visualize your workload at a glance.
- **Daily Focus View**: A split-pane "Today" view that filters out noise, showing only today's schedule and immediate tasks.
- **Integrated Checklists**: Manage daily to-dos within the same interface as your code.

### Performance & Core

- **Native Speed**: Powered by a **Rust** backend (Tauri v2) for instant startup and minimal resource usage.
- **Monaco Editor**: The same robust editing engine as VS Code, supporting syntax highlighting and modern features.
- **Recursive File Tree**: Fast, native filesystem explorer with real-time watching.
- **Data Persistence**: Your calendar data stays local in your workspace (`.hibiscus/calendar.json`), ensuring privacy and portability.

## �️ Project Architecture

Hibiscus follows a clean separation of concerns:

### `src/` (Frontend - React + Vite)

- **`components/RightPanel/`**: Contains the Calendar logic, `EventModal` form, and `DailyPlanner` components.
- **`components/Editor/`**: Wrapper around Monaco Editor.
- **`hooks/useCalendarController.ts`**: The brain of the planner; handles CRUD operations and auto-saving to disk.
- **`layout/`**: Grid-based workbench layout system.

### `src-tauri/` (Backend - Rust)

- **`commands.rs`**: Secure, atomic file I/O operations and calendar data persistence.
- **`watcher.rs`**: Efficient filesystem monitoring using `notify`.
- **`tree.rs`**: Algorithms for building directory trees suitable for UI rendering.

## 🚀 Getting Started

Follow these steps to set up the development environment.

### 1. Prerequisites

Ensure you have the following installed:

- **Node.js** (v18+)
- **Rust** (Stable) via [rustup.rs](https://rustup.rs/)
- **C++ Build Tools** (Platform specific: VS Build Tools for Windows, Xcode for macOS)

### 2. Setup

#### **Clone the repository**

```bash
git clone https://github.com/yourusername/hibiscus.git
cd hibiscus
```

#### **Install dependencies**

```bash
npm install
```

#### 3. Run Locally

Start the app in development mode with hot-reloading:

```bash
npm run tauri dev
```

> This command starts the Vite dev server and the Tauri wrapper application simultaneously with hot-reload enabled.

## 🤝 Contributing

As a sole dev working on this project, I happily welcome contributions! Please follow these steps:

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

## 📄 License

[MIT License](LICENSE)

## Author

Andrew Fernandes
