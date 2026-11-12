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
 * - Pointer-driven drag and drop (useTreeDrag) to move files and folders,
 *   onto folders, the workspace root, or the tab bar to open a file
 *
 * This component is rendered in the Workbench's left panel slot.
 * ============================================================================
 */

import { Node } from "../../types/workspace"
import { TreeNode } from "./TreeNode"
import { useTreeDrag } from "./useTreeDrag"
import { detectSeparator, movedId, remapIds } from "./treeOps"
import "./TreeView.css"
import "../dnd/dnd.css"

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
  onMoveNode?: (sourceId: string, destinationParentId: string) => unknown
  onToggleGraph?: () => void
  /** Last failed move, shown as a dismissible toast */
  moveError?: string | null
  onDismissMoveError?: () => void
}

import { memo, useState, useCallback, useEffect, useRef } from "react"

export const TreeView = memo(function TreeView({
  tree,
  activeNodeId,
  onOpen,
  onNewFile,
  onNewFolder,
  onMoveNode,
  onToggleGraph,
  moveError,
  onDismissMoveError,
}: TreeViewProps) {
  // State to track which folders are expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const contentRef = useRef<HTMLDivElement>(null)

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

  const expandNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      if (prev.has(nodeId)) return prev
      const next = new Set(prev)
      next.add(nodeId)
      return next
    })
  }, [])

  // Keep a moved folder (and anything open inside it) expanded under its new
  // id, open the destination so the item is visible, then move it on disk.
  const treeRef = useRef(tree)
  treeRef.current = tree
  const handleMove = useCallback(
    (sourceId: string, targetFolderId: string) => {
      const current = treeRef.current
      const newId = movedId(current, sourceId, targetFolderId)
      const sep = detectSeparator(current)
      setExpandedNodes(prev => {
        let next = remapIds(prev, sourceId, newId, sep)
        if (targetFolderId && !next.has(targetFolderId)) {
          next = new Set(next)
          next.add(targetFolderId)
        }
        return next
      })
      return onMoveNode?.(sourceId, targetFolderId)
    },
    [onMoveNode]
  )

  const { onPointerDown, onClickCapture } = useTreeDrag({
    tree,
    scrollRef: contentRef,
    expandedNodes,
    expandNode,
    onMoveNode: handleMove,
    onOpen,
  })

  // Auto-dismiss the move error toast.
  useEffect(() => {
    if (!moveError || !onDismissMoveError) return
    const t = window.setTimeout(onDismissMoveError, 6000)
    return () => clearTimeout(t)
  }, [moveError, onDismissMoveError])

  return (
    <div className="tree-view" role="tree" aria-label="File explorer">
      {/* Header with title and action buttons */}
      <div className="tree-view-header">
        <span className="tree-view-title">Explorer</span>

        {/* Action buttons for creating new files/folders and toggling graph */}
        <div className="tree-view-actions">
          {onToggleGraph && (
            <button
              className="tree-view-action-btn"
              onClick={onToggleGraph}
              title="Knowledge Graph (Ctrl+G)"
              aria-label="Knowledge Graph"
            >
              {/* SVG graph/network icon */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6 7L10 5M6 9L10 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
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
      {/* Tree content area. Empty space here is the workspace-root drop zone. */}
      <div
        className="tree-view-content"
        ref={contentRef}
        data-drop-folder=""
        data-drop-root=""
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
      >
        {tree.length > 0 ? (
          tree.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              activeNodeId={activeNodeId}
              onOpen={onOpen}
              expandedNodes={expandedNodes}
              onToggleExpand={handleToggleExpand}
            />
          ))
        ) : (
          <div className="tree-view-empty">
            <span>No files in workspace</span>
          </div>
        )}
      </div>

      {moveError && (
        <div className="tree-view-toast" role="alert">
          <span>{moveError}</span>
          {onDismissMoveError && (
            <button className="tree-view-toast-close" onClick={onDismissMoveError} aria-label="Dismiss">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
})
