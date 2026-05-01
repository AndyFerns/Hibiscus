/**
 * ============================================================================
 * TreeNode Component
 * ============================================================================
 *
 * Recursive tree node component for displaying files and folders.
 * Each node can be a file (clickable to open) or a folder (expandable).
 *
 * DRAG AND DROP:
 * Uses native HTML5 drag-and-drop API to enable:
 *   - Dragging any node
 *   - Dropping onto folders to move nodes
 *   - Visual drop target highlighting
 * This avoids adding external DnD libraries while providing sufficient UX.
 *
 * STYLING NOTE:
 * This component uses TreeNode.css for styling with dynamic depth-based
 * indentation via CSS custom properties.
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
 * @property onDragStart - Callback when drag begins on this node
 * @property onDragEnd - Callback when drag ends
 * @property onDrop - Callback when another node is dropped on this node
 * @property isDragging - Whether this specific node is currently being dragged
 */
interface TreeNodeProps {
  node: Node
  activeNodeId?: string
  onOpen: (node: Node) => void
  depth?: number
  expandedNodes?: Set<string>
  onToggleExpand?: (nodeId: string) => void
  onDragStart?: (nodeId: string) => void
  onDragEnd?: () => void
  onDrop?: (sourceId: string, targetNodeId: string) => void
  isDragging?: boolean
}

import { memo, useState, useCallback } from "react"

export const TreeNode = memo(function TreeNode({
  node,
  activeNodeId,
  onOpen,
  depth = 0,
  expandedNodes = new Set(),
  onToggleExpand,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging = false,
}: TreeNodeProps) {
  // Determine node type for styling and behavior
  const isFolder = node.type === "folder"
  const isActive = node.id === activeNodeId
  const hasChildren = isFolder && node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  // Drop target visual state -- true when a dragged node hovers over this folder
  const [isDropTarget, setIsDropTarget] = useState(false)

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

  // ---- Drag and Drop Handlers ----

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Store the node ID in the drag data transfer
      e.dataTransfer.setData("text/plain", node.id)
      e.dataTransfer.effectAllowed = "move"
      onDragStart?.(node.id)
    },
    [node.id, onDragStart]
  )

  const handleDragEnd = useCallback(() => {
    onDragEnd?.()
  }, [onDragEnd])

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      // Only allow dropping on folders
      if (isFolder) {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setIsDropTarget(true)
      }
    },
    [isFolder]
  )

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false)
  }, [])

  const handleDropEvent = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation() // Prevent parent folders from also triggering drop
      setIsDropTarget(false)
      
      const sourceId = e.dataTransfer.getData("text/plain")
      if (isFolder && sourceId) {
        onDrop?.(sourceId, node.id)
      }
    },
    [isFolder, node.id, onDrop]
  )

  // Build CSS class string based on node state
  const nodeClasses = [
    "tree-node",
    isFolder ? "tree-node--folder" : "tree-node--file",
    isActive ? "tree-node--active" : "",
    isDragging ? "tree-node--dragging" : "",
    isDropTarget ? "tree-node--drop-target" : "",
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
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
      >
        {/* Chevron icon for folders */}
        {isFolder && (
          <span className="tree-node-chevron">
            {isExpanded ? "\u25BC" : "\u25B6"}
          </span>
        )}

        {/* SVG file/folder icon instead of emoji */}
        <span className="tree-node-icon">
          {isFolder ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M14 12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5C2 2.94772 2.44772 2.5 3 2.5H6L7.5 4.5H13C13.5523 4.5 14 4.94772 14 5.5V12.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill={isExpanded ? "rgba(122, 162, 247, 0.15)" : "none"}/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 1H4C3.44772 1 3 1.44772 3 2V14C3 14.5523 3.44772 15 4 15H12C12.5523 15 13 14.5523 13 14V5L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 1V5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
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
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              isDragging={false}
            />
          ))}
        </div>
      )}
    </div>
  )
})
