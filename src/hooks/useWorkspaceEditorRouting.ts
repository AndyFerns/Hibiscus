import { useCallback } from "react"
import type { useKnowledgeGraphData } from "../features/knowledge/useKnowledgeGraphData"
import type { useAppLayout } from "./useAppLayout"
import type { useEditorController } from "./useEditorController"
import type { useWorkspaceController } from "./useWorkspaceController"

type WorkspaceController = ReturnType<typeof useWorkspaceController>
type EditorController = ReturnType<typeof useEditorController>
type KnowledgeGraphData = ReturnType<typeof useKnowledgeGraphData>
type AppLayout = ReturnType<typeof useAppLayout>
type FileNode = Parameters<WorkspaceController["openNode"]>[0]

interface WorkspaceEditorRoutingOptions {
  activeFilePath: EditorController["activeFilePath"]
  openNode: WorkspaceController["openNode"]
  openFileDialog: WorkspaceController["openFileDialog"]
  closeWorkspace: WorkspaceController["closeWorkspace"]
  openFile: EditorController["openFile"]
  onChange: EditorController["onChange"]
  saveAsFile: EditorController["saveAsFile"]
  closeFile: EditorController["closeFile"]
  handleEditorExit: EditorController["handleExit"]
  updateNote: KnowledgeGraphData["updateNote"]
  setCenterView: AppLayout["setCenterView"]
  setCursorPosition: AppLayout["setCursorPosition"]
}

interface WorkspaceEditorRouting {
  handleFileOpen: (node: FileNode) => void
  openFileByPath: (filePath: string, line?: number) => void
  handleGraphNodeClick: (filePath: string) => void
  handleEditorChange: (value: string, path?: string) => void
  handleItemCreated: (absolutePath: string, isFile: boolean) => void
  handleOpenFile: () => Promise<void>
  handleSaveAs: EditorController["saveAsFile"]
  handleCloseFile: EditorController["closeFile"]
  handleCloseFolder: WorkspaceController["closeWorkspace"]
  handleAppExit: () => Promise<void>
}

function fileNodeFromPath(filePath: string): FileNode {
  return {
    id: filePath,
    name: filePath.split(/[/\\]/).pop() || filePath,
    path: filePath,
    type: "file",
  }
}

export function useWorkspaceEditorRouting({
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
}: WorkspaceEditorRoutingOptions): WorkspaceEditorRouting {
  const handleFileOpen = useCallback((node: FileNode) => {
    openNode(node)
    openFile(node)
    setCursorPosition({ line: 1, column: 1 })
  }, [openNode, openFile, setCursorPosition])

  const openFileByPath = useCallback((filePath: string, _line?: number) => {
    handleFileOpen(fileNodeFromPath(filePath))
  }, [handleFileOpen])

  const handleGraphNodeClick = useCallback((filePath: string) => {
    setCenterView("editor")
    openFileByPath(filePath)
  }, [openFileByPath, setCenterView])

  const handleEditorChange = useCallback((value: string, path?: string) => {
    // EditorView passes the path its (debounced) change belongs to, so an edit
    // flushed during a tab switch is never attributed to the new tab.
    if (path === undefined) onChange(value)
    else onChange(value, path)
    const target = path ?? activeFilePath
    if (target) {
      updateNote(target, value)
    }
  }, [onChange, activeFilePath, updateNote])

  const handleItemCreated = useCallback((absolutePath: string, isFile: boolean) => {
    if (isFile) {
      handleFileOpen(fileNodeFromPath(absolutePath))
    }
  }, [handleFileOpen])

  const handleOpenFile = useCallback(async () => {
    const filePath = await openFileDialog()
    if (filePath) {
      handleFileOpen(fileNodeFromPath(filePath))
    }
  }, [openFileDialog, handleFileOpen])

  const handleAppExit = useCallback(async () => {
    if (await handleEditorExit()) {
      closeWorkspace()
    }
  }, [handleEditorExit, closeWorkspace])

  return {
    handleFileOpen,
    openFileByPath,
    handleGraphNodeClick,
    handleEditorChange,
    handleItemCreated,
    handleOpenFile,
    handleSaveAs: saveAsFile,
    handleCloseFile: closeFile,
    handleCloseFolder: closeWorkspace,
    handleAppExit,
  }
}
