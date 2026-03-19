# Application Architecture

Hibiscus follows a strict **Local-First**, decoupled client-server model entirely running on the user's host machine. The core architecture uses [Tauri v2](https://tauri.app) to bridge the gap between a high-performance Rust backend and a reactive React frontend.

## The Frontend Layer (React / Vite)
The User Interface is built with React 19 and compiled via Vite 7. 

**Core Characteristics:**
- **Monaco Editor:** We use Microsoft's Monaco Editor internally inside `EditorView.tsx`.
- **Layout Management:** A central `Workbench` provides a panel-based structure dividing responsibilities into Explorer, Editor, and Calendar zones.
- **Hook Architecture:** All heavy business logic sits inside isolated controllers (`useEditorController`, `useWorkspaceController`, `useCalendarController`).
- **CSS Variables:** Design heavily utilizes inline `[data-theme]` tags via standard `.css` variables ensuring rendering overhead is virtually zero during theme hotswaps.

## The Backend Layer (Rust / Tauri)
The backend does the heavy lifting around File System I/O, validations, OS bridging, and data safety.

**Key Modules:**
- `workspace.rs`: Discovery and validation of `.hibiscus` configuration files on disk.
- `calendar.rs`: Handles the CRUD data parsing for the planner. 
- `files.rs`: Handles generic disk read/writes for the editor buffer safely.
- `tree.rs`: Recursively constructs directory nodes to feed the frontend TreeView.
- `watcher.rs`: Implements `notify` trait streams to detect asynchronous OS-level file modifications. Debounces these events natively before emitting them over the Tauri bridge to maintain React rendering performance.
- `migration.rs`: Upgrades schemas of loaded `.json` states safely on memory load avoiding breaking changes.
- `backup.rs`: Intercepts saves to `.hibiscus/workspace.json` and `calendar.json` routing older instances into a rotating `.bak` backup archive.

## Inter-Process Communication
The frontend invokes backend operations explicitly using standard Tauri RPC:
```javascript
import { invoke } from "@tauri-apps/api/core";

const content = await invoke("read_text_file", { path: fullPath });
```
Inversely, asynchronous backend events (like `fs-changed`) are bubbled up natively over Tauri's event emitter system and captured globally using `listen()`.
