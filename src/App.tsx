/**
 * ============================================================================
 * App Component - Main Application Entry Point
 * ============================================================================
 * 
 * The root component that orchestrates the entire Hibiscus workspace editor.
 * 
 * ARCHITECTURE:
 * - Uses Workbench layout for IDE-like panels (top, left, main, bottom)
 * - Workspace state managed by useWorkspaceController hook
 * - Editor state managed by useEditorController hook
 * - Components communicate through callbacks and shared state
 * 
 * STYLING:
 * - Uses App.css for main content styling
 * - Child components have their own CSS modules
 * - Design tokens from theme.css ensure consistency
 * ============================================================================
 */

import { useState } from "react"
import { Workbench } from "./layout/workbench"
import { TopBar } from "./components/TopBar/TopBar"
import { TreeView } from "./components/Tree/TreeView"
import { EditorView } from "./components/Editor/EditorView"
import { Calendar } from "./components/Calendar/Calendar"

import { useWorkspaceController } from "./hooks/useWorkspaceController"
import { useEditorController } from "./hooks/useEditorController"

import "./App.css"

export default function App() {
  // Workspace state: tree structure, root path, and navigation
  const {
    workspace,
    workspaceRoot,
    changeWorkspace,
    openNode,
  } = useWorkspaceController()

  // Editor state: active file, content, and save handling
  const {
    activeFile,
    activeFilePath,
    fileContent,
    isDirty,
    openFile,
    onChange,
  } = useEditorController(workspaceRoot)

  // Right panel visibility state (for calendar)
  // TODO: Add toggle in View menu to control this
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showCalendar, _setShowCalendar] = useState(false)

  /**
   * Handle file open events from the tree view
   * Updates both workspace session (for persistence) and editor state
   */
  const handleFileOpen = (node: Parameters<typeof openNode>[0]) => {
    openNode(node)
    openFile(node)
  }

  return (
    <Workbench
      /* ----------------------------------------------------------------
       * TOP BAR
       * Application header with branding and workspace info
       * ---------------------------------------------------------------- */
      top={
        <TopBar
          workspaceRoot={workspaceRoot}
          onChangeWorkspace={changeWorkspace}
        />
      }

      /* ----------------------------------------------------------------
       * LEFT PANEL - File Tree
       * Displays the workspace file structure for navigation
       * ---------------------------------------------------------------- */
      left={
        <TreeView
          tree={workspace.tree}
          activeNodeId={workspace.session?.active_node}
          onOpen={handleFileOpen}
        />
      }

      /* ----------------------------------------------------------------
       * MAIN PANEL - Editor Area
       * Monaco editor when a file is selected, placeholder otherwise
       * ---------------------------------------------------------------- */
      main={
        <div className="editor-wrapper">
          {activeFile && activeFilePath ? (
            <>
              {/* File header with name and dirty indicator */}
              <div className="editor-header">
                <span className="editor-header-title">
                  <span className="editor-header-icon">📄</span>
                  {activeFile.name}
                  {isDirty && <span className="editor-dirty-indicator">*</span>}
                </span>
                <div className="editor-header-actions">
                  {isDirty && (
                    <span className="editor-unsaved-hint" title="Press Ctrl+S to save">
                      Unsaved
                    </span>
                  )}
                </div>
              </div>

              {/* Monaco editor container */}
              <div className="editor-container">
                <EditorView
                  path={activeFilePath}
                  content={fileContent}
                  onChange={onChange}
                />
              </div>
            </>
          ) : (
            /* Placeholder when no file is selected */
            <div className="editor-placeholder">
              <span className="editor-placeholder-icon">📂</span>
              <span className="editor-placeholder-text">
                Select a file from the tree to start editing
              </span>
            </div>
          )}
        </div>
      }

      /* ----------------------------------------------------------------
       * RIGHT PANEL - Calendar (when visible)
       * Study planning and scheduling widget
       * Toggle with View > Calendar in the menu
       * ---------------------------------------------------------------- */
      right={<Calendar />}
      showRightPanel={showCalendar}

      /* ----------------------------------------------------------------
       * BOTTOM PANEL - Status Bar
       * Displays status info, logs, and quick actions
       * ---------------------------------------------------------------- */
      bottom={
        <div className="status-bar">
          <div className="status-bar-left">
            {workspaceRoot ? (
              <span className="status-item">
                📁 {workspaceRoot.split(/[/\\]/).pop()}
              </span>
            ) : (
              <span className="status-item status-item--muted">
                No workspace
              </span>
            )}
          </div>
          <div className="status-bar-right">
            {activeFile && (
              <span className="status-item">
                {activeFile.name}
              </span>
            )}
            <span className="status-item status-item--muted">
              Hibiscus v0.2.0
            </span>
          </div>
        </div>
      }
    />
  )
}

