import { Node } from "../../types/workspace"

export function TreeNode({
  node,
  onOpen
}: {
  node: Node
  onOpen: (node: Node) => void
}) {
  const isFolder = !!node.children

  return (
    <div style={{ marginLeft: 12 }}>
      <div onClick={() => !isFolder && onOpen(node)}>
        {isFolder ? "📁" : "📄"} {node.name}
      </div>

      {isFolder &&
        node.children?.map(child => (
          <TreeNode key={child.id} node={child} onOpen={onOpen} />
        ))}
    </div>
  )
}
