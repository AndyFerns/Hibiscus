import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Node } from "../types/workspace"
import { useDebouncedSave } from "./useDebouncedSave"

export function useEditorController(workspaceRoot: string | null) {
  const [activeFile, setActiveFile] = useState<Node | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState("")

  const debouncedSave = useDebouncedSave(600)

  const openFile = async (node: Node) => {
    if (!node.path || !workspaceRoot) return

    const fullPath = `${workspaceRoot}/${node.path}`
    const content = await invoke<string>("read_text_file", { path: fullPath })

    setActiveFile(node)
    setActiveFilePath(fullPath)
    setFileContent(content)
  }

  const onChange = (value: string) => {
    if (!activeFilePath) return
    setFileContent(value)
    debouncedSave(activeFilePath, value)
  }

  return {
    activeFile,
    activeFilePath,
    fileContent,
    openFile,
    onChange,
  }
}
