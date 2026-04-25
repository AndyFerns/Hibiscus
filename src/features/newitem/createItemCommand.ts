// ============================================================================
// Command Layer -- createItemCommand
// ============================================================================
//
// The single point of contact between the frontend and the Tauri backend
// for item creation. The UI MUST call this instead of directly invoking
// filesystem operations.
//
// This function:
// 1. Resolves the relative path against the workspace root.
// 2. Invokes the Rust `create_item` command.
// 3. Returns a structured result (success path or error message).
//
// The watcher will detect the filesystem change and update the tree
// automatically -- no manual tree refresh is needed here.
// ============================================================================

import { invoke } from "@tauri-apps/api/core"
import { CreateItemRequest } from "./types"

export interface CreateItemResult {
  success: boolean
  /** Absolute path of the created item (on success). */
  path?: string
  /** Error message (on failure). */
  error?: string
}

/**
 * Create a file or folder via the Tauri backend.
 *
 * @param workspaceRoot - Absolute path to the workspace root directory.
 * @param request       - The creation request (path, type, openAfterCreate).
 * @returns A result object indicating success or failure.
 */
export async function createItemCommand(
  workspaceRoot: string,
  request: CreateItemRequest
): Promise<CreateItemResult> {
  // Resolve relative path against workspace root.
  // Normalize separators to the OS convention (backslash on Windows).
  const relativePath = request.path.replace(/\//g, "\\")
  const absolutePath = `${workspaceRoot}\\${relativePath}`

  const isDir = request.type === "folder"

  try {
    await invoke("create_item", { path: absolutePath, isDir })
    return { success: true, path: absolutePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
