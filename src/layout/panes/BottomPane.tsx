import { memo } from "react"
import { useCursorPosition } from "../../state/cursorStore"
import { PomodoroTimer } from "../../features/pomodoro/PomodoroTimer"
import { ThemeSelector } from "../../components/StatusBar/ThemeSelector"
import { LayoutToggle } from "../../components/StatusBar/LayoutToggle"

export interface BottomPaneProps {
  workspaceRoot: string | null
  focusMode: boolean
  activeFile: any | null
  pomodoroState: any
  showLeftPanel: boolean
  showRightPanel: boolean
  appName: string
  appVersion: string
  openStudyTool: (tool: "pomodoro" | "flashcards" | "notes" | "stats") => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
}

/** Subscribes to the cursor store so only this span re-renders while typing. */
function CursorStatus() {
  const { line, column } = useCursorPosition()
  return (
    <span className="status-item" title="Cursor position">
      Ln {line}, Col {column}
    </span>
  )
}

function BottomPaneImpl({
  workspaceRoot,
  focusMode,
  activeFile,
  pomodoroState,
  showLeftPanel,
  showRightPanel,
  appName,
  appVersion,
  openStudyTool,
  toggleLeftPanel,
  toggleRightPanel
}: BottomPaneProps) {
  return (
    <div className="status-bar">
      {/* Left: Workspace info + Focus mode indicator */}
      <div className="status-bar-left">
        {workspaceRoot ? (
          <span className="status-item">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M14 12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5C2 2.94772 2.44772 2.5 3 2.5H6L7.5 4.5H13C13.5523 4.5 14 4.94772 14 5.5V12.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {workspaceRoot.split(/[/\\]/).pop()}
          </span>
        ) : (
          <span className="status-item status-item--muted">
            No workspace
          </span>
        )}
        {focusMode && (
          <span className="status-item status-item--accent" title="Focus Mode active">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Focus
          </span>
        )}
      </div>

      {/* Right: Pomodoro timer, Theme, Layout, Version */}
      <div className="status-bar-right">
        {/* Cursor Position (Line:Column) */}
        {activeFile && (
          <CursorStatus />
        )}

        {/* Current file name */}
        {activeFile && (
          <span className="status-item status-item--muted">
            {activeFile.name}
          </span>
        )}

        {/* Pomodoro mini timer (visible when running) */}
        <PomodoroTimer
          state={pomodoroState}
          onClick={() => openStudyTool("pomodoro")}
        />

        {/* Theme Selector */}
        <ThemeSelector />

        {/* Separator */}
        <span className="status-separator" />

        {/* Layout Toggle */}
        <LayoutToggle
          showLeftPanel={showLeftPanel}
          showRightPanel={showRightPanel}
          onToggleLeftPanel={toggleLeftPanel}
          onToggleRightPanel={toggleRightPanel}
        />

        {/* Version */}
        <span className="status-item status-item--muted">
          {appName} v{appVersion}
        </span>
      </div>
    </div>
  )
}

export const BottomPane = memo(BottomPaneImpl)
