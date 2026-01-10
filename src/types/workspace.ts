export interface WorkspaceFile {
  schema_version: string
  workspace: WorkspaceInfo
  settings?: Record<string, any>
  tree: Node[]
  session?: SessionState
}

export interface WorkspaceInfo {
  id: string
  name: string
  root: string
  created_at?: string
  updated_at?: string
}

/**
 * Must match Rust enum:
 * 
 * #[serde(rename_all = "lowercase")]
 * 
 * enum NodeType { File, Folder }
 */
export type NodeType = "file" | "folder"

export interface Node {
  id: string
  name: string
  type?: NodeType
  path?: string
  children?: Node[]
  meta?: Record<string, any>
}


export interface CursorPosition {
  line: number
  column: number
}

export interface SessionState {
  open_nodes?: string[]
  active_node?: string
  cursor?: Record<string, CursorPosition>
}
