# Welcome to Hibiscus

Hibiscus is a highly opinionated, lightning-fast, and elegant local-first study workspace. Built with [React](https://react.dev/), [Tauri](https://tauri.app/), and [Rust](https://www.rust-lang.org/), it seamlessly merges a powerful code editor with deep productivity tools.

![Hibiscus Screen Shot](./assets/Hibiscus%20Screenshot.png)

## Overview

Hibiscus is designed for developers, researchers, and students who need a unified, distraction-free environment to synthesize information. Rather than relying on cloud services, Hibiscus embraces a strict local-first philosophy: your knowledge stays securely on your machine, processed at native speeds by an underlying Rust backend.

## Key Features

- **Blazing Fast Backend**: Powered entirely by Rust and Tauri, offering native performance and minimal resource consumption.
- **Deep Study Tools**: Featuring an integrated Pomodoro timer, native flashcard decks, comprehensive study statistics, and a zero-distraction Focus Mode.
- **Intelligent Knowledge Synthesis**: A built-in document combiner that effortlessly fuses text and markdown documents recursively into cohesive, structured outputs.
- **Local-First Indexing**: A robust background indexing pipeline that makes your entire workspace instantly searchable without ever leaving your machine.
- **Hot-Swappable Theming**: Enjoy meticulously crafted built-in themes (Midnight, Dawn, Forest) powered by a deeply configurable CSS variable API.
- **Workspace Management**: A fast, reliable file tree equipped with debounce-optimized file watchers for immediate UI synchronization.

## Architecture Summary

At the core of Hibiscus lies a strict separation of concerns:

- **Frontend**: A React application utilizing the Monaco Editor for a world-class text editing experience, styled with a comprehensive dynamic CSS variable system.
- **Backend (Rust)**: Handles all heavy lifting—from file system watching and structural tree generation to robust, incremental knowledge indexing.
- **Knowledge Pipeline**: A background worker pool continuously parses, chunks, and indexes your `.md` and `.txt` files into `.hibiscus/knowledge/`. The data is fully derived and rebuildable, guaranteeing that your source files are never mutated.

## Why Hibiscus?

Hibiscus stands apart by rejecting the trend of bloated, cloud-dependent workspaces. It respects your privacy, your system resources, and your workflow. Whether you're writing code, drafting a research paper, or organizing study notes, Hibiscus provides the tools you need—instantly, locally, and beautifully.

## Quick Start

Ready to dive in? Head over to the [Getting Started Guide](guide/getting-started.md) to set up your environment or download the latest release!
