/**
 * ============================================================================
 * TreeNode Component
 * ============================================================================
 *
 * Recursive tree node component for displaying files and folders.
 * Each node can be a file (clickable to open) or a folder (expandable).
 *
 * DRAG AND DROP:
 * Rows carry data attributes that the pointer-based drag controller
 * (useTreeDrag, attached once on the TreeView) reads:
 *   data-node-id      the node being picked up
 *   data-node-type    "file" | "folder"
 *   data-drop-folder  the folder a drop here lands in (a file's parent)
 * Nodes themselves hold no drag state, so dragging never re-renders the tree.
 * ============================================================================
 */

import { memo } from "react"
import { Node } from "../../types/workspace"
import { parentId } from "./treeOps"
import "./TreeNode.css"

interface TreeNodeProps {
  node: Node
  activeNodeId?: string
  onOpen: (node: Node) => void
  depth?: number
  expandedNodes: Set<string>
  onToggleExpand?: (nodeId: string) => void
}

const CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const TreeNode = memo(function TreeNode({
  node,
  activeNodeId,
  onOpen,
  depth = 0,
  expandedNodes,
  onToggleExpand,
}: TreeNodeProps) {
  const isFolder = node.type === "folder"
  const isActive = node.id === activeNodeId
  const hasChildren = isFolder && !!node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  const handleClick = () => {
    if (!isFolder) onOpen(node)
    else onToggleExpand?.(node.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    } else if (isFolder && e.key === "ArrowRight" && !isExpanded) {
      e.preventDefault()
      onToggleExpand?.(node.id)
    } else if (isFolder && e.key === "ArrowLeft" && isExpanded) {
      e.preventDefault()
      onToggleExpand?.(node.id)
    }
  }

  const nodeClasses = [
    "tree-node",
    isFolder ? "tree-node--folder" : "tree-node--file",
    isActive ? "tree-node--active" : "",
    isExpanded ? "tree-node--expanded" : "",
  ].filter(Boolean).join(" ")

  return (
    <div className="tree-node-container">
      <div
        className={nodeClasses}
        style={{ "--tree-depth": depth } as React.CSSProperties}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        aria-selected={isActive}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-level={depth + 1}
        data-node-id={node.id}
        data-node-type={isFolder ? "folder" : "file"}
        data-drop-folder={isFolder ? node.id : parentId(node.id)}
      >
        {isFolder ? (
          <span className="tree-node-chevron">{CHEVRON}</span>
        ) : (
          <span className="tree-node-chevron tree-node-chevron--spacer" />
        )}

        <span className="tree-node-icon">
          {isFolder ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path className="tree-node-folder-shape" d="M14 12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5C2 2.94772 2.44772 2.5 3 2.5H6L7.5 4.5H13C13.5523 4.5 14 4.94772 14 5.5V12.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 1H4C3.44772 1 3 1.44772 3 2V14C3 14.5523 3.44772 15 4 15H12C12.5523 15 13 14.5523 13 14V5L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 1V5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>

        <span className="tree-node-name">{node.name}</span>
      </div>

      {hasChildren && isExpanded && (
        <div className="tree-node-children" role="group">
          {node.children!.map((child) => (
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
