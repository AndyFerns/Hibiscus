import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useState , useEffect } from "react"
import { WorkspaceFile } from "./types/workspace"
import { Workbench } from "./layout/workbench.tsx"
import { TopBar } from "./components/TopBar/TopBar"
import { TreeView } from "./components/Tree/TreeView.tsx"
import { Node } from "./types/workspace"
import { openNode } from "./editors/openNode"
import { updateSession } from "./state/session"
import { persistWorkspace } from "./hooks/useWorkspacePersistence"
import { discoverWorkspace } from "./hooks/discoverWorkspace.ts"
import { EditorView } from "./components/Editor/EditorView"
import { useDebouncedSave } from "./hooks/useDebouncedSave"
import { pickWorkspaceRoot, getLastWorkspaceRoot } from "./hooks/useWorkspaceRoot.ts"

const mockWorkspace: WorkspaceFile = {
  schema_version: "1.0",
  workspace: {
    id: "demo",
    name: "Demo Workspace",
    root: "."
  },
  tree: [
    {
      id: "1",
      name: "Notes",
      type: "folder",
      children: [
        {
          id: "2",
          name: "welcome.txt",
          type: "file",
          path: "welcome.txt"
        }
      ]
    }
  ]
}



export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceFile>(mockWorkspace)

  // workspace root: folder in which hibiscus was opened
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)

  const workspacePath = workspaceRoot ? `${workspaceRoot}/.hibiscus/workspace.json`: null // later discovered dynamically

  // added absolute filepath (final truth)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  // debounced save hook implementation
  const debouncedSave = useDebouncedSave(600) // 600 ms

  // extract session restoration
  const restoreSession = async (
    loaded: WorkspaceFile,
    tree: Node[],
    root: string
  ) => {
    if (!loaded.session?.active_node) return

    const findNode = (nodes: Node[]): Node | null => {
      for (const node of nodes) {
        if (node.id === loaded.session!.active_node) return node
        if (node.children) {
          const found = findNode(node.children)
          if (found) return found
        }
      }
      return null
    }

    const active = findNode(tree)
    if (!active || !active.path) return

    const fullPath = `${root}/${active.path}`
    const content = await invoke<string>("read_text_file", { path: fullPath })

    setActiveFile(active)
    setActiveFilePath(fullPath)
    setFileContent(content)
  }

  // async function to listen for and check for changed workspaces on boot
  const handleChangeWorkspace = async () => {
    const root = await pickWorkspaceRoot()
    if (!root) return

    localStorage.setItem("hibiscus:lastWorkspace", root)
    await loadWorkspace(root)
  }

  // Extract loadWorkspace(root)
  const loadWorkspace = async (root: string) => {
    setWorkspaceRoot(root)

    const tree = await invoke<Node[]>("build_tree", { root })
    const discovery = await discoverWorkspace(root)

    if (discovery.found && discovery.path) {
      const loaded = await invoke<WorkspaceFile>("load_workspace", {
        path: discovery.path,
      })

      setWorkspace({
        ...loaded,
        tree, // filesystem is truth
      })

      restoreSession(loaded, tree, root)
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
      await invoke("watch_workspace", { path: root })
    }
  }

  useEffect(() => {
    const last = getLastWorkspaceRoot()
    if (last) {
      loadWorkspace(last)
    }
  }, [])


  // Listen for filesystem changes and rebuild tree
  useEffect(() => {
    if (!workspaceRoot) return

    let unlisten: (() => void) | null = null

    listen("fs-changed", async () => {
      console.log("Filesystem changed — rebuilding tree")

      try {
        const tree = await invoke<Node[]>("build_tree", {
          root: workspaceRoot
        })

        setWorkspace(prev => ({
          ...prev,
          tree
        }))
      } catch (e) {
        console.error("Failed to rebuild tree", e)
      }
    }).then(fn => {
      unlisten = fn
    })

    return () => {
      if (unlisten) unlisten()
    }
  }, [workspaceRoot])



  //Active File state tracking  
  const [activeFile, setActiveFile] = useState<Node | null>(null)
  const [fileContent, setFileContent] = useState<string>("")


  const handleOpenNode = (node: Node) => {
    openNode(node)
    setActiveFile(node)

    if (node.path && workspaceRoot) {
      const fullPath = `${workspaceRoot}/${node.path}`
      setActiveFilePath(fullPath)

      invoke<string>("read_text_file", { path: fullPath })
        .then(setFileContent)
        .catch(err => {
          console.error(err)
          setFileContent("Failed to load file")
        })
    }

    setWorkspace(prev => {
      const next = updateSession(prev, {
        active_node: node.id,
        open_nodes: Array.from(
          new Set([...(prev.session?.open_nodes ?? []), node.id])
        )
      })

      if (workspacePath) {
        persistWorkspace(workspacePath, next)
      }
      return next
    })
  }


  return (
    <Workbench
      // TopBar implementation
      top={
        <TopBar
          workspaceRoot={workspaceRoot}
          onChangeWorkspace={handleChangeWorkspace}
        />
      }

      // Left Panel rendering
      left={
        <TreeView
          tree={workspace.tree}
          activeNodeId={workspace.session?.active_node}
          onOpen={handleOpenNode}
        />
      }

      main={
        <div style={{ padding: 16, height: "100%" }}>
          {activeFile && activeFilePath ? (
            <>
              <h3>{activeFile.name}</h3>

              <div style={{ height: "calc(100% - 32px)" }}>
                <EditorView
                  path={activeFilePath}
                  content={fileContent}
                  onChange={(value) => {
                    setFileContent(value)
                    debouncedSave(activeFilePath, value)
                  }}
                />
              </div>
            </>
          ) : (
            <p>Select a file from the tree.</p>
          )}
        </div>
      }

      bottom={
        <div style={{ padding: 8 }}>Status / Logs</div>
      }
    />
  )
}
