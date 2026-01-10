import { useState } from "react"
import { Workbench } from "./layout/workbench.tsx"
import { TreeView } from "./components/Tree/TreeView.tsx"
import { Node } from "./types/workspace"

const mockTree: Node[] = [
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

export default function App() {
  const [tree] = useState<Node[]>(mockTree)

  return (
    <Workbench
      left={
        <TreeView
          tree={tree}
          onOpen={(node) => console.log("Open:", node)}
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
