# Changelog

All notable changes to the **Hibiscus** project will be documented in this file.

## [v0.9.0] - Advanced Knowledge System (Phase 2)

### New Features

- **PDF & DOCX Document Support**: Extended the parsing system to handle PDF files using pdf-extract and DOCX files via zip+quick-xml streaming. Both parsers implement the existing Parser trait and include robust error handling for corrupt files.
- **TF-IDF Scored Search Index**: Implemented a sophisticated scoring system alongside the existing keyword index. Uses the formula `score = ln(1 + tf) * ln(total_chunks / df)` with precomputed scores for zero query-time calculation. Automatically filters common words appearing in >50% of chunks.
- **Intelligent Topic Grouping**: Added automatic topic extraction that groups chunks by heading text. Identical headings create the same topic, empty headings become "General", and small topics (<2 chunks) merge into "Miscellaneous". Uses BTreeMap for deterministic ordering.
- **Advanced Query Engine**: Enhanced search with multiple matching strategies - exact match (score + 0.5), prefix match (score * 0.2), and fuzzy match with edit distance 1 (score * 0.1). Supports multi-word queries with accumulated scoring and pagination (max 100 results).
- **High-Performance LRU Cache**: Implemented dual in-memory caches - query cache (128 entries) and chunk cache (256 entries). Uses VecDeque for better CPU cache locality than HashMap+LinkedList. All-or-nothing cache invalidation on file changes.
- **Extended Backend API**: Added new Tauri commands including `search_chunks` for ranked search with fuzzy/prefix support, and `get_topics` for topic retrieval. Enhanced existing commands with caching support.

### Architecture Improvements

- **Phase 1 Compatibility**: Maintains full backward compatibility - Phase 1 commands and storage remain untouched. Phase 2 extends via parallel data structures without breaking existing functionality.
- **Memory-Optimized Parsing**: DOCX parsing uses streaming XML to avoid loading entire documents into memory. PDF parsing extracts full text then splits on double newlines for pragmatic content separation.
- **Deterministic Performance**: Topic grouping uses BTreeMap and sorted chunk IDs for consistent results. Query processing includes early exit after 500 candidates per term to prevent performance degradation.
- **Robust File Handling**: Added large file guard (10MB threshold) that skips files at queue level before parsing begins. All parsers include proper error handling with IoError fallback for corrupt files.

### Storage Updates

- **New Storage Files**: Added `topics.json` for topic mappings and `scored_index.json` for TF-IDF data alongside existing Phase 1 storage.
- **Enhanced Storage Layout**: Updated `.hibiscus/knowledge/` structure to support both Phase 1 and Phase 2 data without migration requirements.
- **Optimized Index Structure**: Scored index caps at 200 chunk references per keyword to prevent memory bloat while maintaining search quality.

### Testing & Quality

- **Comprehensive Test Coverage**: Added 46 total tests with 10 new tests covering cache (4), indexer (1), query (4), and topics (1) modules.
- **Performance Validation**: Confirmed LRU cache outperforms HashMap+LinkedList for small cache sizes through CPU cache locality benefits.
- **Error Resilience**: All new parsers include comprehensive error handling with graceful degradation for corrupted or malformed files.

## [v0.8.0] - Knowledge Indexing System (Phase 1)

### New Features

- **Knowledge Indexing Pipeline**: Implemented a local-first, incremental knowledge indexing system that watches workspace files (`.md`, `.txt`) and processes them via a debounced async queue.
- **Worker Pool & Debounced Batching**: Added a background worker task with bounded concurrency and debounced batching for efficient per-file processing without blocking the main runtime.
- **Trait-Based Parser System**: Introduced a flexible parsing architecture including a `MarkdownParser` for heading-based splits and a `TxtParser` for paragraph-based splits.
- **Context-Aware Chunker**: Implemented an intelligent chunking engine that splits parsed sections into 200-500 word bounds while preserving heading context and using deterministic IDs.
- **Incremental Keyword Indexing**: Added a hash-based incremental keyword index that supports stopword filtering and normalization for rapid text retrieval.
- **Robust Storage Layer**: Built an optimized disk I/O layer utilizing buffered reads/writes, streaming file hashes, and individual chunk file storage to minimize memory footprint.
- **Query APIs**: Exposed new Tauri commands (`search_knowledge`, `get_chunk`, `rebuild_knowledge_index`) for frontend integration with the knowledge system.

### Architecture

- **State Management**: Integrated `Arc<KnowledgeState>` as a managed state within Tauri, properly spawning the worker during the setup hook to ensure safe cross-thread operations.
- **Watcher Integration**: Extended the existing `watch_workspace` to seamlessly accept `KnowledgeState` and securely forward filesystem events to the new knowledge queue.
- **Asynchronous Processing**: Integrated essential Tokio features (`rt`, `rt-multi-thread`, `time`, `macros`) into the Cargo manifest to safely support native async routines.

### Bug Fixes

