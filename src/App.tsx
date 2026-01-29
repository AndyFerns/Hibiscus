/**
 * ============================================================================
 * App Component - Main Application Entry Point
 * ============================================================================
 * 
 * The root component that orchestrates the entire Hibiscus workspace editor.
 * 
 * ARCHITECTURE:
 * - Uses Workbench layout for IDE-like panels (top, left, main, right, bottom)
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

import { useState, useCallback } from "react"
import { Workbench } from "./layout/workbench"
import { TitleBar } from "./components/TitleBar/TitleBar"
import { TreeView } from "./components/Tree/TreeView"
import { EditorView, CursorPosition } from "./components/Editor/EditorView"
import { Calendar } from "./components/Calendar/Calendar"
import { LayoutToggle } from "./components/StatusBar/LayoutToggle"

import { useWorkspaceController } from "./hooks/useWorkspaceController"
import { useEditorController } from "./hooks/useEditorController"

import "./App.css"

export default function App() {
  // ============================================================================
  // WORKSPACE STATE
  // Tree structure, root path, and navigation
  // ============================================================================
  const {
    workspace,
    workspaceRoot,
    changeWorkspace,
    openNode,
  } = useWorkspaceController()

  // ============================================================================
  // EDITOR STATE
  // Active file, content, and save handling
  // ============================================================================
  const {
    activeFile,
    activeFilePath,
    fileContent,
    isDirty,
    openFile,
    onChange,
  } = useEditorController(workspaceRoot)

  // ============================================================================
  // PANEL VISIBILITY STATE
  // Controls which panels are visible in the layout
  // ============================================================================
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(false)

  // ============================================================================
  // CURSOR POSITION STATE
  // Tracks current line/column for status bar display
  // ============================================================================
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    line: 1,
    column: 1,
  })

  /**
   * Handle file open events from the tree view
   * Updates both workspace session (for persistence) and editor state
   */
  const handleFileOpen = (node: Parameters<typeof openNode>[0]) => {
    openNode(node)
    openFile(node)
    // Reset cursor position when opening new file
    setCursorPosition({ line: 1, column: 1 })
  }

  /**
   * Toggle left panel (Explorer) visibility
   */
  const toggleLeftPanel = useCallback(() => {
    setShowLeftPanel((prev) => !prev)
  }, [])

  /**
   * Toggle right panel (Calendar) visibility
   */
  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((prev) => !prev)
  }, [])

  return (
    <Workbench
      /* ----------------------------------------------------------------
       * TITLE BAR (Custom Window Titlebar)
       * Application header with menus and window controls
       * ---------------------------------------------------------------- */
      top={
        <TitleBar
          workspaceRoot={workspaceRoot}
          onOpenFolder={changeWorkspace}
          onToggleLeftPanel={toggleLeftPanel}
          onToggleRightPanel={toggleRightPanel}
          showLeftPanel={showLeftPanel}
          showRightPanel={showRightPanel}
        />
      }

      /* ----------------------------------------------------------------
       * LEFT PANEL - File Tree
       * Displays the workspace file structure for navigation
       * ---------------------------------------------------------------- */
      left={
        showLeftPanel ? (
          <TreeView
            tree={workspace.tree}
            activeNodeId={workspace.session?.active_node}
            onOpen={handleFileOpen}
          />
        ) : null
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
                  onCursorChange={setCursorPosition}
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
      showRightPanel={showRightPanel}

      /* ----------------------------------------------------------------
       * BOTTOM PANEL - Status Bar
       * Displays status info, cursor position, and layout controls
       * ---------------------------------------------------------------- */
      bottom={
        <div className="status-bar">
          {/* Left: Workspace info */}
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

          {/* Right: Cursor position, file info, layout controls, version */}
          <div className="status-bar-right">
            {/* Cursor Position (Line:Column) */}
            {activeFile && (
              <span className="status-item" title="Cursor position">
                Ln {cursorPosition.line}, Col {cursorPosition.column}
              </span>
            )}

            {/* Current file name */}
            {activeFile && (
              <span className="status-item status-item--muted">
                {activeFile.name}
              </span>
            )}

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
              Hibiscus v0.2.0
            </span>
          </div>
        </div>
      }
    />
  )
}
