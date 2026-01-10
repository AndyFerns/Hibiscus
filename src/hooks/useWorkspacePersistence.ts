import { invoke } from "@tauri-apps/api/core"
import { WorkspaceFile } from "../types/workspace"

export function persistWorkspace(
  path: string,
  workspace: WorkspaceFile
) {
  return invoke("save_workspace", {
    path,
    workspace
  })
}
