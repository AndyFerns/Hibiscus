import { memo } from "react"
import { TitleBar } from "../../components/TitleBar/TitleBar"

export interface TopPaneProps {
  workspaceRoot: string | null
  showLeftPanel: boolean
  showRightPanel: boolean
  focusMode: boolean
  onChangeWorkspace: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onSaveCurrentFile: () => void
  onSaveAs: () => void
  onSaveAllFiles: () => void
  onCloseFile: () => void
  onOpenFile: () => void
  onNewFile: () => void
  onNewFolder: () => void
  onCloseFolder: () => void
  onAppExit: () => void
  onOpenStudyTool: (tool: "pomodoro" | "flashcards" | "notes" | "stats") => void
  onToggleFocusMode: () => void
  onOpenSettings: () => void
}

function TopPaneImpl(props: TopPaneProps) {
  return (
    <TitleBar
      workspaceRoot={props.workspaceRoot}
      onOpenFolder={props.onChangeWorkspace}
      onToggleLeftPanel={props.onToggleLeftPanel}
      onToggleRightPanel={props.onToggleRightPanel}
      showLeftPanel={props.showLeftPanel}
      showRightPanel={props.showRightPanel}
      onSave={props.onSaveCurrentFile}
      onSaveAs={props.onSaveAs}
      onSaveAll={props.onSaveAllFiles}
      onCloseFile={props.onCloseFile}
      onOpenFile={props.onOpenFile}
      onNewFile={props.onNewFile}
      onNewFolder={props.onNewFolder}
      onCloseFolder={props.onCloseFolder}
      onExit={props.onAppExit}
      onOpenStudyTool={props.onOpenStudyTool}
      onToggleFocusMode={props.onToggleFocusMode}
      focusMode={props.focusMode}
      onOpenSettings={props.onOpenSettings}
    />
  )
}
/** Memoized: skips re-rendering when its props are unchanged. */
export const TopPane = memo(TopPaneImpl)
