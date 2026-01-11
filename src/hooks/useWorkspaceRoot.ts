import { open } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"

export async function pickWorkspaceRoot(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false
  })

  return typeof result === "string" ? result : null
}

/**
 * Function to reload app state on startup
 */
export async function loadLastWorkspaceRoot() {
  const path = await invoke<string | null>("pick_workspace_folder")
  if (!path) return null

  localStorage.setItem("hibiscus:lastWorkspace", path)
  return path
}
