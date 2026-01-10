import { useState } from "react"
import { WorkspaceFile } from "./types/workspace"
import { Workbench } from "./layout/Workbench.tsx"
import { TreeView } from "./components/Tree/TreeView.tsx"
import { Node } from "./types/workspace"
import { openNode } from "./editors/openNode"
import { updateSession } from "./state/session"
import { persistWorkspace } from "./hooks/useWorkspacePersistence"


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

  const workspacePath = "workspace.json" // later discovered dynamically

  //Active File state tracking  
  const [activeFile, setActiveFile] = useState<Node | null>(null)
  const [fileContent, setFileContent] = useState<string>("")


const handleOpenNode = (node: Node) => {
    openNode(node)
    setActiveFile(node)

    if (node.path) {
      setFileContent(`(mock content for ${node.path})`)
    }

    setWorkspace(prev => {
      const next = updateSession(prev, {
        active_node: node.id,
        open_nodes: Array.from(
          new Set([...(prev.session?.open_nodes ?? []), node.id])
        )
      })

      persistWorkspace(workspacePath, next)
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
