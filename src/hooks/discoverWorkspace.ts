import { invoke } from "@tauri-apps/api/core"

export type WorkspaceDiscovery = {
  found: boolean
  path?: string
}

export async function discoverWorkspace(
    root: string
): Promise<WorkspaceDiscovery> {
  return invoke("discover_workspace", { root })
}
