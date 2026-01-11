import { open } from "@tauri-apps/plugin-dialog"

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
export function getLastWorkspaceRoot(): string | null {
  return localStorage.getItem("hibiscus:lastWorkspace")
}