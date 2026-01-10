import { Node } from "../../types/workspace"
import { TreeNode } from "./TreeNode"

export function TreeView({
  tree,
  onOpen
}: {
  tree: Node[]
  onOpen: (node: Node) => void
}) {
  return (
    <div style={{ padding: 8 }}>
      {tree.map(node => (
        <TreeNode key={node.id} node={node} onOpen={onOpen} />
      ))}
    </div>
  )
}
