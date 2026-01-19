import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

import { WorkspaceFile, Node } from "../types/workspace"
import { discoverWorkspace } from "./discoverWorkspace"
import { persistWorkspace } from "./useWorkspacePersistence"
import { pickWorkspaceRoot, getLastWorkspaceRoot } from "./useWorkspaceRoot"
import { updateSession } from "../state/session"

const emptyWorkspace: WorkspaceFile = {
  schema_version: "1.0",
  workspace: { id: "", name: "", root: "" },
  tree: [],
  session: {},
}

export function useWorkspaceController() {
  const [workspace, setWorkspace] = useState<WorkspaceFile>(emptyWorkspace)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)

  const workspacePath = workspaceRoot
    ? `${workspaceRoot}/.hibiscus/workspace.json`
    : null

  // ---- core loader ----
  const loadWorkspace = async (root: string) => {
    setWorkspaceRoot(root)

    const tree = await invoke<Node[]>("build_tree", { root })
    const discovery = await discoverWorkspace(root)

    if (discovery.found && discovery.path) {
      const loaded = await invoke<WorkspaceFile>("load_workspace", {
        path: discovery.path,
      })

      setWorkspace({ ...loaded, tree })
    } else {
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

        //ALWAYS start watcher
      await invoke("watch_workspace", { path: root })
    }
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

  return {
    workspace,
    workspaceRoot,
    loadWorkspace,
    changeWorkspace,
    openNode,
    setWorkspace, // intentionally exposed (editor uses this)
  }
}
