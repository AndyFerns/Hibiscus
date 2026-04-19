import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { open } from "@tauri-apps/plugin-dialog"

import { WorkspaceFile, Node } from "../types/workspace"
import { discoverWorkspace } from "./discoverWorkspace"
import { persistWorkspace } from "./useWorkspacePersistence"
import { pickWorkspaceRoot, getLastWorkspaceRoot } from "./useWorkspaceRoot"
import { updateSession } from "../state/session"
import { useRecentFiles } from "./useRecentFiles"

const emptyWorkspace: WorkspaceFile = {
  schema_version: "1.0",
  workspace: { id: "", name: "", root: "" },
  tree: [],
  session: {},
}

export function useWorkspaceController() {
  const [workspace, setWorkspace] = useState<WorkspaceFile>(emptyWorkspace)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  
  // Recent files management
  const { addRecentFile, addRecentFolder, recentFiles, recentFolders } = useRecentFiles()

  const workspacePath = workspaceRoot
    ? `${workspaceRoot}/.hibiscus/workspace.json`
    : null

  // ---- core loader ----
  const loadWorkspace = async (root: string) => {
    setWorkspaceRoot(root)

    const tree = await invoke<Node[]>("build_tree", { root })
    const discovery = await discoverWorkspace(root)

    if (discovery.found && discovery.path) {
      // Load existing workspace configuration
      const loaded = await invoke<WorkspaceFile>("load_workspace", {
        path: discovery.path,
      })

      setWorkspace({ ...loaded, tree })
    } else {
      // Create fresh workspace for new directories
      const fresh: WorkspaceFile = {
        schema_version: "1.0",
        workspace: {
          id: Date.now().toString(),
          name: "Hibiscus Workspace",
          root,
        },
        tree,
        settings: {},
        session: {},
      }

      const path = `${root}/.hibiscus/workspace.json`
      await persistWorkspace(path, fresh)
      setWorkspace(fresh)
    }

    // =========================================================================
    // BUG FIX: Start file watcher for ALL workspaces (new AND existing)
    // Previously this was only inside the else-block, causing autosave and
    // external file change detection to fail for existing workspaces.
    // =========================================================================
    await invoke("watch_workspace", { path: root })
  }

  // ---- workspace switch ----
  const changeWorkspace = async () => {
    const root = await pickWorkspaceRoot()
    if (!root) return

    localStorage.setItem("hibiscus:lastWorkspace", root)
    await loadWorkspace(root)
  }

  // ---- boot restore ----
  useEffect(() => {
    const last = getLastWorkspaceRoot()
    if (last) loadWorkspace(last)
  }, [])

  // ---- filesystem watcher ----
  useEffect(() => {
    if (!workspaceRoot) return

    let unlisten: (() => void) | null = null

    listen("fs-changed", async () => {
      const tree = await invoke<Node[]>("build_tree", {
        root: workspaceRoot,
      })

      setWorkspace(prev => ({ ...prev, tree }))
    }).then(fn => (unlisten = fn))

    return () => {
      if (unlisten) unlisten()
    }
  }, [workspaceRoot])

  // ---- open node ----
  const openNode = async (node: Node) => {
    setWorkspace(prev => {
      const next = updateSession(prev, {
        active_node: node.id,
        open_nodes: Array.from(
          new Set([...(prev.session?.open_nodes ?? []), node.id])
        ),
      })

      if (workspacePath) persistWorkspace(workspacePath, next)
      return next
    })
  }

  // ---- file menu operations ----
  
  /**
   * Open file dialog and return selected file path
   */
  const openFileDialog = async (): Promise<string | null> => {
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [{
          name: "All Files",
          extensions: ["*"]
        }]
      })
      
      const filePath = typeof result === "string" ? result : (Array.isArray(result) ? result[0] : null)
      if (filePath) {
        addRecentFile(filePath)
      }
      return filePath
    } catch (error) {
      console.error("[Hibiscus] Failed to open file dialog:", error)
      return null
    }
  }

  /**
   * Create a new file in the workspace
   */
  const createFile = async (relativePath: string): Promise<boolean> => {
    if (!workspaceRoot) return false
    
    try {
      const fullPath = `${workspaceRoot}\\${relativePath.replace(/\//g, '\\')}`
      await invoke("create_file", { path: fullPath })
      
      // Refresh tree
      const tree = await invoke<Node[]>("build_tree", { root: workspaceRoot })
      setWorkspace(prev => ({ ...prev, tree }))
      
      return true
    } catch (error) {
      console.error("[Hibiscus] Failed to create file:", error)
      return false
    }
  }

  /**
   * Create a new folder in the workspace
   */
  const createFolder = async (relativePath: string): Promise<boolean> => {
    if (!workspaceRoot) return false
    
    try {
      const fullPath = `${workspaceRoot}\\${relativePath.replace(/\//g, '\\')}`
      await invoke("create_folder", { path: fullPath })
      
      // Refresh tree
      const tree = await invoke<Node[]>("build_tree", { root: workspaceRoot })
      setWorkspace(prev => ({ ...prev, tree }))
      
      return true
    } catch (error) {
      console.error("[Hibiscus] Failed to create folder:", error)
      return false
    }
  }

  /**
   * Close current workspace
   */
  const closeWorkspace = () => {
    setWorkspaceRoot(null)
    setWorkspace(emptyWorkspace)
    localStorage.removeItem("hibiscus:lastWorkspace")
  }

  return {
    workspace,
    workspaceRoot,
    loadWorkspace,
    changeWorkspace,
    openNode,
    setWorkspace, // intentionally exposed (editor uses this)
    
    // File menu operations
    openFileDialog,
    createFile,
    createFolder,
    closeWorkspace,
    
    // Recent files
    recentFiles,
    recentFolders,
    addRecentFile,
    addRecentFolder,
  }
}
