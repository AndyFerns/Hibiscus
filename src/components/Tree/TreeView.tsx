/**
 * ============================================================================
 * TreeView Component
 * ============================================================================
 * 
 * Container component for displaying the workspace file tree.
 * Renders a list of top-level TreeNode components for each root item.
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
 */
interface TreeViewProps {
  tree: Node[]
  activeNodeId?: string
  onOpen: (node: Node) => void
}

export function TreeView({
  tree,
  activeNodeId,
  onOpen
}: TreeViewProps) {
  return (
    <div className="tree-view" role="tree" aria-label="File explorer">
      {/* Optional header - can be extended for search/filter */}
      <div className="tree-view-header">
        <span className="tree-view-title">Explorer</span>
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
}

