import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { open } from "@tauri-apps/plugin-dialog"

import { WorkspaceFile, Node } from "../types/workspace"
import { discoverWorkspace } from "./discoverWorkspace"
import { persistWorkspace } from "./useWorkspacePersistence"
import { pickWorkspaceRoot, getLastWorkspaceRoot } from "./useWorkspaceRoot"
import { updateSession } from "../state/session"
import { useRecentFiles } from "./useRecentFiles"
import { resolveWorkspacePath } from "../utils/workspacePath"
import { canDrop, moveNodeInTree } from "../components/Tree/treeOps"

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

  // Refs so the callbacks below can keep a stable identity. Memoized panes
  // (TreeView, LeftPane, MainPane) rely on that to skip re-rendering.
  const workspaceRootRef = useRef(workspaceRoot)
  workspaceRootRef.current = workspaceRoot
  const workspacePathRef = useRef(workspacePath)
  workspacePathRef.current = workspacePath
  const addRecentFileRef = useRef(addRecentFile)
  addRecentFileRef.current = addRecentFile

  // ---- core loader ----
  const loadWorkspace = useCallback(async (root: string) => {
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
  }, [])

  // ---- workspace switch ----
  const changeWorkspace = useCallback(async () => {
    const root = await pickWorkspaceRoot()
    if (!root) return

    localStorage.setItem("hibiscus:lastWorkspace", root)
    await loadWorkspace(root)
  }, [loadWorkspace])

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
  const openNode = useCallback(async (node: Node) => {
    const workspacePath = workspacePathRef.current
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
  }, [])

  // ---- file menu operations ----
  
  /**
   * Open file dialog and return selected file path
   */
  const openFileDialog = useCallback(async (): Promise<string | null> => {
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
        addRecentFileRef.current(filePath)
      }
      return filePath
    } catch (error) {
      console.error("[Hibiscus] Failed to open file dialog:", error)
      return null
    }
  }, [])

  /**
   * Create a new file in the workspace
   */
  const createFile = useCallback(async (relativePath: string): Promise<boolean> => {
    const workspaceRoot = workspaceRootRef.current
    if (!workspaceRoot) return false
    
    try {
      const fullPath = await resolveWorkspacePath(workspaceRoot, relativePath)
      await invoke("create_file", { workspaceRoot, path: fullPath })

      // Refresh tree
      const tree = await invoke<Node[]>("build_tree", { root: workspaceRoot })
      setWorkspace(prev => ({ ...prev, tree }))

      return true
    } catch (error) {
      console.error("[Hibiscus] Failed to create file:", error)
      return false
    }
  }, [])

  /**
   * Create a new folder in the workspace
   */
  const createFolder = useCallback(async (relativePath: string): Promise<boolean> => {
    const workspaceRoot = workspaceRootRef.current
    if (!workspaceRoot) return false
    
    try {
      const fullPath = await resolveWorkspacePath(workspaceRoot, relativePath)
      await invoke("create_folder", { workspaceRoot, path: fullPath })

      // Refresh tree
      const tree = await invoke<Node[]>("build_tree", { root: workspaceRoot })
      setWorkspace(prev => ({ ...prev, tree }))

      return true
    } catch (error) {
      console.error("[Hibiscus] Failed to create folder:", error)
      return false
    }
  }, [])

  // Last failed move, surfaced as a toast by the explorer
  const [moveError, setMoveError] = useState<string | null>(null)
  const clearMoveError = useCallback(() => setMoveError(null), [])

  /**
   * Move a node (file or folder) into a destination folder ("" = root).
   *
   * The tree is updated optimistically so the drop lands instantly; the
   * backend move runs after, and the tree is reverted if it fails.
   * `onMoved` receives the absolute old/new paths right after the backend
   * succeeds (before the watcher fires) so open tabs can be re-pointed.
   */
  const moveNode = useCallback(async (
    sourceId: string,
    destinationParentId: string,
    onMoved?: (fromPath: string, toPath: string) => void,
  ): Promise<boolean> => {
    const workspaceRoot = workspaceRootRef.current
    if (!workspaceRoot) return false
    if (!canDrop(sourceId, destinationParentId)) return false

    const sourceName = sourceId.split(/[/\\]/).pop()
    if (!sourceName) return false

    let previousTree: Node[] | null = null
    setWorkspace(prev => {
      previousTree = prev.tree
      return { ...prev, tree: moveNodeInTree(prev.tree, sourceId, destinationParentId) }
    })

    try {
      const sourcePath = await resolveWorkspacePath(workspaceRoot, sourceId)
      const destParentPath = await resolveWorkspacePath(workspaceRoot, destinationParentId)
      const destinationPath = await resolveWorkspacePath(destParentPath, sourceName)

      // workspaceRoot is passed so the backend can reject a move that would
      // escape the workspace.
      await invoke("move_node", {
        workspaceRoot,
        source: sourcePath,
        destination: destinationPath,
      })
      onMoved?.(sourcePath, destinationPath)

      // Reconcile with the real filesystem state.
      const tree = await invoke<Node[]>("build_tree", { root: workspaceRoot })
      setWorkspace(prev => ({ ...prev, tree }))
      return true
    } catch (error) {
      console.error("[Hibiscus] Failed to move node:", error)
      if (previousTree) {
        const restore = previousTree
        setWorkspace(prev => ({ ...prev, tree: restore }))
      }
      setMoveError(`Couldn't move ${sourceName}: ${String(error)}`)
      return false
    }
  }, [])

  /**
   * Close current workspace
   */
  const closeWorkspace = useCallback(() => {
    setWorkspaceRoot(null)
    setWorkspace(emptyWorkspace)
    localStorage.removeItem("hibiscus:lastWorkspace")
  }, [])

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
    moveNode,
    moveError,
    clearMoveError,
    closeWorkspace,
    
    // Recent files
    recentFiles,
    recentFolders,
    addRecentFile,
    addRecentFolder,
  }
}
