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
              setFileContent(content)
            } catch {
              setFileContent("Failed to restore file")
            }
          }
        }
      }


      } else {
        // No workspace yet → keep mockWorkspace or create new
        console.log("No existing Hibiscus workspace found")
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
        <div style={{ padding: 16 }}>
          {activeFile ? (
            <>
              <h3>{activeFile.name}</h3>
              <pre
                style={{
                  background: "#1e1e1e",
                  color: "#d4d4d4",
                  padding: 12,
                  borderRadius: 6,
                  overflow: "auto",
                  whiteSpace: "pre-wrap"
                }}
              >
                {fileContent}
              </pre>
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
