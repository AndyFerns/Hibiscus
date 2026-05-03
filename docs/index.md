# Welcome to Hibiscus

Hibiscus is a highly opinionated, lightning-fast, and elegant local-first study workspace. Built with [React](https://react.dev/), [Tauri](https://tauri.app/), and [Rust](https://www.rust-lang.org/), it seamlessly merges a powerful code editor with deep productivity tools.

![Hibiscus Screen Shot](./assets/Hibiscus%20Screenshot.png)

## Overview

Hibiscus is designed for developers, researchers, and students who need a unified, distraction-free environment to synthesize information. Rather than relying on cloud services, Hibiscus embraces a strict local-first philosophy: your knowledge stays securely on your machine, processed at native speeds by an underlying Rust backend.

## Key Features

- **Blazing Fast Backend**: Powered entirely by Rust and Tauri, offering native performance and minimal resource consumption.
- **Deep Study Tools**: Featuring an integrated Pomodoro timer, native flashcard decks, comprehensive study statistics, and a zero-distraction Focus Mode.
- **Intelligent Knowledge Synthesis**: A built-in document combiner that effortlessly fuses text and markdown documents recursively into cohesive, structured outputs.
- **Local-First Indexing**: A robust background indexing pipeline that makes your entire workspace instantly searchable without ever leaving your machine. Now supports Markdown, Text, PDF, and DOCX documents with advanced TF-IDF ranking.
- **Hot-Swappable Theming**: Enjoy meticulously crafted built-in themes (Midnight, Dawn, Forest) powered by a deeply configurable CSS variable API.
- **Workspace Management**: A fast, reliable file tree equipped with debounce-optimized file watchers for immediate UI synchronization.

## Architecture Summary

At the core of Hibiscus lies a strict separation of concerns:

- **Frontend**: A React application utilizing the Monaco Editor for a world-class text editing experience, styled with a comprehensive dynamic CSS variable system.
- **Backend (Rust)**: Handles all heavy lifting—from file system watching and structural tree generation to robust, incremental knowledge indexing.
- **Knowledge Pipeline**: A background worker pool continuously parses, chunks, and indexes your `.md`, `.txt`, `.pdf`, and `.docx` files into `.hibiscus/knowledge/`. The data is fully derived and rebuildable, guaranteeing that your source files are never mutated. Includes an in-memory LRU caching layer and query engine for blazingly fast retrievals.

## Why Hibiscus?

Hibiscus stands apart by rejecting the trend of bloated, cloud-dependent workspaces. It respects your privacy, your system resources, and your workflow. Whether you're writing code, drafting a research paper, or organizing study notes, Hibiscus provides the tools you need—instantly, locally, and beautifully.

## Quick Start

Ready to dive in? Head over to the [Getting Started Guide](guide/getting-started.md) to set up your environment or download the latest release!

---

## User Documentation

### Core Features
- **[Getting Started](guide/getting-started.md)** - Installation, setup, and core concepts
- **[Workbench Layout](guide/workbench.md)** - Understanding the IDE-style panel system
- **[File Explorer](guide/file-tree.md)** - Navigating and organizing your workspace
- **[Multi-File Editor](guide/multi-file-editor.md)** - Working with tabs and multiple files
- **[Editor System](guide/editor.md)** - Monaco integration and markdown preview

### Productivity Tools
- **[Calendar & Daily Planner](guide/calendar.md)** - Scheduling, events, and task management
- **[Study Tools](guide/study-tools.md)** - Pomodoro, flashcards, notes synthesis, statistics
- **[Search System](guide/search.md)** - Finding content across your workspace
- **[Knowledge Graph](guide/knowledge-graph.md)** - Visualizing note connections
- **[Modal System](guide/modal-system.md)** - File creation dialogs

### Customization
- **[Theming System](guide/theming.md)** - Built-in themes and CSS variables
- **[Theme Editor](guide/theme-editor.md)** - Creating custom color schemes
- **[Status Bar](guide/status-bar.md)** - Layout controls and quick actions
- **[Keyboard Shortcuts](guide/shortcuts.md)** - Complete shortcut reference

### Workflow
- **[Application Flow](guide/flow.md)** - Understanding the Hibiscus workflow

---

## Developer Documentation

### Architecture
- **[System Architecture](dev/architecture.md)** - Frontend/backend design
- **[React Hooks](dev/hooks.md)** - Controller hooks and state management
- **[Icon System](dev/icon-system.md)** - Centralized icon management

### Backend & APIs
- **[API Reference](dev/api-reference.md)** - Complete Tauri command reference
- **[Knowledge Pipeline](dev/knowledge-pipeline.md)** - Indexing system architecture
- **[Knowledge Graph Architecture](dev/knowledge-graph-architecture.md)** - Graph implementation

### Contributing
- **[Contributing Guide](dev/contributing.md)** - Development setup and guidelines

---

## Documentation Overview

| Topic | Guide | Developer |
|-------|-------|-----------|
| Installation | [Getting Started](guide/getting-started.md) | [Contributing](dev/contributing.md) |
| File Management | [File Tree](guide/file-tree.md), [Editor](guide/editor.md) | [API](dev/api-reference.md#file-operations) |
| Calendar | [Calendar](guide/calendar.md) | [API](dev/api-reference.md#calendar-operations) |
| Search | [Search](guide/search.md) | [Pipeline](dev/knowledge-pipeline.md) |
| Knowledge Graph | [User Guide](guide/knowledge-graph.md) | [Architecture](dev/knowledge-graph-architecture.md) |
| Theming | [Theming](guide/theming.md), [Editor](guide/theme-editor.md) | [API](dev/api-reference.md#theme-operations) |
| Study Tools | [Study Tools](guide/study-tools.md) | [Hooks](dev/hooks.md#usepomodoro) |
| Layout | [Workbench](guide/workbench.md), [Status Bar](guide/status-bar.md) | [Hooks](dev/hooks.md) |
