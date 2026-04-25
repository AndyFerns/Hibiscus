/**
 * ============================================================================
 * Editor Session Persistence
 * ============================================================================
 *
 * Handles reading and writing the editor session state to disk at:
 *   .hibiscus/session.json
 *
 * Uses debounced writes (300ms) to avoid excessive I/O during rapid tab
 * switching. Session data is intentionally minimal -- only file paths and
 * active tab are stored. Content is always re-read from disk on restore.
 *
 * Integrates with existing Tauri FS commands (write_text_file, read_text_file)
 * that are already registered in the backend.
 * ============================================================================
 */

import { invoke } from "@tauri-apps/api/core"
import { EditorSession } from "../types/editor"

/** Debounce timer handle for coalescing rapid writes */
let persistTimer: number | null = null

/** Default delay before flushing to disk (ms) */
const PERSIST_DELAY_MS = 300

/**
 * Resolve the session file path for a given workspace root.
 * Uses the same .hibiscus directory as workspace.json.
 */
function sessionPath(workspaceRoot: string): string {
  return `${workspaceRoot}/.hibiscus/session.json`
}

/**
 * Persist the editor session to disk with debouncing.
 * Multiple calls within PERSIST_DELAY_MS are coalesced into one write.
 *
 * @param workspaceRoot - Workspace root path
 * @param session - Current session state to persist
 */
export function persistEditorSession(
  workspaceRoot: string,
  session: EditorSession
): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
  }

  persistTimer = window.setTimeout(async () => {
    try {
      const path = sessionPath(workspaceRoot)
      const contents = JSON.stringify(session, null, 2)
      await invoke("write_text_file", { path, contents })
    } catch (error) {
      // Non-critical: session restore is best-effort
      console.warn("[Hibiscus] Failed to persist editor session:", error)
    }
  }, PERSIST_DELAY_MS)
}

/**
 * Load the editor session from disk.
 * Returns null if the file does not exist or is malformed,
 * allowing the app to start with a clean state.
 *
 * @param workspaceRoot - Workspace root path
 * @returns Parsed session or null
 */
export async function loadEditorSession(
  workspaceRoot: string
): Promise<EditorSession | null> {
  try {
    const path = sessionPath(workspaceRoot)
    const raw = await invoke<string>("read_text_file", { path })
    const parsed = JSON.parse(raw)

    // Validate shape before returning
    if (
      parsed &&
      Array.isArray(parsed.openFiles) &&
      (parsed.activeFile === null || typeof parsed.activeFile === "string")
    ) {
      return parsed as EditorSession
    }

    console.warn("[Hibiscus] Malformed session.json, ignoring")
    return null
  } catch {
    // File doesn't exist yet or read failed -- both are expected on first run
    return null
  }
}
