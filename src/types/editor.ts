/**
 * ============================================================================
 * Editor Types - Multi-file editor state definitions
 * ============================================================================
 *
 * Defines the data structures for the multi-file tab-based editor system.
 * These types are used by useEditorController, TabBar, and session persistence.
 * ============================================================================
 */

/**
 * Represents a single open file in the editor tab bar.
 * Each open file maintains its own identity, path, and dirty state.
 */
export interface OpenFile {
  /** Unique identifier (typically the resolved absolute path) */
  id: string
  /** Full filesystem path for Tauri read/write operations */
  path: string
  /** Display name (basename) shown in the tab */
  name: string
  /** Node type from the workspace tree ("file" or "folder") */
  type: string
  /** Whether the file has unsaved modifications */
  isDirty: boolean
}

/**
 * Session persistence format written to .hibiscus/session.json.
 * Intentionally kept minimal to avoid storing stale content on disk.
 * Content is always re-read from source files on restore.
 */
export interface EditorSession {
  /** Ordered list of open file paths (preserves tab order) */
  openFiles: string[]
  /** Path of the file that was last active, or null */
  activeFile: string | null
}
