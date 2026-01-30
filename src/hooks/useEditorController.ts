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
import { listen } from "@tauri-apps/api/event"
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

  // ===========================================================================
  // RACE CONDITION FIX: Track open requests to discard stale responses
  // ===========================================================================
  // When user rapidly clicks multiple files, multiple async openFile calls run
  // in parallel. Without this tracking, the slower request could "win" and
  // display the wrong file content. The request ID ensures only the latest
  // request's response is used.
  // ===========================================================================
  const openRequestIdRef = useRef(0)

  /**
   * Open a file in the editor
   * Loads from disk or retrieves from buffer if already open
   */
  const openFile = useCallback(async (node: Node) => {
    if (!node.path || !workspaceRoot) return

    // Normalize path separators for Windows compatibility
    const fullPath = `${workspaceRoot}\\${node.path.replace(/\//g, '\\')}`

    // Generate unique request ID for this open operation
    const requestId = ++openRequestIdRef.current

    // Check if we have this file in buffer already
    let buffer = buffersRef.current.get(fullPath)

    if (!buffer) {
      // Load from disk
      try {
        const content = await invoke<string>("read_text_file", { path: fullPath })

        // RACE CONDITION CHECK: Discard if a newer request was made
        if (requestId !== openRequestIdRef.current) {
          console.log(`[Hibiscus] Discarding stale file open response for: ${node.name}`)
          return
        }

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

    // RACE CONDITION CHECK: Final check before updating state
    if (requestId !== openRequestIdRef.current) {
      console.log(`[Hibiscus] Discarding stale file open for: ${node.name}`)
      return
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

  // ===========================================================================
  // BUG FIX: Detect external file changes (via File Explorer, other editors)
  // When the filesystem watcher detects changes, we reload the content for
  // any open files that were modified externally. If the file has unsaved
  // local changes (isDirty), we warn the user; otherwise update silently.
  // ===========================================================================
  useEffect(() => {
    if (!workspaceRoot) return

    let unlisten: (() => void) | null = null

    listen<string[]>("fs-changed", async (event) => {
      const changedPaths = event.payload

      // Check each buffer to see if it was modified externally
      for (const [filePath, buffer] of buffersRef.current.entries()) {
        // Normalize paths for comparison (handle Windows backslashes)
        const normalizedFilePath = filePath.replace(/\\/g, "/")
        const wasModified = changedPaths.some(changedPath => {
          const normalizedChanged = changedPath.replace(/\\/g, "/")
          return normalizedFilePath === normalizedChanged
        })

        if (wasModified) {
          try {
            // Read current disk content
            const diskContent = await invoke<string>("read_text_file", { path: filePath })

            // If disk content differs from what we last saved, it was changed externally
            if (diskContent !== buffer.savedContent) {
              if (buffer.isDirty) {
                // User has unsaved changes - log warning, don't overwrite
                console.warn(
                  `[Hibiscus] External change detected for ${filePath.split(/[/\\]/).pop()} ` +
                  `but file has unsaved changes. Not reloading.`
                )
              } else {
                // No local changes - safe to reload from disk
                buffer.content = diskContent
                buffer.savedContent = diskContent
                buffer.isDirty = false

                // If this is the active file, update the UI state
                if (filePath === activeFilePath) {
                  setFileContent(diskContent)
                  setIsDirty(false)
                }

                console.log(
                  `[Hibiscus] Reloaded external changes: ${filePath.split(/[/\\]/).pop()}`
                )
              }
            }
          } catch (e) {
            // File may have been deleted - handle gracefully
            console.warn(`[Hibiscus] Could not reload ${filePath}:`, e)
          }
        }
      }
    }).then(fn => (unlisten = fn))

    return () => {
      if (unlisten) unlisten()
    }
  }, [workspaceRoot, activeFilePath])

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