- **Threading Panic**: Replaced tokio runtime thread spawning with Tauri's native async runtime handling to prevent main thread panics when no existing tokio runtime was detected.
- **Macro Export Issues**: Updated the module root to accurately re-export the Tauri-facing API to prevent macro resolution bugs associated with `tauri::command`.
- **Code Consolidation**: Delegated all custom shared data types into a single unified file for cleaner dependency management across the workspace.

## [v0.7.2]

- **Bugfix**: Removed unused Open function causing typescript errors (lol)

## [v0.7.1]

- **Bugfix**:  Fixed bg selection and text selection inconsistency wherein the selection text was stuck at a bright red despite theme changes

## [v0.7.0] - New Item Modal System

### New Features

- **Production-Grade Modal System**: Implemented a Notion × VS Code hybrid modal for creating new files and folders, replacing browser-native `prompt()` calls with a custom React component.
- **Enhanced File Creation Workflow**: Added comprehensive input validation, duplicate prevention, and smooth animations for new file/folder creation.
- **Keyboard Shortcuts**: Implemented Ctrl+N (new file) and Ctrl+Shift+N (new folder) keyboard shortcuts for improved productivity.
- **Modal Design System**: Created a reusable modal component with backdrop blur, smooth animations, and responsive design using theme CSS variables.

### Architecture Improvements

- **Controller-Driven Design**: Maintained clean separation between UI and business logic - modal handles presentation, controllers handle filesystem operations.
- **State Management**: Implemented proper modal state management with controlled components and callback patterns.
- **Input Validation**: Added comprehensive filename validation including invalid character checks and duplicate detection.
- **Accessibility**: Included proper ARIA attributes, keyboard navigation (Enter/Escape), and focus management.

### Breaking Changes

- **Removed Browser Prompts**: Eliminated all `prompt()` usage in favor of the new modal system for desktop-appropriate UI patterns.
- **Updated File Menu Handlers**: File menu actions now use modal-based input instead of browser dialogs.

### Technical Details

- **NewItemModal Component**: New reusable modal at `src/components/Modals/NewItemModal.tsx` with TypeScript interfaces for mode support.
- **CSS Styling**: Dedicated stylesheet with Notion-inspired design using theme variables and smooth animations.
- **Integration Points**: Updated App.tsx with modal state management and keyboard shortcut listeners.
- **Validation Logic**: Added duplicate name checking against existing workspace items.

## [v0.6.1]

- **bugfix**: fixed incorrect link redirection for help -> documentation
- **minor fix**: removed excessive emojis from right bar

## [v0.6.0] - Study Tools System

### 🎨 New Features

- **Study Context & Focus Mode**: Global state context managing active tools and distraction-free learning. Toggle Focus Mode (Ctrl+Shift+F) to hide the left sidebar and focus entirely on the editor/study tools.
- **Settings System**: Instant-save application preferences modal (Ctrl+,) handling general defaults and Pomodoro timer intervals, scaling instantly across both local storage (hot path) and backend filesystem persistence.
- **Pomodoro Timer**: Native deep integration handling full work/break/long-break lifecycles perfectly. Built with a clean interface inside the right side-panel and a minimal ring widget attached natively to the bottom status bar.
- **Study Statistics**: Activity tracking system logging deep focus sessions building into dynamic streak-counters, timeline history data, and a 100% native SVG bar graph rendering natively inside the application without relying on external bloat.
- **Flashcards System**: A deck manager allowing question/answer creations with smooth 3D CSS flip animations natively driven alongside seamless keyboard integrations (Space, Arrows, Shuffle). Currently acts as a foundational block anticipating AI note synthesis features locally.
- **Notes Synthesis**: Document combination utility capable of fusing multiple Markdown or text files recursively into structured unified documents. Anticipates future deep docx/pdf local integrations natively.
- **Refactored Right Panel**: Implemented `RightPanelContainer` routing between dynamic sub-panels seamlessly (Calendar vs Study Modes) allowing complete customization over how you allocate your workspace view.

### Architecture

- **Flexible Data Store**: Introduced a generalized `study.rs` generic backend trait allowing robust read/save behaviors seamlessly handling isolated tool datasets (`stats.json`, `flashcards.json`, `settings.json`) independently.
- **Hook-Driven Capabilities**: Encapsulated state machines inside pure functional hooks natively (`usePomodoro`, `useFlashcards`, `useStudyStats`) allowing un-coupled logic implementation seamlessly testable offline natively.

## [v0.5.0] - Theme System Overhaul

### Breaking Changes

- **ThemeContext API rewrite**: `useTheme()` now returns `{ activeThemeName, themes, setTheme, saveUserTheme, deleteUserTheme, duplicateTheme, isThemeEditorOpen, setThemeEditorOpen, refreshThemes, workspaceRoot }` instead of the previous `{ theme, setTheme, customThemes, applyCustomTheme }`.
- **ThemeProvider** now accepts an optional `workspaceRoot` prop and has been moved from `main.tsx` into `App.tsx`.
- **`editorConfig.ts`**: Removed `registerHibiscusThemes()` — themes are now managed exclusively by the dynamic CSS adapter.
- **Deleted** `monacoStudyConfig.ts` — was dead code duplicating `editorConfig.ts`.

