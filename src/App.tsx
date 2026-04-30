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

import { useState, useCallback, useMemo } from "react"
import { Workbench } from "./layout/workbench"
import { TitleBar } from "./components/TitleBar/TitleBar"
import { TreeView } from "./components/Tree/TreeView"
import { TabBar } from "./components/TabBar/TabBar"
import { EditorView, CursorPosition } from "./components/Editor/EditorView"
import { RightPanelContainer } from "./components/RightPanel/RightPanelContainer"
import { LayoutToggle } from "./components/StatusBar/LayoutToggle"
import { ThemeSelector } from "./components/StatusBar/ThemeSelector"
import { ShortcutOverlay } from "./components/StatusBar/ShortcutOverlay"
import { ThemeEditor } from "./components/ThemeEditor/ThemeEditor"
import { ThemeProvider } from "./state/ThemeContext"
import { NewItemModal, NewItemModalMode } from "./components/Modals/NewItemModal"

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

// Knowledge system
import { useKnowledgeIndex } from "./features/knowledge/useKnowledgeIndex"
import { buildGraph } from "./features/knowledge/buildGraph"
import { KnowledgeGraphView } from "./features/knowledge/KnowledgeGraphView"

/**
 * Inner app component that has access to StudyContext.
 * This separation is needed because useStudy() requires StudyProvider
 * to be mounted above it in the tree.
 */
