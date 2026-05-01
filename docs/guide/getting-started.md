# Getting Started

Welcome to the **Hibiscus** workspace! This guide will help you install, configure, and get started with your study planner and coding environment.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- Ensure you have the [Tauri OS prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) installed for your specific platform (Windows, macOS, or Linux).

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AndyFerns/Hibiscus.git
   cd Hibiscus
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   You can use the built-in CLI helper script to launch the app:
   ```bash
   node scripts/hibiscus.cjs dev
   ```
   *This command spins up Vite and compiles the Rust backend, opening the native window.*

## Core Concepts

**Hibiscus** operates as a local-first editor. It never syncs your personal notes or code to a cloud environment without your explicit action. 

When you configure a directory as your **workspace**, Hibiscus drops a hidden `.hibiscus` folder there to store:

- `workspace.json`: Your file tree layouts and pinned sessions.
- `calendar.json`: Your study planner tasks and events.
- `backups/`: Rotating timestamped safety backups of your data.

## Next Steps

- Master the [Multi-File Editor](multi-file-editor.md) for efficient workflow management.
- Learn how to navigate the app rapidly with [Keyboard Shortcuts](shortcuts.md).
- Explore the [Knowledge Graph](knowledge-graph.md) to visualize connections between your notes.
- Personalize your editor using [Theming](theming.md).
- Discover powerful search capabilities with the [Search System](search.md).