### New Features

- **JSON Theme System**: Themes are defined as JSON with full token overrides (`--bg`, `--text`, `--editor-keyword`, etc.), stored in `.hibiscus/themes/<name>.json`.
- **Theme Editor UI**: In-app modal with color pickers for Core, Editor, and Semantic token groups. Instant live preview via direct CSS variable manipulation.
- **Theme Registry** (`themeRegistry.ts`): Centralized frontend theme management with `applyTheme()`, `safeApplyTheme()`, `validateTheme()`, `mergeWithDefaults()`, and JSON serialization.
- **Theme Defaults** (`themeDefaults.ts`): Preset themes (midnight, dawn, forest) as static JSON objects with all tokens defined. Presets are read-only; duplicate to edit.
- **Export/Import** (`themeIO.ts`): Export themes as downloadable `.hibiscus-theme.json` files; import and validate JSON theme files.
- **Backend Persistence**: Three new Tauri commands — `save_theme`, `load_themes`, `delete_theme` — for persisting user themes to `.hibiscus/themes/*.json`.
- **Theme Selector Improvements**: Status bar dropdown now shows Preset and Custom sections, active checkmark, and action buttons for "Edit Theme..." and "Import Theme...".
- **TitleBar Integration**: View menu now includes "Theme..." action to open the Theme Editor.

### 🐛 Bug Fixes

- **Fixed invalid CSS**: Editor-specific tokens (`--editor-fg`, `--editor-keyword`, etc.) were declared outside any CSS selector (bare properties between `:root` closing brace and `[data-theme]` blocks). Browsers silently ignored them. Moved inside `:root` with per-theme overrides.
- **Fixed runtime crash**: `editorThemeAdapter.ts` called `strip()` but the function was named `stripHash()`. Caused `ReferenceError` at runtime.
- **Fixed Monaco theme reference**: Editor config referenced `hibiscus-soft` theme which was never registered before editor creation. Changed to `hibiscus-dynamic` (the CSS-adapter-defined theme).
- **Fixed Monaco not updating on theme switch**: `setTheme()` previously only changed `data-theme` attribute but never re-triggered `applyEditorThemeFromCSS()`. Monaco now syncs on every theme change.
- **Fixed Monaco background transparency conflict**: `EditorView.css` had `background-color: transparent !important` overriding the dynamic theme adapter's `editor.background` setting. Removed the `!important` override.
- **Fixed dead code**: Removed unused imports of `getStudyEditorOptions` and `registerHibiscusThemes` from `EditorView.tsx`.

### 🏗️ Architecture

- **Editor theme adapter** rewritten with intelligent light/dark base theme detection (luminance calculation instead of hardcoded hex comparison), comprehensive fallback chains for all CSS variables, and new token support (`--editor-line-highlight`, `--editor-cursor`).
- **Strict separation maintained**: Editor behavior/config remains fixed and non-editable; theme system is fully user-editable. Frontend owns all theme logic; backend provides persistence only.

## [v0.4.9]

- **Maintenance**: Internal dependency updates and stability improvements.

## [v0.4.8]

- **Docs**: Comprehensive MkDocs hierarchy populated containing project architecture, endpoints, and tutorial guides.

## [v0.4.7]

- **Bug Fix**: Fixed controlled monaco text editor wiping recent key typing when an older queued React state echo occurred due to async lifecycle desyncs. The editor rendering dependency is now purely driven by an internal `fileVersion` which respects the user's keystrokes.

## [v0.4.6]

- **Automation**: Created `scripts/hibiscus.cjs` terminal helper script encapsulating `dev`, `build`, `test`, `docs`, and `bump` functions.

## [v0.4.5]

- **CI/CD**: Added complete Matrix testing pipeline using GitHub Actions to automatically lint, test, and package builds on Linux, Windows, and macOS for every tagged release.

## [v0.4.4]

- **Performance**: Improved FS Watcher handling by accumulating file modification events cleanly within `HashSet` debouncers.
- **Performance**: Memoized hierarchical `TreeView` and `TreeNode` components preventing render storms on active workspace layouts natively.

## [v0.4.3]

- **Feature**: Implemented automated rotating backup archives (`backup.rs`) caching older iterations of `workspace.json` and `calendar.json` internally into `.hibiscus/backups`.

## [v0.4.2]

- **Feature**: Appended automatic configuration state migrations `migration.rs` natively into standard system loading handlers solving breaking config changes between product variations.

## [v0.4.1]

- **Feature**: Universal hotkeys mapped globally across editor spaces using `useKeyboardShortcuts` hooks interacting visually via an accessible `ShortcutOverlay` cheat sheet dialog.

## [v0.4.0]

- **Feature**: Redone style tokens mapped out globally leveraging local CSS definitions allowing fast non-blocking changes via the built-in `ThemeSelector` toggle implementing `Midnight`, `Dawn`, and `Forest` defaults visually.
