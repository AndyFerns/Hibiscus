# Changelog

All notable changes to the **Hibiscus** project will be documented in this file.

## [v0.4.7] - Current
- **Bug Fix**: Fixed controlled monaco text editor wiping recent key typing when an older queued React state echo occurred due to async lifecycle desyncs. The editor rendering dependency is now purely driven by an internal `fileVersion` which respects the user's keystrokes.
- **Docs**: Comprehensive MkDocs hierarchy populated containing project architecture, endpoints, and tutorial guides.

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
