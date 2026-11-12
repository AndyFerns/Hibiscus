/** Application composition root for providers, feature controllers, and layout. */

import { useState, useCallback } from "react"
import { SplashScreen } from "./components/SplashScreen/SplashScreen"
import { Workbench } from "./layout/workbench"
import { ShortcutOverlay } from "./components/StatusBar/ShortcutOverlay"
import { ThemeEditor } from "./components/ThemeEditor/ThemeEditor"
import { ThemeProvider } from "./state/ThemeContext"
import { NewItemModal } from "./components/Modals/NewItemModal"

// Study tools imports
import { StudyProvider, useStudy } from "./features/shared/StudyContext"
import { SettingsModal } from "./features/settings/SettingsModal"
import { useStudyTools } from "./features/study/useStudyTools"

import { useWorkspaceController } from "./hooks/useWorkspaceController"
import { useEditorController } from "./hooks/useEditorController"
import { useAppLayout } from "./hooks/useAppLayout"
import { useAppShortcuts } from "./hooks/useAppShortcuts"
import { useWorkspaceEditorRouting } from "./hooks/useWorkspaceEditorRouting"

import versionInfo from "../version.json"

export const APP_NAME = versionInfo.name;
export const APP_VERSION = versionInfo.version;

import "./App.css"

import { useMarkdownViewMode } from "./features/editor/useMarkdownViewMode"
import { useKnowledgeGraphData } from "./features/knowledge/useKnowledgeGraphData"
import { useNewItemModal } from "./features/newitem"

// Layout Panes
import { TopPane } from "./layout/panes/TopPane"
import { LeftPane } from "./layout/panes/LeftPane"
import { MainPane } from "./layout/panes/MainPane"
import { RightPane } from "./layout/panes/RightPane"
import { BottomPane } from "./layout/panes/BottomPane"

type WorkspaceController = ReturnType<typeof useWorkspaceController>

interface AppInnerProps {
  workspaceController: WorkspaceController
}

/**
 * Inner app component that has access to StudyContext.
 * This separation is needed because useStudy() requires StudyProvider
 * to be mounted above it in the tree.
 */
