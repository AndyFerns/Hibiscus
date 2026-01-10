import { Node } from "../../types/workspace"
import { TreeNode } from "./TreeNode"

export function TreeView({
  tree,
  activeNodeId,
  onOpen
}: {
  tree: Node[]
  activeNodeId?: string
  onOpen: (node: Node) => void
}) {
  return (
    <div style={{ padding: 8 }}>
      {tree.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          activeNodeId={activeNodeId}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
