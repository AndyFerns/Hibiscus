import { join } from "@tauri-apps/api/path"

export async function resolveWorkspacePath(
  workspaceRoot: string,
  relativePath: string,
): Promise<string> {
  const segments = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)

  return join(workspaceRoot, ...segments)
}
