import { Node } from "../../types/workspace"

export function TreeNode({
  node,
  activeNodeId,
  onOpen,
  depth = 0
}: {
  node: Node
  activeNodeId?: string
  onOpen: (node: Node) => void
  depth?: number
}) {
  const isFolder = node.type === "folder"
  const isActive = node.id === activeNodeId

  return (
    <div>
      <div
        style={{
          paddingLeft: depth * 12,
          cursor: "pointer",
          userSelect: "none",
          background: isActive ? "#3a3a3a" : "transparent",
          color: isActive ? "#fff" : "inherit",
          borderRadius: 4,
          padding: "2px 4px"
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
            activeNodeId={activeNodeId}
            onOpen={onOpen}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}
