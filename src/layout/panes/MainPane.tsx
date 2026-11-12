import { memo, useCallback } from "react"
import { KnowledgeGraphView } from "../../features/knowledge/KnowledgeGraphView"
import { TabBar } from "../../components/TabBar/TabBar"
import { EditorView, CursorPosition } from "../../components/Editor/EditorView"
import type { OpenFile } from "../../types/editor"

type FileNodeLike = { id: string; name: string; path: string; type: "file" | "folder" }

export interface MainPaneProps {
  centerView: "editor" | "graph"
  setCenterView: (view: "editor" | "graph") => void
  knowledgeGraph: any
  knowledgeLoading?: boolean
  knowledgeError?: string | null
  activeFile: any | null
  activeFilePath: string | null
  activeFileId: string | null
  fileContent: string
  fileVersion: number
  openFiles: OpenFile[]
  workspaceRoot?: string | null
  markdownViewMode: "live-preview" | "source"
  onToggleMarkdownViewMode: () => void
  handleGraphNodeClick: (filePath: string) => void
  switchTab: (id: string) => void
  closeTab: (id: string) => void
  closeTabs?: (ids: string[]) => void
  reorderTabs?: (from: number, to: number) => void
  renameFile?: (path: string, newName: string) => Promise<string | null>
  saveFileByPath?: (path: string) => void
  saveAllFiles?: () => void
  handleFileOpen: (node: FileNodeLike) => void
  handleEditorChange: (value: string, path?: string) => void
  setCursorPosition: (position: CursorPosition) => void
  saveCurrentFile: () => void
}

const SourceIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
)
const PreviewIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
)

function MainPaneImpl(props: MainPaneProps) {
  const { setCenterView, handleFileOpen } = props

  const handleBack = useCallback(() => setCenterView("editor"), [setCenterView])

  const handleOpenPath = useCallback(
    (filePath: string) =>
      handleFileOpen({
        id: filePath,
        name: filePath.split(/[/\\]/).pop() || filePath,
        path: filePath,
        type: "file",
      }),
    [handleFileOpen]
  )

  const isMarkdown = !!props.activeFilePath && props.activeFilePath.toLowerCase().endsWith(".md")

  return (
    <>
      {/* Knowledge Graph — mounted only while the graph view is active. */}
      {props.centerView === "graph" && (
        <KnowledgeGraphView
          graph={props.knowledgeGraph}
          activeFilePath={props.activeFilePath}
          loading={props.knowledgeLoading}
          error={props.knowledgeError}
          onNodeClick={props.handleGraphNodeClick}
          onBack={handleBack}
        />
      )}

      {/* Editor view — hidden (not unmounted) when graph is active so the
          Monaco instance and its models survive. */}
      <div
        className="editor-wrapper"
        style={props.centerView === "editor" ? undefined : HIDDEN}
      >
        <TabBar
          openFiles={props.openFiles}
          activeFileId={props.activeFileId}
          workspaceRoot={props.workspaceRoot ?? null}
          onSelectTab={props.switchTab}
          onCloseTab={props.closeTab}
          onCloseTabs={props.closeTabs}
          onReorderTabs={props.reorderTabs}
          onRenameFile={props.renameFile}
          onSaveFile={props.saveFileByPath}
          onSaveAll={props.saveAllFiles}
        />

        {props.activeFile && props.activeFilePath ? (
          <div className="editor-container">
            {isMarkdown && (
              <button
                className="md-view-toggle-btn"
                onClick={props.onToggleMarkdownViewMode}
                title={`Switch to ${props.markdownViewMode === "live-preview" ? "Source" : "Live Preview"} Mode (Ctrl+M)`}
              >
                {props.markdownViewMode === "live-preview" ? (
                  <>
                    {SourceIcon}
                    <span>Source</span>
                  </>
                ) : (
                  <>
                    {PreviewIcon}
                    <span>Preview</span>
                  </>
                )}
              </button>
            )}
            <EditorView
              path={props.activeFilePath}
              content={props.fileContent}
              version={props.fileVersion}
              onChange={props.handleEditorChange}
              onCursorChange={props.setCursorPosition}
              onSave={props.saveCurrentFile}
              markdownViewMode={props.markdownViewMode}
              onOpenFile={handleOpenPath}
            />
          </div>
        ) : (
          <div className="editor-placeholder">
            <span className="editor-placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 12.5C14 13.0523 13.5523 13.5 13 13.5H3C2.44772 13.5 2 13.0523 2 12.5V3.5C2 2.94772 2.44772 2.5 3 2.5H6L7.5 4.5H13C13.5523 4.5 14 4.94772 14 5.5V12.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="editor-placeholder-text">
              Select a file from the tree to start editing
            </span>
          </div>
        )}
      </div>
    </>
  )
}

const HIDDEN = { display: "none" } as const

/** Memoized: typing and pomodoro ticks no longer re-render the editor area. */
export const MainPane = memo(MainPaneImpl)
