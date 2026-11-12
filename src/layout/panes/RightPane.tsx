import { memo } from "react"
import { RightPanelContainer } from "../../components/RightPanel/RightPanelContainer"

export interface RightPaneProps {
  workspaceRoot: string | null
  onOpenFile: (filePath: string, line?: number) => void
  pomodoroState: any
  pomodoroActions: any
  flashcards: any
  notes: any
  statsData: any
  knowledgeGraph: any
  knowledgeIndex: any
  knowledgeBacklinks: Record<string, string[]> | null
  knowledgeLoading?: boolean
  knowledgeError?: string | null
  activeFilePath: string | null
}

function RightPaneImpl(props: RightPaneProps) {
  return (
    <RightPanelContainer
      workspaceRoot={props.workspaceRoot}
      onOpenFile={props.onOpenFile}
      pomodoroState={props.pomodoroState}
      pomodoroActions={props.pomodoroActions}
      flashcards={props.flashcards}
      notes={props.notes}
      statsData={props.statsData}
      knowledgeGraph={props.knowledgeGraph}
      knowledgeIndex={props.knowledgeIndex}
      knowledgeBacklinks={props.knowledgeBacklinks}
      knowledgeLoading={props.knowledgeLoading}
      knowledgeError={props.knowledgeError}
      activeFilePath={props.activeFilePath}
    />
  )
}

/** Memoized: skips re-rendering when its props are unchanged. */
export const RightPane = memo(RightPaneImpl)
