/**
 * ============================================================================
 * TreeView Component
 * ============================================================================
 *
 * Container component for displaying the workspace file tree.
 * Renders a list of top-level TreeNode components for each root item.
 *
 * FEATURES:
 * - Expandable/collapsible folder hierarchy
 * - "New File" and "New Folder" action buttons in the header
 * - Native HTML5 drag-and-drop for reordering and moving nodes
 *
 * This component is rendered in the Workbench's left panel slot.
 * ============================================================================
 */

import { Node } from "../../types/workspace"
import { TreeNode } from "./TreeNode"
import "./TreeView.css"

/**
 * TreeView Props Interface
 * @property tree - Array of root-level nodes to display
 * @property activeNodeId - ID of the currently selected node
 * @property onOpen - Callback fired when a file node is clicked
 * @property onNewFile - Callback fired when the "New File" button is clicked
 * @property onNewFolder - Callback fired when the "New Folder" button is clicked
 * @property onMoveNode - Callback fired when a node is dropped onto a folder
 */
interface TreeViewProps {
  tree: Node[]
  activeNodeId?: string
  onOpen: (node: Node) => void
  onNewFile?: () => void
  onNewFolder?: () => void
  onMoveNode?: (sourceId: string, destinationParentId: string) => void
}

import { memo, useState, useCallback } from "react"

export const TreeView = memo(function TreeView({
  tree,
  activeNodeId,
  onOpen,
  onNewFile,
  onNewFolder,
  onMoveNode,
}: TreeViewProps) {
  // State to track which folders are expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Currently dragged node ID for visual feedback
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)

  // Toggle folder expansion state
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // Drag start handler -- stores the dragged node ID
  const handleDragStart = useCallback((nodeId: string) => {
    setDraggedNodeId(nodeId)
  }, [])

  // Drag end handler -- clears the dragged state
  const handleDragEnd = useCallback(() => {
    setDraggedNodeId(null)
  }, [])

  // Drop handler -- delegates to parent onMoveNode callback
  const handleDrop = useCallback(
    (targetNodeId: string) => {
      if (draggedNodeId && draggedNodeId !== targetNodeId && onMoveNode) {
        onMoveNode(draggedNodeId, targetNodeId)
      }
      setDraggedNodeId(null)
    },
    [draggedNodeId, onMoveNode]
  )

  return (
    <div className="tree-view" role="tree" aria-label="File explorer">
      {/* Header with title and action buttons */}
      <div className="tree-view-header">
        <span className="tree-view-title">Explorer</span>

        {/* Action buttons for creating new files/folders */}
        <div className="tree-view-actions">
          {onNewFile && (
            <button
              className="tree-view-action-btn"
              onClick={onNewFile}
              title="New File (Ctrl+N)"
              aria-label="New File"
            >
              {/* SVG file-plus icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M9 1H4C3.44772 1 3 1.44772 3 2V14C3 14.5523 3.44772 15 4 15H12C12.5523 15 13 14.5523 13 14V5L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 1V5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 8V12M6 10H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {onNewFolder && (
            <button
              className="tree-view-action-btn"
              onClick={onNewFolder}
              title="New Folder"
              aria-label="New Folder"
            >
              {/* SVG folder-plus icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5C2 2.94772 2.44772 2.5 3 2.5H6L7.5 4.5H13C13.5523 4.5 14 4.94772 14 5.5V12.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 7.5V11.5M6 9.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tree content area */}
      <div className="tree-view-content">
        {tree.length > 0 ? (
          tree.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              activeNodeId={activeNodeId}
              onOpen={onOpen}
              expandedNodes={expandedNodes}
              onToggleExpand={handleToggleExpand}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              isDragging={draggedNodeId === node.id}
            />
          ))
        ) : (
          <div className="tree-view-empty">
            <span>No files in workspace</span>
          </div>
        )}
      </div>
    </div>
  )
})
