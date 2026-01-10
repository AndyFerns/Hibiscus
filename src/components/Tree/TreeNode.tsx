import { Node } from "../../types/workspace"

export function TreeNode({
  node,
  onOpen,
  depth = 0
}: {
  node: Node
  onOpen: (node: Node) => void
  depth?: number
}) {
  const isFolder = node.type === "folder"

  return (
    <div>
      <div
        style={{
          paddingLeft: depth * 12,
          cursor: "pointer",
          userSelect: "none"
        }}
        onClick={() => !isFolder && onOpen(node)}
      >
        {isFolder ? "📁" : "📄"} {node.name}
      </div>

      {isFolder &&
        node.children?.map(child => (
          <TreeNode
            key={child.id}
            node={child}
            onOpen={onOpen}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}
