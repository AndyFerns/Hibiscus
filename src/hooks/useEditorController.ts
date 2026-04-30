/**
 * ============================================================================
 * useEditorController Hook
 * ============================================================================
 *
 * Manages the multi-file editor state including:
 * - Open file list (for tab bar display)
 * - Active file selection and switching
 * - File content loading, saving, and buffer management
 * - Dirty state tracking (unsaved changes) per file
 * - Session persistence and restore (via .hibiscus/session.json)
 * - Keyboard shortcut handling (Ctrl+S, Ctrl+W)
 *
 * ARCHITECTURE:
 * - Uses a Map (buffersRef) to store content per open file -- O(1) lookup
 * - Maintains an ordered list (openFiles) for tab bar rendering
 * - openFilesMap provides O(1) duplicate checking by path
 * - Session is persisted with 300ms debounce to avoid excessive writes
 * - Provides both debounced (auto) and immediate (manual) save
 *
 * MULTI-FILE ADDITIONS (relative to the single-file predecessor):
 * - openFiles[] and activeFileId replace the single activeFile model
 * - closeTab() switches to an adjacent tab instead of clearing entirely
 * - switchTab() swaps Monaco content without re-mounting the editor
 * - restoreSession() loads previously open files on workspace boot
 * ============================================================================
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { save } from "@tauri-apps/plugin-dialog"
import { Node } from "../types/workspace"
import { OpenFile } from "../types/editor"
import { join, isAbsolute } from "@tauri-apps/api/path"
import {
  persistEditorSession,
  loadEditorSession,
} from "../state/editorSession"

/**
 * Buffer entry for an open file.
 * Stores both the in-memory working copy and the last saved copy
 * so we can compute dirty state without an extra disk read.
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
  // =========================================================================
  // MULTI-FILE STATE
  // Ordered list of open files (drives tab bar rendering)
  // =========================================================================
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)

  // Legacy single-file accessors kept for backward compatibility with App.tsx
  const [activeFile, setActiveFile] = useState<Node | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  // Buffer map: path -> FileBuffer (O(1) content lookup)
  const buffersRef = useRef<Map<string, FileBuffer>>(new Map())

  // Map for O(1) duplicate-open checking: path -> OpenFile.id
  const openFilesMapRef = useRef<Map<string, string>>(new Map())

  // Current content (reactive state for rendering)
  const [fileContent, setFileContent] = useState("")
  const [fileVersion, setFileVersion] = useState(0)

  // Dirty state for the active file
  const [isDirty, setIsDirty] = useState(false)

  // Debounce timer ref for auto-save
  const saveTimerRef = useRef<number | null>(null)

  // Currently saving flag to prevent race conditions
  const isSavingRef = useRef(false)

  // Track whether session restore has completed to avoid re-restoring
  const sessionRestoredRef = useRef(false)

  // =========================================================================
  // SESSION PERSISTENCE HELPER
  // Debounced write of current tab state to disk
  // =========================================================================
  const persistSession = useCallback(() => {
    if (!workspaceRoot) return

    // Read from the refs/state at call-time
    setOpenFiles((currentOpenFiles) => {
      const session = {
        openFiles: currentOpenFiles.map((f) => f.path),
        activeFile: activeFilePath,
      }
      persistEditorSession(workspaceRoot, session)
      return currentOpenFiles // no mutation
    })
  }, [workspaceRoot, activeFilePath])

  /**
   * Save a file to disk.
   * @param path - Full file path
   * @param content - Content to save
   * @param immediate - If true, saves immediately (Ctrl+S). If false, uses debounce.
   */
  const saveFile = useCallback(
    async (path: string, content: string, immediate = false) => {
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

          // Update dirty state in the openFiles list for tab rendering
          setOpenFiles((prev) =>
            prev.map((f) =>
              f.path === path ? { ...f, isDirty: false } : f
            )
          )

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
    },
    [activeFilePath]
  )

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
   * Open a file in the editor.
   * - If already open, just switch to that tab (no duplicate).
   * - If not open, load content from disk and add to openFiles.
   * - Always sets the file as active.
   */
  const openFile = useCallback(
    async (node: Node) => {
      if (!node.path || !workspaceRoot) return

      // Normalize path for cross-platform consistency
      let fullPath: string

      if (await isAbsolute(node.path)) {
        fullPath = node.path
      } else {
        fullPath = await join(workspaceRoot, node.path)
      }

      // ----- DUPLICATE CHECK (O(1)) -----
      // If file is already open, just switch to its tab
      const existingId = openFilesMapRef.current.get(fullPath)
      if (existingId) {
        // Switch to existing tab
        setActiveFileId(existingId)
        setActiveFile(node)
        setActiveFilePath(fullPath)

        // Load buffered content into the editor
        const buffer = buffersRef.current.get(fullPath)
        if (buffer) {
          setFileContent(buffer.content)
          setIsDirty(buffer.isDirty)
          setFileVersion((v) => v + 1)
        }

        // Persist session (debounced)
        persistSession()
        return
      }

      // ----- NEW FILE OPEN -----
      const requestId = ++openRequestIdRef.current

      // Load from disk
      let buffer = buffersRef.current.get(fullPath)

      if (!buffer) {
        try {
          const content = await invoke<string>("read_text_file", {
            path: fullPath,
          })

          // RACE CONDITION CHECK: Discard if a newer request was made
          if (requestId !== openRequestIdRef.current) {
            console.log(
              `[Hibiscus] Discarding stale file open response for: ${node.name}`
            )
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
        console.log(
          `[Hibiscus] Discarding stale file open for: ${node.name}`
        )
        return
      }

      // Create the OpenFile entry for the tab bar
      const openFileEntry: OpenFile = {
        id: fullPath,
        path: fullPath,
        name: node.name,
        type: node.type || "file",
        isDirty: false,
      }

      // Register in the O(1) lookup map
      openFilesMapRef.current.set(fullPath, fullPath)

      // Append to the ordered open files list
      setOpenFiles((prev) => [...prev, openFileEntry])

      // Set as active file
      setActiveFileId(fullPath)
      setActiveFile(node)
      setActiveFilePath(fullPath)
      setFileContent(buffer.content)
      setIsDirty(buffer.isDirty)
      setFileVersion((v) => v + 1)

      // Persist session (debounced)
      persistSession()
    },
    [workspaceRoot, persistSession]
  )

  /**
   * Switch to a specific tab by file ID.
   * Does NOT re-mount the editor -- only swaps content/model.
   */
  const switchTab = useCallback(
    (fileId: string) => {
      const file = openFiles.find((f) => f.id === fileId)
      if (!file) return

      const buffer = buffersRef.current.get(file.path)
      if (!buffer) return

      setActiveFileId(fileId)
      setActiveFile({
        id: file.id,
        name: file.name,
        type: file.type as "file" | "folder",
        path: file.path,
      })
      setActiveFilePath(file.path)
      setFileContent(buffer.content)
      setIsDirty(buffer.isDirty)
      setFileVersion((v) => v + 1)

      // Persist session (debounced)
      persistSession()
    },
    [openFiles, persistSession]
  )

  /**
   * Close a tab by file ID.
   * If the closed tab was active, switch to the nearest remaining tab.
   */
  const closeTab = useCallback(
    async (fileId: string) => {
      const idx = openFiles.findIndex((f) => f.id === fileId)
      if (idx === -1) return

      const file = openFiles[idx]
      const buffer = buffersRef.current.get(file.path)

      // Prompt to save if dirty
      if (buffer && buffer.isDirty) {
        const shouldSave = confirm(
          `Save changes to ${file.name} before closing?`
        )
        if (shouldSave) {
          await saveFile(file.path, buffer.content, true)
        }
      }

      // Remove from buffer and lookup map
      buffersRef.current.delete(file.path)
      openFilesMapRef.current.delete(file.path)

      // Remove from open files list
      const newOpenFiles = openFiles.filter((f) => f.id !== fileId)
      setOpenFiles(newOpenFiles)

      // If the closed tab was active, pick the best adjacent tab
      if (activeFileId === fileId) {
        if (newOpenFiles.length === 0) {
          // No more open files -- clear editor
          setActiveFileId(null)
          setActiveFile(null)
          setActiveFilePath(null)
          setFileContent("")
          setIsDirty(false)
        } else {
          // Switch to the tab at the same index, or the last tab
          const nextIdx = Math.min(idx, newOpenFiles.length - 1)
          const nextFile = newOpenFiles[nextIdx]
          const nextBuffer = buffersRef.current.get(nextFile.path)

          setActiveFileId(nextFile.id)
          setActiveFile({
            id: nextFile.id,
            name: nextFile.name,
            type: nextFile.type as "file" | "folder",
            path: nextFile.path,
          })
          setActiveFilePath(nextFile.path)
          setFileContent(nextBuffer?.content ?? "")
          setIsDirty(nextBuffer?.isDirty ?? false)
          setFileVersion((v) => v + 1)
        }
      }

      // Persist session after close
      if (workspaceRoot) {
        persistEditorSession(workspaceRoot, {
          openFiles: newOpenFiles.map((f) => f.path),
          activeFile:
            activeFileId === fileId
              ? newOpenFiles.length > 0
                ? newOpenFiles[Math.min(idx, newOpenFiles.length - 1)].path
                : null
              : activeFilePath,
        })
      }

      console.log(`[Hibiscus] Closed tab: ${file.name}`)
    },
    [openFiles, activeFileId, activeFilePath, saveFile, workspaceRoot]
  )

  /**
   * Handle content change from editor.
   * Updates buffer, dirty state, and triggers debounced save.
   */
  const onChange = useCallback(
    (value: string) => {
      if (!activeFilePath) return

      // Update buffer
      const buffer = buffersRef.current.get(activeFilePath)
      if (buffer) {
        buffer.content = value
        buffer.isDirty = value !== buffer.savedContent
        setIsDirty(buffer.isDirty)

        // Also update the openFiles list for tab dirty indicator
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === activeFilePath
              ? { ...f, isDirty: buffer.isDirty }
              : f
          )
        )
      }

      // Update reactive state
      setFileContent(value)

      // Trigger debounced save
      saveFile(activeFilePath, value, false)
    },
    [activeFilePath, saveFile]
  )

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
   * Set up global keyboard shortcuts for save and close-tab
   */
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "s") {
        e.preventDefault()
        await saveCurrentFile()
      }

      // Ctrl+Shift+S or Cmd+Shift+S to save all
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault()
        await saveAllFiles()
      }

      // Ctrl+W or Cmd+W to close the active tab
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "w") {
        e.preventDefault()
        if (activeFileId) {
          await closeTab(activeFileId)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [saveCurrentFile, saveAllFiles, closeTab, activeFileId])

  /**
   * Clean up on unmount -- save any dirty files
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
            await invoke("write_text_file", {
              path,
              contents: buffer.content,
            })
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
        const wasModified = changedPaths.some((changedPath) => {
          const normalizedChanged = changedPath.replace(/\\/g, "/")
          return normalizedFilePath === normalizedChanged
        })

        if (wasModified) {
          try {
            // Read current disk content
            const diskContent = await invoke<string>("read_text_file", {
              path: filePath,
            })

            // If disk content differs from what we last saved, it was changed externally
            if (diskContent !== buffer.savedContent) {
              if (buffer.isDirty) {
                // User has unsaved changes - log warning, don't overwrite
                console.warn(
                  `[Hibiscus] External change detected for ${filePath.split(/[/\\]/).pop()} ` +
                    `but file has unsaved changes. Not reloading.`
                )
              } else {
                // No local changes -- safe to reload from disk
                buffer.content = diskContent
                buffer.savedContent = diskContent
                buffer.isDirty = false

                // If this is the active file, update the UI state
                if (filePath === activeFilePath) {
                  setFileContent(diskContent)
                  setIsDirty(false)
                  setFileVersion((v) => v + 1)
                }

                console.log(
                  `[Hibiscus] Reloaded external changes: ${filePath.split(/[/\\]/).pop()}`
                )
              }
            }
          } catch (e) {
            // File may have been deleted -- remove from open files gracefully
            console.warn(`[Hibiscus] Could not reload ${filePath}:`, e)

            // Clean up deleted files from the open file list
            buffersRef.current.delete(filePath)
            openFilesMapRef.current.delete(filePath)
            setOpenFiles((prev) =>
              prev.filter((f) => f.path !== filePath)
            )

            if (filePath === activeFilePath) {
              setActiveFile(null)
              setActiveFilePath(null)
              setActiveFileId(null)
              setFileContent("")
              setIsDirty(false)
            }
          }
        }
      }
    }).then((fn) => (unlisten = fn))

    return () => {
      if (unlisten) unlisten()
    }
  }, [workspaceRoot, activeFilePath])

  // ===========================================================================
  // SESSION RESTORE
  // On workspace load, restore previously open tabs from .hibiscus/session.json
  // ===========================================================================
  useEffect(() => {
    if (!workspaceRoot || sessionRestoredRef.current) return

    const restoreSession = async () => {
      const session = await loadEditorSession(workspaceRoot)
      if (!session || session.openFiles.length === 0) return

      sessionRestoredRef.current = true

      // Open each file from the session, skipping any that fail to load
      for (const filePath of session.openFiles) {
        try {
          const content = await invoke<string>("read_text_file", {
            path: filePath,
          })
          const name = filePath.split(/[/\\]/).pop() || filePath
          const buffer: FileBuffer = {
            content,
            savedContent: content,
            isDirty: false,
          }
          buffersRef.current.set(filePath, buffer)
          openFilesMapRef.current.set(filePath, filePath)

          const entry: OpenFile = {
            id: filePath,
            path: filePath,
            name,
            type: "file",
            isDirty: false,
          }

          // Batch-add to avoid per-file re-render
          setOpenFiles((prev) => [...prev, entry])
        } catch {
          // File was likely deleted since last session -- skip silently
          console.warn(
            `[Hibiscus] Session restore: skipping deleted file ${filePath}`
          )
        }
      }

      // Restore the active tab
      const activeTarget = session.activeFile
      if (activeTarget && buffersRef.current.has(activeTarget)) {
        const name = activeTarget.split(/[/\\]/).pop() || activeTarget
        const buffer = buffersRef.current.get(activeTarget)!

        setActiveFileId(activeTarget)
        setActiveFile({
          id: activeTarget,
          name,
          path: activeTarget,
          type: "file",
        })
        setActiveFilePath(activeTarget)
        setFileContent(buffer.content)
        setIsDirty(false)
        setFileVersion((v) => v + 1)
      }
    }

    restoreSession()
  }, [workspaceRoot])

  /**
   * Save the current file with a new name/location (Save As)
   */
  const saveAsFile = useCallback(async (): Promise<boolean> => {
    if (!activeFilePath || !activeFile) return false

    try {
      const result = await save({
        defaultPath: activeFile.name,
        filters: [
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      })

      if (result) {
        const newPath =
          typeof result === "string"
            ? result
            : Array.isArray(result)
              ? result[0]
              : null
        if (newPath) {
          const buffer = buffersRef.current.get(activeFilePath)
          if (buffer) {
            await invoke("write_text_file", {
              path: newPath,
              contents: buffer.content,
            })

            // Update buffer to new path
            buffersRef.current.delete(activeFilePath)
            buffersRef.current.set(newPath, {
              ...buffer,
              savedContent: buffer.content,
              isDirty: false,
            })

            // Update the open files lookup map
            openFilesMapRef.current.delete(activeFilePath)
            openFilesMapRef.current.set(newPath, newPath)

            // Update the openFiles list entry
            const newName = newPath.split(/[/\\]/).pop() || newPath
            setOpenFiles((prev) =>
              prev.map((f) =>
                f.path === activeFilePath
                  ? {
                      ...f,
                      id: newPath,
                      path: newPath,
                      name: newName,
                      isDirty: false,
                    }
                  : f
              )
            )

            // Update active file path and ID
            setActiveFilePath(newPath)
            setActiveFileId(newPath)
            setIsDirty(false)

            console.log(
              `[Hibiscus] Saved as: ${newPath.split(/[/\\]/).pop()}`
            )
            return true
          }
        }
      }
      return false
    } catch (error) {
      console.error("[Hibiscus] Failed to save file as:", error)
      return false
    }
  }, [activeFilePath, activeFile])

  /**
   * Close the current active file (legacy compatibility wrapper).
   * Delegates to closeTab for multi-file behavior.
   */
  const closeFile = useCallback(async (): Promise<boolean> => {
    if (!activeFileId) return true
    await closeTab(activeFileId)
    return true
  }, [activeFileId, closeTab])

  /**
   * Check if any files have unsaved changes
   */
  const hasUnsavedFiles = useCallback((): boolean => {
    for (const buffer of buffersRef.current.values()) {
      if (buffer.isDirty) return true
    }
    return false
  }, [])

  /**
   * Get list of files with unsaved changes
   */
  const getUnsavedFiles = useCallback((): string[] => {
    const unsaved: string[] = []
    for (const [path, buffer] of buffersRef.current.entries()) {
      if (buffer.isDirty) {
        unsaved.push(path.split(/[/\\]/).pop() || path)
      }
    }
    return unsaved
  }, [])

  /**
   * Handle application exit with unsaved changes check
   */
  const handleExit = useCallback(async (): Promise<boolean> => {
    const unsavedFiles = getUnsavedFiles()

    if (unsavedFiles.length > 0) {
      const fileList = unsavedFiles.join(", ")
      const action = confirm(
        `You have unsaved changes in: ${fileList}\n\n` +
          "Click OK to save all changes and exit,\n" +
          "or Cancel to continue working."
      )

      if (action) {
        await saveAllFiles()
        return true
      }
      return false
    }

    return true
  }, [getUnsavedFiles, saveAllFiles])

  return {
    // Legacy single-file interface (kept for backward compatibility)
    activeFile,
    activeFilePath,
    fileContent,
    fileVersion,
    isDirty,
    openFile,
    onChange,
    saveCurrentFile,
    saveAllFiles,

    // File menu operations
    saveAsFile,
    closeFile,
    hasUnsavedFiles,
    getUnsavedFiles,
    handleExit,

    // Multi-file tab interface (new)
    openFiles,
    activeFileId,
    switchTab,
    closeTab,

    // Buffer ref (read-only access for knowledge index)
    buffersRef,
  }
}
