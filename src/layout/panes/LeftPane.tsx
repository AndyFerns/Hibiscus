import { memo } from "react"
import { TreeView } from "../../components/Tree/TreeView"

type LeftPaneProps = {
  visible: boolean
  hiddenByFocusMode: boolean
  tree: any
  activeNodeId?: string
  onOpen: (...args: any[]) => void
  onNewFile: () => void
  onNewFolder: () => void
  onMoveNode: (sourceId: string, destinationParentId: string) => unknown
  onToggleGraph: () => void
  moveError?: string | null
  onDismissMoveError?: () => void
}

function LeftPaneImpl({
  visible,
  hiddenByFocusMode,
  tree,
  activeNodeId,
  onOpen,
  onNewFile,
  onNewFolder,
  onMoveNode,
  onToggleGraph,
  moveError,
  onDismissMoveError,
}: LeftPaneProps) {
  if (!visible || hiddenByFocusMode) {
    return null
  }

  return (
    <TreeView
      tree={tree}
      activeNodeId={activeNodeId}
      onOpen={onOpen}
      onNewFile={onNewFile}
      onNewFolder={onNewFolder}
      onMoveNode={onMoveNode}
      onToggleGraph={onToggleGraph}
      moveError={moveError}
      onDismissMoveError={onDismissMoveError}
    />
  )
}

export const LeftPane = memo(LeftPaneImpl)