function AppInner({ workspaceController }: AppInnerProps) {
  const {
    showLeftPanel,
    showRightPanel,
    showShortcutOverlay,
    centerView,
    setShowRightPanel,
    setCenterView,
    setCursorPosition,
    toggleLeftPanel,
    toggleRightPanel,
    toggleShortcutOverlay,
    closeShortcutOverlay,
    toggleGraphView,
  } = useAppLayout()

  const {
    workspace,
    workspaceRoot,
    changeWorkspace,
    openNode,
    openFileDialog,
    moveNode,
    moveError,
    clearMoveError,
    recentFiles,
    closeWorkspace,
  } = workspaceController

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
    openFiles,
    activeFileId,
    switchTab,
    closeTab,
    closeTabs,
    reorderTabs,
    renamePath,
    renameFile,
    saveFileByPath,
    buffersRef,
  } = useEditorController(workspaceRoot)

  // Tree drag-and-drop: move on disk, then re-point any open tabs inside the
  // moved file/folder so they stay open (instead of closing as "deleted").
  const handleMoveNode = useCallback(
    (sourceId: string, destinationParentId: string) =>
      moveNode(sourceId, destinationParentId, renamePath),
    [moveNode, renamePath]
  )

  const {
    activeMode: activeMarkdownViewMode,
    toggleActiveMode: toggleMarkdownViewMode,
  } = useMarkdownViewMode(activeFilePath)

  const {
    focusMode,
    setFocusMode,
    toggleFocusMode,
    setActiveStudyPanel,
    setRightPanelView,
    isSettingsOpen,
    setSettingsOpen,
  } = useStudy()

  const {
    settings,
    updateSettings,
    resetToDefaults,
    pomodoroState,
    pomodoroActions,
    flashcards,
    notes,
    statsData,
  } = useStudyTools(workspaceRoot, setFocusMode)

  const {
    graph: knowledgeGraph,
    index: knowledgeIndex,
    updateNote,
    backlinks: backendBacklinks,
    loading: knowledgeLoading,
    error: knowledgeError,
  } = useKnowledgeGraphData(
    workspaceRoot,
    workspace.tree,
    buffersRef,
  )

  const {
    modal: newItemModal,
    openFileModal: handleNewFile,
    openFolderModal: handleNewFolder,
    closeModal: handleModalClose,
  } = useNewItemModal(workspaceRoot)

  const {
    handleFileOpen,
    openFileByPath,
    handleGraphNodeClick,
    handleEditorChange,
    handleItemCreated,
    handleOpenFile,
    handleSaveAs,
    handleCloseFile,
    handleCloseFolder,
    handleAppExit,
  } = useWorkspaceEditorRouting({
    activeFilePath,
    openNode,
    openFileDialog,
    closeWorkspace,
    openFile,
    onChange,
    saveAsFile,
    closeFile,
    handleEditorExit,
    updateNote,
    setCenterView,
    setCursorPosition,
  })

  const { openStudyTool, openSettings, closeSettings } = useAppShortcuts({
    changeWorkspace,
    toggleLeftPanel,
    toggleRightPanel,
    toggleShortcutOverlay,
    toggleGraphView,
    setShowRightPanel,
    setActiveStudyPanel,
    toggleFocusMode,
    setSettingsOpen,
    setRightPanelView,
    toggleMarkdownViewMode,
  })

  return (
    <>
      <Workbench
        top={
          <TopPane
            workspaceRoot={workspaceRoot}
            onChangeWorkspace={changeWorkspace}
            onToggleLeftPanel={toggleLeftPanel}
            onToggleRightPanel={toggleRightPanel}
            showLeftPanel={showLeftPanel}
            showRightPanel={showRightPanel}
            onSaveCurrentFile={saveCurrentFile}
            onSaveAs={handleSaveAs}
            onSaveAllFiles={saveAllFiles}
            onCloseFile={handleCloseFile}
            onOpenFile={handleOpenFile}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onCloseFolder={handleCloseFolder}
            onAppExit={handleAppExit}
            onOpenStudyTool={openStudyTool}
            onToggleFocusMode={toggleFocusMode}
            focusMode={focusMode}
            onOpenSettings={openSettings}
          />
        }
        left={
          <LeftPane
            visible={showLeftPanel}
            hiddenByFocusMode={!!(focusMode && settings.general.focusModeHidesExplorer)}
            tree={workspace.tree}
            activeNodeId={workspace.session?.active_node}
            onOpen={handleFileOpen}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onMoveNode={handleMoveNode}
            moveError={moveError}
            onDismissMoveError={clearMoveError}
            onToggleGraph={toggleGraphView}
          />
        }
        main={
          <MainPane
            centerView={centerView}
            setCenterView={setCenterView}
            knowledgeGraph={knowledgeGraph}
            knowledgeLoading={knowledgeLoading}
            knowledgeError={knowledgeError}
            activeFile={activeFile}
            activeFilePath={activeFilePath}
            activeFileId={activeFileId}
            fileContent={fileContent}
            fileVersion={fileVersion}
            openFiles={openFiles}
            workspaceRoot={workspaceRoot}
            closeTabs={closeTabs}
            reorderTabs={reorderTabs}
            renameFile={renameFile}
            saveFileByPath={saveFileByPath}
            saveAllFiles={saveAllFiles}
            markdownViewMode={activeMarkdownViewMode}
            onToggleMarkdownViewMode={toggleMarkdownViewMode}
            handleGraphNodeClick={handleGraphNodeClick}
            switchTab={switchTab}
            closeTab={closeTab}
            handleFileOpen={handleFileOpen}
            handleEditorChange={handleEditorChange}
            setCursorPosition={setCursorPosition}
            saveCurrentFile={saveCurrentFile}
          />
        }
        right={
          <RightPane
            workspaceRoot={workspaceRoot}
            onOpenFile={openFileByPath}
            pomodoroState={pomodoroState}
            pomodoroActions={pomodoroActions}
            flashcards={flashcards}
            notes={notes}
            statsData={statsData}
            knowledgeGraph={knowledgeGraph}
            knowledgeIndex={knowledgeIndex}
            knowledgeBacklinks={backendBacklinks}
            knowledgeLoading={knowledgeLoading}
            knowledgeError={knowledgeError}
            activeFilePath={activeFilePath}
          />
        }
        showRightPanel={showRightPanel}
        showLeftPanel={showLeftPanel && !(focusMode && settings.general.focusModeHidesExplorer)}
        bottom={
          <BottomPane
            workspaceRoot={workspaceRoot}
            focusMode={focusMode}
            activeFile={activeFile}
            pomodoroState={pomodoroState}
            showLeftPanel={showLeftPanel}
            showRightPanel={showRightPanel}
            appName={APP_NAME}
            appVersion={APP_VERSION}
            openStudyTool={openStudyTool}
            toggleLeftPanel={toggleLeftPanel}
            toggleRightPanel={toggleRightPanel}
          />
        }
      />
      <ShortcutOverlay
        isOpen={showShortcutOverlay}
        onClose={closeShortcutOverlay}
      />
      <ThemeEditor />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        settings={settings}
        onUpdate={updateSettings}
        onReset={resetToDefaults}
      />
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
  const workspaceController = useWorkspaceController()
  const { workspaceRoot } = workspaceController

  // Cold-start gate — sessionStorage resets on process exit, so this
  // shows exactly once per OS-level launch, not on hot reloads.
  const isFirstLoad = !sessionStorage.getItem('hibiscus_launched');
  if (isFirstLoad) sessionStorage.setItem('hibiscus_launched', '1');

  const [splashVisible, setSplashVisible] = useState(isFirstLoad);
  const [splashExiting, setSplashExiting] = useState(false);

  const handleSplashDone = useCallback(() => {
    setSplashExiting(true);
    setTimeout(() => setSplashVisible(false), 350); // matches CSS transition duration
  }, []);

  return (
    <>
      {splashVisible && (
        <SplashScreen
          onDone={handleSplashDone}
          exiting={splashExiting}
        />
      )}
      <ThemeProvider workspaceRoot={workspaceRoot}>
        <StudyProvider>
          <AppInner workspaceController={workspaceController} />
        </StudyProvider>
      </ThemeProvider>
    </>
  )
}
