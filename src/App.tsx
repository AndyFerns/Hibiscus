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

const handleOpenNode = (node: Node) => {
    openNode(node)

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
          onOpen={handleOpenNode}
        />
      }
      main={
        <div style={{ padding: 16 }}>
          <h2>Main Editor Area</h2>
          <p>Select a file from the tree.</p>
        </div>
      }
      bottom={
        <div style={{ padding: 8 }}>Status / Logs</div>
      }
    />
  )
}
