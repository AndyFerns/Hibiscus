/**
 * ============================================================================
 * useEditorController Hook
 * ============================================================================
 * 
 * Manages the editor state including:
 * - Active file selection
 * - File content loading and saving
 * - Dirty state tracking (unsaved changes)
 * - Buffer management for multiple open files
 * - Keyboard shortcut handling (Ctrl+S)
 * 
 * ARCHITECTURE:
 * - Uses a Map to store content buffers for each open file
 * - Tracks dirty state per file to know what needs saving
 * - Provides both debounced (auto) and immediate (manual) save
 * ============================================================================
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Node } from "../types/workspace"

/**
 * Buffer entry for an open file
 */
interface FileBuffer {
  /** Current content in the editor (may differ from disk) */
  content: string
  /** Content as it was when last loaded/saved from disk */
  savedContent: string
  /** Whether there are unsaved changes */
  isDirty: boolean
}

export function useEditorController(workspaceRoot: string | null) {
  // Active file state
  const [activeFile, setActiveFile] = useState<Node | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  // Buffer map: path -> FileBuffer
  const buffersRef = useRef<Map<string, FileBuffer>>(new Map())

  // Current content (reactive state for rendering)
  const [fileContent, setFileContent] = useState("")

  // Dirty state for current file
  const [isDirty, setIsDirty] = useState(false)

  // Debounce timer ref
  const saveTimerRef = useRef<number | null>(null)

  // Currently saving flag to prevent race conditions
  const isSavingRef = useRef(false)

  /**
   * Save a file to disk
   * @param path - Full file path
   * @param content - Content to save
   * @param immediate - If true, saves immediately (Ctrl+S). If false, uses debounce.
   */
  const saveFile = useCallback(async (path: string, content: string, immediate = false) => {
    // Clear any pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const doSave = async () => {
      if (isSavingRef.current) return

      isSavingRef.current = true
      try {
        await invoke("write_text_file", { path, contents: content })

        // Update buffer to mark as saved
        const buffer = buffersRef.current.get(path)
        if (buffer) {
          buffer.savedContent = content
          buffer.isDirty = false
        }

        // Update dirty state if this is the active file
        if (path === activeFilePath) {
          setIsDirty(false)
        }

        console.log(`[Hibiscus] Saved: ${path.split(/[/\\]/).pop()}`)
      } catch (error) {
        console.error("[Hibiscus] Failed to save file:", error)
      } finally {
        isSavingRef.current = false
      }
    }

    if (immediate) {
      await doSave()
    } else {
      // Debounced save (auto-save after 1 second of inactivity)
      saveTimerRef.current = window.setTimeout(doSave, 1000)
    }
  }, [activeFilePath])

  /**
   * Open a file in the editor
   * Loads from disk or retrieves from buffer if already open
   */
  const openFile = useCallback(async (node: Node) => {
    if (!node.path || !workspaceRoot) return

    const fullPath = `${workspaceRoot}/${node.path}`

    // Check if we have this file in buffer already
    let buffer = buffersRef.current.get(fullPath)

    if (!buffer) {
      // Load from disk
      try {
        const content = await invoke<string>("read_text_file", { path: fullPath })
        buffer = {
          content,
          savedContent: content,
          isDirty: false,
        }
        buffersRef.current.set(fullPath, buffer)
      } catch (error) {
        console.error("[Hibiscus] Failed to open file:", error)
        return
      }
    }

    // Set as active file
    setActiveFile(node)
    setActiveFilePath(fullPath)
    setFileContent(buffer.content)
    setIsDirty(buffer.isDirty)
  }, [workspaceRoot])

  /**
   * Handle content change from editor
   * Updates buffer and triggers debounced save
   */
  const onChange = useCallback((value: string) => {
    if (!activeFilePath) return

    // Update buffer
    const buffer = buffersRef.current.get(activeFilePath)
    if (buffer) {
      buffer.content = value
      buffer.isDirty = value !== buffer.savedContent
      setIsDirty(buffer.isDirty)
    }

    // Update reactive state
    setFileContent(value)

    // Trigger debounced save
    saveFile(activeFilePath, value, false)
  }, [activeFilePath, saveFile])

  /**
   * Force save the current file immediately (for Ctrl+S)
   */
  const saveCurrentFile = useCallback(async () => {
    if (!activeFilePath) return

    const buffer = buffersRef.current.get(activeFilePath)
    if (buffer && buffer.isDirty) {
      await saveFile(activeFilePath, buffer.content, true)
    }
  }, [activeFilePath, saveFile])

  /**
   * Save all dirty files
   */
  const saveAllFiles = useCallback(async () => {
    const savePromises: Promise<void>[] = []

    buffersRef.current.forEach((buffer, path) => {
      if (buffer.isDirty) {
        savePromises.push(saveFile(path, buffer.content, true))
      }
    })

    await Promise.all(savePromises)
  }, [saveFile])

  /**
   * Set up global keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        await saveCurrentFile()
      }

      // Ctrl+Shift+S or Cmd+Shift+S to save all
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault()
        await saveAllFiles()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [saveCurrentFile, saveAllFiles])

  /**
   * Clean up on unmount - save any dirty files
   */
  useEffect(() => {
    return () => {
      // Clear any pending saves
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      // Attempt to save dirty files on unmount
      buffersRef.current.forEach(async (buffer, path) => {
        if (buffer.isDirty) {
          try {
            await invoke("write_text_file", { path, contents: buffer.content })
          } catch (e) {
            console.error("[Hibiscus] Failed to save on unmount:", e)
          }
        }
      })
    }
  }, [])

  return {
    activeFile,
    activeFilePath,
    fileContent,
    isDirty,
    openFile,
    onChange,
    saveCurrentFile,
    saveAllFiles,
  }
}
