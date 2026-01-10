import { invoke } from "@tauri-apps/api/core"
import { useState , useEffect } from "react"
import { WorkspaceFile } from "./types/workspace"
import { Workbench } from "./layout/workbench.tsx"
import { TreeView } from "./components/Tree/TreeView.tsx"
import { Node } from "./types/workspace"
import { openNode } from "./editors/openNode"
import { updateSession } from "./state/session"
import { persistWorkspace } from "./hooks/useWorkspacePersistence"
import { discoverWorkspace } from "./hooks/discoverWorkspace.ts"
import { EditorView } from "./components/Editor/EditorView"
import { useDebouncedSave } from "./hooks/useDebouncedSave"


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

  useEffect(() => {
    const boot = async () => {
      const root = "." // TEMP: later comes from "Open Folder"
      setWorkspaceRoot(root)

      const discovery = await discoverWorkspace(root)

      if (discovery.found && discovery.path) {
        const loaded = await invoke<WorkspaceFile>("load_workspace", {
          path: discovery.path
        })
        setWorkspace(loaded)
        if (loaded.session?.active_node) {
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

        const active = findNode(loaded.tree)
        if (active) {
          setActiveFile(active)

          if (active.path) {
            const fullPath = `${root}/${active.path}`
            try {
              const content = await invoke<string>("read_text_file", {
                path: fullPath
              })
              setActiveFile(active)
              setActiveFilePath(fullPath)
              setFileContent(content)
            } catch {
              setFileContent("Failed to restore file")
            }
          }
        }
      }


      } else {
        // No workspace yet -> create new workspace
        console.log("No existing Hibiscus workspace found! Creating Workspace")
        const fresh: WorkspaceFile = {
          schema_version: "1.0",
          workspace: {
            id: Date.now().toString(),
            name: "Hibiscus Workspace",
            root
          },
          tree: workspace.tree, // or rebuild from FS later
          settings: {},
          session: {}
        }

        try {
          const path = `${root}/.hibiscus/workspace.json`
          await persistWorkspace(path, fresh)
          setWorkspace(fresh)
        }
        catch (e) {
          console.error("Failed to create workspace", e)
        }
      }
    }

    boot()
  }, [])


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