function AppInner() {
  // ============================================================================
  // MODAL STATE
  // New file/folder creation modal
  // ============================================================================
  const [newItemModal, setNewItemModal] = useState<{
    open: boolean
    mode: NewItemModalMode
  }>({
    open: false,
    mode: "file"
  })

  // Markdown preview toggle state
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(true)

  
  
  // ============================================================================
  // WORKSPACE STATE
  // Tree structure, root path, and navigation
  // ============================================================================
  const {
    workspace,
    workspaceRoot,
    changeWorkspace,
    openNode,
    openFileDialog,
    moveNode,
    recentFiles, // Provide this explicitly
    closeWorkspace,
  } = useWorkspaceController()

  // ============================================================================
  // EDITOR STATE
  // Active file, content, save handling, and multi-file tab management
  // ============================================================================
  const {
    activeFile,
    activeFilePath,
    fileContent,
    fileVersion,
    openFile,
    onChange,
    saveCurrentFile,
    saveAllFiles,
    saveAsFile,
    closeFile,
    handleExit: handleEditorExit,
    // Multi-file tab interface
    openFiles,
    activeFileId,
    switchTab,
    closeTab,
    // Buffer ref (for knowledge index)
    buffersRef,
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
  // KNOWLEDGE INDEX
  // Tracks [[links]], #tags, and backlinks across workspace notes
  // ============================================================================
  const { index: knowledgeIndex, updateNote } = useKnowledgeIndex(
    workspace.tree,
    buffersRef
  )

  // Memoize graph data based on index version to avoid recalculation
  const knowledgeGraph = useMemo(
    () => buildGraph(knowledgeIndex),
    [knowledgeIndex.version]
  )

  // ============================================================================
  // PANEL VISIBILITY STATE
  // Controls which panels are visible in the layout
  // ============================================================================
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false)

  // ============================================================================
  // CENTER VIEW MODE
  // Toggle between editor and knowledge graph in the center panel
  // ============================================================================
  const [centerView, setCenterView] = useState<"editor" | "graph">("editor")

  const toggleGraphView = useCallback(() => {
    setCenterView((prev) => (prev === "editor" ? "graph" : "editor"))
  }, [])

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
   * Handle editor content changes — forward to both buffer system
   * and knowledge index for incremental link/tag parsing.
   */
  const handleEditorChange = useCallback(
    (value: string) => {
      onChange(value)
      if (activeFilePath) {
        updateNote(activeFilePath, value)
      }
    },
    [onChange, activeFilePath, updateNote]
  )

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
   * Open file from graph node click — switches to editor and opens file
   */
  const handleGraphNodeClick = useCallback((filePath: string) => {
    setCenterView("editor")
    openFileByPath(filePath)
  }, [openFileByPath])

  /**
   * Handle file menu actions
   */
  const handleNewFile = useCallback(() => {
    if (!workspaceRoot) {
      // TODO: Show proper notification instead of alert
      console.warn("Please open a workspace first")
      return
    }
    
    setNewItemModal({ open: true, mode: "file" })
  }, [workspaceRoot])

  const handleNewFolder = useCallback(() => {
    if (!workspaceRoot) {
      // TODO: Show proper notification instead of alert
      console.warn("Please open a workspace first")
      return
    }
    
    setNewItemModal({ open: true, mode: "folder" })
  }, [workspaceRoot])

  /**
   * Handle modal close
   */
  const handleModalClose = useCallback(() => {
    setNewItemModal({ open: false, mode: "file" })
  }, [])

  /**
   * Handle successful item creation from the modal.
   * If a file was created, open it in the editor.
   */
  const handleItemCreated = useCallback((absolutePath: string, isFile: boolean) => {
    if (isFile) {
      const name = absolutePath.split(/[/\\]/).pop() || absolutePath
      handleFileOpen({
        id: absolutePath,
        name,
        path: absolutePath,
        type: "file"
      })
    }
  }, [handleFileOpen])

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // Handle all global keyboard shortcuts using the centralized hook
  // ============================================================================
  const { setRightPanelView } = useStudy()
  
  useKeyboardShortcuts({
    onOpenFolder: openFileDialog,
    onToggleLeftPanel: toggleLeftPanel,
    onToggleRightPanel: toggleRightPanel,
    onToggleShortcutOverlay: () => setShowShortcutOverlay(true),
    onOpenPomodoro: () => openStudyTool("pomodoro"),
    onToggleFocusMode: toggleFocusMode,
    onOpenSettings: () => setSettingsOpen(true),
    onOpenSearch: () => {
      toggleRightPanel()
      setRightPanelView("search")
    },
    onToggleGraphView: toggleGraphView,
  })

  const handleOpenFile = useCallback(async () => {
    const filePath = await openFileDialog()
    if (filePath) {
      const name = filePath.split(/[/\\]/).pop() || filePath
      handleFileOpen({
        id: filePath,
        name,
        path: filePath,
        type: "file"
      })
    }
  }, [openFileDialog, handleFileOpen])

  const handleSaveAs = useCallback(async () => {
    await saveAsFile()
  }, [saveAsFile])

  const handleCloseFile = useCallback(async () => {
    await closeFile()
  }, [closeFile])

  const handleCloseFolder = useCallback(() => {
    closeWorkspace()
  }, [closeWorkspace])

  const handleAppExit = useCallback(async () => {
    const shouldExit = await handleEditorExit()
    if (shouldExit) {
      // In a real app, this would close the application
      // For now, we'll just close the workspace
      closeWorkspace()
    }
  }, [handleEditorExit, closeWorkspace])

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
    onToggleMarkdownPreview: () => setShowMarkdownPreview((prev) => !prev),
    onToggleGraphView: toggleGraphView,
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
            onSaveAs={handleSaveAs}
            onSaveAll={saveAllFiles}
            onCloseFile={handleCloseFile}
            onOpenFile={handleOpenFile}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onCloseFolder={handleCloseFolder}
            onExit={handleAppExit}
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
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              onMoveNode={moveNode}
              onToggleGraph={toggleGraphView}
            />
          ) : null
        }

        /* ----------------------------------------------------------------
         * MAIN PANEL - Editor Area
         * Monaco editor when a file is selected, placeholder otherwise
         * ---------------------------------------------------------------- */
        main={
          centerView === "graph" ? (
            /* Knowledge Graph — full center panel */
            <KnowledgeGraphView
              graph={knowledgeGraph}
              activeFilePath={activeFilePath}
              onNodeClick={handleGraphNodeClick}
              onBack={() => setCenterView("editor")}
            />
          ) : (
            /* Editor view — default center panel */
            <div className="editor-wrapper">
              {/* Tab bar -- visible only when at least one file is open */}
              <TabBar
                openFiles={openFiles}
                activeFileId={activeFileId}
                onSelectTab={switchTab}
                onCloseTab={closeTab}
              />

              {activeFile && activeFilePath ? (
                <>
                  {/* Monaco editor container */}
                  <div className="editor-container">
                    <EditorView
                      path={activeFilePath}
                      content={fileContent}
                      version={fileVersion}
                      onChange={handleEditorChange}
                      onCursorChange={setCursorPosition}
                      onSave={saveCurrentFile}
                      showMarkdownPreview={showMarkdownPreview}
                    />
                  </div>
                </>
              ) : (
                /* Placeholder when no file is selected */
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
          )
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
            knowledgeGraph={knowledgeGraph}
            knowledgeIndex={knowledgeIndex}
            activeFilePath={activeFilePath}
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
      {/* New Item Modal (keyboard-centric, with suggestions) */}
      <NewItemModal
        open={newItemModal.open}
        mode={newItemModal.mode}
        onClose={handleModalClose}
        workspaceRoot={workspaceRoot}
        tree={workspace.tree}
        recentItems={recentFiles.map(f => f.path)}
        onCreated={handleItemCreated}
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
