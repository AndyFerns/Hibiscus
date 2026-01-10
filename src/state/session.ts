import { WorkspaceFile, SessionState } from "../types/workspace"

export function updateSession(
  workspace: WorkspaceFile,
  updates: Partial<SessionState>
): WorkspaceFile {
  return {
    ...workspace,
    session: {
      ...(workspace.session ?? {}),
      ...updates
    }
  }
}
