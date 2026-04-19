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
 * - Study tools managed by feature hooks (pomodoro, flashcards, etc.)
 * - Components communicate through callbacks and shared state
 * 
 * PROVIDERS:
 * - ThemeProvider: Theme system with editor adapter
 * - StudyProvider: Focus mode + study panel routing
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
import { RightPanelContainer } from "./components/RightPanel/RightPanelContainer"
import { LayoutToggle } from "./components/StatusBar/LayoutToggle"
import { ThemeSelector } from "./components/StatusBar/ThemeSelector"
import { ShortcutOverlay } from "./components/StatusBar/ShortcutOverlay"
import { ThemeEditor } from "./components/ThemeEditor/ThemeEditor"
import { ThemeProvider } from "./state/ThemeContext"

// Study tools imports
import { StudyProvider, useStudy } from "./features/shared/StudyContext"
import { SettingsModal } from "./features/settings/SettingsModal"
import { useSettings } from "./features/settings/useSettings"
import { PomodoroTimer } from "./features/pomodoro/PomodoroTimer"
import { usePomodoro } from "./features/pomodoro/usePomodoro"
import { useFlashcards } from "./features/flashcards/useFlashcards"
import { useNotesSynthesis } from "./features/notes/useNotesSynthesis"
import { useStudyStats } from "./features/stats/useStudyStats"

import { useWorkspaceController } from "./hooks/useWorkspaceController"
import { useEditorController } from "./hooks/useEditorController"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"

import versionInfo from "../version.json"

export const APP_NAME = versionInfo.name;
export const APP_VERSION = versionInfo.version;

import "./App.css"

/**
 * Inner app component that has access to StudyContext.
 * This separation is needed because useStudy() requires StudyProvider
 * to be mounted above it in the tree.
 */
function AppInner() {
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
    fileVersion,
    isDirty,
    openFile,
    onChange,
    saveCurrentFile,
  } = useEditorController(workspaceRoot)

  // ============================================================================
  // STUDY TOOLS STATE
  // Shared context + individual feature hooks
  // ============================================================================
  const {
    focusMode,
    setFocusMode,
    toggleFocusMode,
    setActiveStudyPanel,
    isSettingsOpen,
    setSettingsOpen,
  } = useStudy()

  // Settings hook
  const { settings, updateSettings, resetToDefaults } = useSettings(workspaceRoot)

  // Study statistics hook
  const studyStats = useStudyStats(workspaceRoot)

  // Pomodoro hook (wired to focus mode + stats recording)
  const [pomodoroState, pomodoroActions] = usePomodoro({
    settings: settings.pomodoro,
    onFocusMode: setFocusMode,
    onSessionComplete: (durationSeconds) => {
      studyStats.recordSession({
        date: new Date().toISOString().split("T")[0],
        startTime: new Date().toISOString(),
        duration: durationSeconds,
        type: "pomodoro",
        completedFull: true,
      })
    },
  })

  // Flashcards hook
  const flashcards = useFlashcards(workspaceRoot)

  // Notes synthesis hook
  const notes = useNotesSynthesis(workspaceRoot)

  // ============================================================================
  // PANEL VISIBILITY STATE
  // Controls which panels are visible in the layout
  // ============================================================================
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false)

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
   * Toggle right panel (Calendar/Study Tools) visibility
   */
  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((prev) => !prev)
  }, [])

  /**
   * Open file by path string (for Calendar linked files)
   */
  const openFileByPath = useCallback((filePath: string) => {
    const name = filePath.split(/[/\\]/).pop() || filePath
    handleFileOpen({
      id: filePath,
      name,
      path: filePath,
      type: "file"
    })
  }, [handleFileOpen])

  /**
   * Open a study tool panel in the right sidebar.
   * Also ensures the right panel is visible.
   */
  const openStudyTool = useCallback(
    (tool: "pomodoro" | "flashcards" | "notes" | "stats") => {
      setActiveStudyPanel(tool)
      setShowRightPanel(true)
    },
    [setActiveStudyPanel]
  )

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // Global registry for app-wide shortcuts
  // ============================================================================
  useKeyboardShortcuts({
    onOpenFolder: changeWorkspace,
    onToggleLeftPanel: toggleLeftPanel,
    onToggleRightPanel: toggleRightPanel,
    onToggleShortcutOverlay: () => setShowShortcutOverlay((prev) => !prev),
    onOpenPomodoro: () => openStudyTool("pomodoro"),
    onToggleFocusMode: toggleFocusMode,
    onOpenSettings: () => setSettingsOpen(true),
  })

  // ============================================================================
  // STATS DATA (computed once for StatsPanel)
  // ============================================================================
  const statsData = {
    totalStudyMinutes: studyStats.totalStudyMinutes,
    totalSessions: studyStats.totalSessions,
    currentStreak: studyStats.currentStreak,
    avgDailyMinutes: studyStats.avgDailyMinutes,
    weeklyData: studyStats.getDailyAggregates(7),
    recentSessions: studyStats.data.sessions,
  }

  return (
    <>
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
            onSave={saveCurrentFile}
            onOpenStudyTool={openStudyTool}
            onToggleFocusMode={toggleFocusMode}
            focusMode={focusMode}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        }

        /* ----------------------------------------------------------------
         * LEFT PANEL - File Tree
         * Displays the workspace file structure for navigation.
         * Hidden during focus mode when setting is enabled.
         * ---------------------------------------------------------------- */
        left={
          showLeftPanel && !(focusMode && settings.general.focusModeHidesExplorer) ? (
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
                    version={fileVersion}
                    onChange={onChange}
                    onCursorChange={setCursorPosition}
                    onSave={saveCurrentFile}
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
         * RIGHT PANEL - Calendar & Study Tools
         * Tabbed view with Calendar, Pomodoro, Flashcards, Notes, Stats
         * ---------------------------------------------------------------- */
        right={
          <RightPanelContainer
            workspaceRoot={workspaceRoot}
            onOpenFile={openFileByPath}
            pomodoroState={pomodoroState}
            pomodoroActions={pomodoroActions}
            flashcards={flashcards}
            notes={notes}
            statsData={statsData}
          />
        }
        showRightPanel={showRightPanel}

        /* ----------------------------------------------------------------
         * BOTTOM PANEL - Status Bar
         * Displays status info, cursor position, and layout controls
         * ---------------------------------------------------------------- */
        bottom={
          <div className="status-bar">
            {/* Left: Workspace info + Focus mode indicator */}
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
              {focusMode && (
                <span className="status-item status-item--accent" title="Focus Mode active">
                  🔍 Focus
                </span>
              )}
            </div>

            {/* Right: Pomodoro timer, Theme, Layout, Version */}
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
                {APP_NAME} v{APP_VERSION}
              </span>
            </div>
          </div>
        }
      />
      <ShortcutOverlay
        isOpen={showShortcutOverlay}
        onClose={() => setShowShortcutOverlay(false)}
      />
      {/* Theme Editor Modal — controlled by ThemeContext */}
      <ThemeEditor />
      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetToDefaults}
      />
    </>
  )
}

/**
 * Root App component — wraps AppInner with providers.
 */
export default function App() {
  const { workspaceRoot } = useWorkspaceController()

  return (
    <ThemeProvider workspaceRoot={workspaceRoot}>
      <StudyProvider>
        <AppInner />
      </StudyProvider>
    </ThemeProvider>
  )
}
