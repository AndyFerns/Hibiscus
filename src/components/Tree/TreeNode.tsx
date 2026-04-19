/**
 * ============================================================================
 * TreeNode Component
 * ============================================================================
 * 
 * Recursive tree node component for displaying files and folders.
 * Each node can be a file (clickable to open) or a folder (expandable).
 * 
 * STYLING NOTE:
 * This component previously used inline styles but has been refactored
 * to use TreeNode.css for better maintainability and theming support.
 * The CSS classes use dynamic depth-based indentation via CSS custom properties.
 * ============================================================================
 */

import { Node } from "../../types/workspace"
import "./TreeNode.css"

/**
 * TreeNode Props Interface
 * @property node - The file/folder node data
 * @property activeNodeId - ID of the currently selected node (for highlighting)
 * @property onOpen - Callback fired when a file node is clicked
 * @property depth - Current nesting depth (used for indentation, default: 0)
 * @property expandedNodes - Set of expanded folder node IDs
 * @property onToggleExpand - Callback fired when folder is expanded/collapsed
 */
interface TreeNodeProps {
  node: Node
  activeNodeId?: string
  onOpen: (node: Node) => void
  depth?: number
  expandedNodes?: Set<string>
  onToggleExpand?: (nodeId: string) => void
}

import { memo } from "react"

export const TreeNode = memo(function TreeNode({
  node,
  activeNodeId,
  onOpen,
  depth = 0,
  expandedNodes = new Set(),
  onToggleExpand
}: TreeNodeProps) {
  // Determine node type for styling and behavior
  const isFolder = node.type === "folder"
  const isActive = node.id === activeNodeId
  const hasChildren = isFolder && node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  /**
   * Handle node click events
   * - Files: Trigger onOpen callback
   * - Folders: Toggle expand/collapse state
   */
  const handleClick = () => {
    if (!isFolder) {
      onOpen(node)
    } else if (hasChildren) {
      onToggleExpand?.(node.id)
    }
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    }
  }

  // Build CSS class string based on node state
  const nodeClasses = [
    "tree-node",
    isFolder ? "tree-node--folder" : "tree-node--file",
    isActive ? "tree-node--active" : "",
  ].filter(Boolean).join(" ")

  return (
    <div className="tree-node-container">
      {/* Node label row */}
      <div
        className={nodeClasses}
        style={{
          // CSS custom property for dynamic indentation
          "--tree-depth": depth
        } as React.CSSProperties}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={isFolder ? "treeitem" : "button"}
        tabIndex={0}
        aria-selected={isActive}
        aria-expanded={isFolder ? isExpanded : undefined}
      >
        {/* Chevron icon for folders */}
        {isFolder && (
          <span className="tree-node-chevron">
            {isExpanded ? "▼" : "▶"}
          </span>
        )}

        {/* Icon: folder or file emoji */}
        <span className="tree-node-icon">
          {isFolder ? "📁" : "📄"}
        </span>

        {/* Node name */}
        <span className="tree-node-name">
          {node.name}
        </span>
      </div>

      {/* Recursively render children for folders if expanded */}
      {hasChildren && isExpanded && (
        <div className="tree-node-children" role="group">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              activeNodeId={activeNodeId}
              onOpen={onOpen}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
})

