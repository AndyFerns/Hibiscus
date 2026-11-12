/**
 * ============================================================================
 * useEditorController Hook
 * ============================================================================
 *
 * Manages the multi-file editor state including:
 * - Open file list (for tab bar display) and tab ordering
 * - Active file selection and switching
 * - File content loading, saving, and buffer management
 * - Dirty state tracking (unsaved changes) per file
 * - Session persistence and restore (via .hibiscus/session.json)
 * - Keyboard shortcut handling (Ctrl+S, Ctrl+W)
 *
 * PERFORMANCE NOTES:
 * - Text lives in Monaco models (see components/Editor/modelRegistry.ts) and
 *   in `buffersRef`. It is NOT mirrored into React state on every keystroke;
 *   `fileContent` only changes when a different file becomes active, so
 *   typing never re-renders the app tree.
 * - `openFiles` is only replaced when a tab's dirty flag actually flips.
 * - Every callback returned here has a stable identity (state is read through
 *   refs), so memoized consumers (TabBar, panes) do not re-render needlessly.
 * - Autosave is debounced per path, so editing file B no longer cancels the
 *   pending autosave of file A.
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
import { isBinaryFile } from "../utils/fileLoader"
import { editorModels, remapPath } from "../components/Editor/modelRegistry"

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

const AUTOSAVE_DELAY_MS = 1000

function baseName(p: string): string {
  return p.split(/[/\\]/).pop() || p
}

function toNode(file: OpenFile): Node {
  return {
    id: file.id,
    name: file.name,
    type: file.type as "file" | "folder",
    path: file.path,
  }
}

/** Pure helper: move one item in an array (exported for tests). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}

export function useEditorController(workspaceRoot: string | null) {
  // =========================================================================
  // MULTI-FILE STATE
  // =========================================================================
  const [openFiles, setOpenFilesState] = useState<OpenFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)

  // Legacy single-file accessors kept for backward compatibility with App.tsx
  const [activeFile, setActiveFile] = useState<Node | null>(null)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  // Buffer map: path -> FileBuffer (O(1) content lookup)
  const buffersRef = useRef<Map<string, FileBuffer>>(new Map())

  // Map for O(1) duplicate-open checking: path -> OpenFile.id
  const openFilesMapRef = useRef<Map<string, string>>(new Map())

  // Content of the *active* file at the moment it became active. Monaco owns
  // the live text; this only seeds a new model and is not updated per edit.
  const [fileContent, setFileContent] = useState("")
  // Bumped only when the active file's text must be replaced from outside
  // (initial load, external change on disk).
  const [fileVersion, setFileVersion] = useState(0)

  // Dirty state for the active file
  const [isDirty, setIsDirty] = useState(false)

  // Refs mirroring state so callbacks can stay stable
  const openFilesRef = useRef<OpenFile[]>([])
  const activeFilePathRef = useRef<string | null>(null)
  const activeFileIdRef = useRef<string | null>(null)
  const workspaceRootRef = useRef(workspaceRoot)
  workspaceRootRef.current = workspaceRoot

  // Per-path autosave timers and in-flight saves
  const saveTimersRef = useRef<Map<string, number>>(new Map())
  const savingRef = useRef<Set<string>>(new Set())

  // Track whether session restore has completed to avoid re-restoring
  const sessionRestoredRef = useRef(false)

  /** Update openFiles state and its ref together. */
  const setOpenFiles = useCallback((updater: OpenFile[] | ((prev: OpenFile[]) => OpenFile[])) => {
    const next = typeof updater === "function" ? updater(openFilesRef.current) : updater
    if (next === openFilesRef.current) return
    openFilesRef.current = next
    setOpenFilesState(next)
  }, [])

  // =========================================================================
  // SESSION PERSISTENCE (debounced in editorSession.ts)
  // =========================================================================
  const persistSession = useCallback(
    (files: OpenFile[] = openFilesRef.current, active: string | null = activeFilePathRef.current) => {
      const root = workspaceRootRef.current
      if (!root) return
      persistEditorSession(root, {
        openFiles: files.map((f) => f.path),
        activeFile: active,
      })
    },
    []
  )

  /** Make `file` the active tab (or clear the editor when null). */
  const activate = useCallback((file: OpenFile | null) => {
    if (!file) {
      activeFileIdRef.current = null
      activeFilePathRef.current = null
      setActiveFileId(null)
      setActiveFile(null)
      setActiveFilePath(null)
      setFileContent("")
      setIsDirty(false)
      return
    }
    const buffer = buffersRef.current.get(file.path)
    activeFileIdRef.current = file.id
    activeFilePathRef.current = file.path
    setActiveFileId(file.id)
    setActiveFile(toNode(file))
    setActiveFilePath(file.path)
    setFileContent(buffer?.content ?? "")
    setIsDirty(buffer?.isDirty ?? false)
  }, [])

  /** Reflect a buffer's dirty flag in tab state, only if it changed. */
  const syncDirty = useCallback((path: string, dirty: boolean) => {
    setOpenFiles((prev) => {
      const idx = prev.findIndex((f) => f.path === path)
      if (idx === -1 || prev[idx].isDirty === dirty) return prev
      const next = prev.slice()
      next[idx] = { ...prev[idx], isDirty: dirty }
      return next
    })
    if (path === activeFilePathRef.current) setIsDirty(dirty)
  }, [setOpenFiles])

  /**
   * Save a file to disk.
   * @param path - Full file path
   * @param content - Content to save (the live buffer wins if it is newer)
   * @param immediate - If true, saves immediately (Ctrl+S). If false, debounced.
   */
  const saveFile = useCallback(
    async (path: string, content: string, immediate = false) => {
      const pending = saveTimersRef.current.get(path)
      if (pending) {
        clearTimeout(pending)
        saveTimersRef.current.delete(path)
      }

      // GUARD: never write a text buffer over a binary document.
      // Binary files are opened read-only with an empty placeholder buffer;
      // writing it back would truncate the real file to zero bytes.
      if (isBinaryFile(path)) {
        console.warn(`[Hibiscus] Refusing to write text to binary file: ${baseName(path)}`)
        return
      }

      const doSave = async () => {
        saveTimersRef.current.delete(path)
        if (savingRef.current.has(path)) {
          // A save for this path is in flight; try again shortly so the
          // latest edit is not silently dropped.
          saveTimersRef.current.set(path, window.setTimeout(doSave, 200))
          return
        }

        const buffer = buffersRef.current.get(path)
        const toWrite = buffer ? buffer.content : content
        savingRef.current.add(path)
        try {
          await invoke("write_text_file", { path, contents: toWrite })
          if (buffer) {
            buffer.savedContent = toWrite
            buffer.isDirty = buffer.content !== toWrite
            syncDirty(path, buffer.isDirty)
          }
          console.log(`[Hibiscus] Saved: ${baseName(path)}`)
        } catch (error) {
          console.error("[Hibiscus] Failed to save file:", error)
        } finally {
          savingRef.current.delete(path)
        }
      }

      if (immediate) {
        await doSave()
      } else {
        saveTimersRef.current.set(path, window.setTimeout(doSave, AUTOSAVE_DELAY_MS))
      }
    },
    [syncDirty]
  )

  // Discard stale responses when several opens race each other.
  const openRequestIdRef = useRef(0)

  /**
   * Open a file in the editor.
   * - If already open, just switch to that tab (no duplicate).
   * - If not open, load content from disk and add to openFiles.
   */
  const openFile = useCallback(
    async (node: Node) => {
      const root = workspaceRootRef.current
      if (!node.path || !root) return

      const fullPath = (await isAbsolute(node.path)) ? node.path : await join(root, node.path)

      // ----- ALREADY OPEN: switch tab -----
      if (openFilesMapRef.current.has(fullPath)) {
        const existing = openFilesRef.current.find((f) => f.path === fullPath)
        if (existing && existing.path !== activeFilePathRef.current) {
          activate(existing)
          persistSession()
        }
        return
      }

      // ----- NEW FILE OPEN -----
      const requestId = ++openRequestIdRef.current
      let buffer = buffersRef.current.get(fullPath)

      if (!buffer) {
        if (isBinaryFile(fullPath)) {
          // Binary documents get an empty placeholder buffer; the viewers load
          // the bytes themselves via read_file_binary.
          buffer = { content: "", savedContent: "", isDirty: false }
        } else {
          try {
            const content = await invoke<string>("read_text_file", { path: fullPath })
            if (requestId !== openRequestIdRef.current) return
            buffer = { content, savedContent: content, isDirty: false }
          } catch (error) {
            console.error("[Hibiscus] Failed to open file:", error)
            return
          }
        }
        buffersRef.current.set(fullPath, buffer)
      }

      if (requestId !== openRequestIdRef.current) return

      const entry: OpenFile = {
        id: fullPath,
        path: fullPath,
        name: node.name || baseName(fullPath),
        type: node.type || "file",
        isDirty: false,
      }

      openFilesMapRef.current.set(fullPath, fullPath)
      const nextFiles = [...openFilesRef.current, entry]
      setOpenFiles(nextFiles)
      activate(entry)
      setFileVersion((v) => v + 1)
      persistSession(nextFiles, fullPath)
    },
    [activate, persistSession, setOpenFiles]
  )

  /** Switch to a specific tab by file ID. */
  const switchTab = useCallback(
    (fileId: string) => {
      if (fileId === activeFileIdRef.current) return
      const file = openFilesRef.current.find((f) => f.id === fileId)
      if (!file || !buffersRef.current.has(file.path)) return
      activate(file)
      persistSession(openFilesRef.current, file.path)
    },
    [activate, persistSession]
  )

  /**
   * Close several tabs at once. Dirty tabs prompt to save first.
   * If the active tab is among them, the nearest surviving tab is activated.
   */
  const closeTabs = useCallback(
    async (fileIds: string[]) => {
      if (fileIds.length === 0) return
      editorModels.flush()

      const current = openFilesRef.current
      const closing = new Set(fileIds)
      const activeId = activeFileIdRef.current
      const activeIdx = current.findIndex((f) => f.id === activeId)

      for (const file of current) {
        if (!closing.has(file.id)) continue
        const buffer = buffersRef.current.get(file.path)
        if (buffer?.isDirty) {
          if (confirm(`Save changes to ${file.name} before closing?`)) {
            await saveFile(file.path, buffer.content, true)
          }
        }
        const timer = saveTimersRef.current.get(file.path)
        if (timer) {
          clearTimeout(timer)
          saveTimersRef.current.delete(file.path)
        }
        buffersRef.current.delete(file.path)
        openFilesMapRef.current.delete(file.path)
        editorModels.release(file.path)
      }

      const remaining = current.filter((f) => !closing.has(f.id))
      setOpenFiles(remaining)

      let nextActive: string | null = activeFilePathRef.current
      if (activeId && closing.has(activeId)) {
        if (remaining.length === 0) {
          activate(null)
          nextActive = null
        } else {
          // Prefer the first survivor at or after the old position, else the last.
          const after = current.slice(activeIdx + 1).find((f) => !closing.has(f.id))
          const next = after ?? remaining[remaining.length - 1]
          activate(next)
          nextActive = next.path
        }
      }

      persistSession(remaining, nextActive)
    },
    [activate, persistSession, saveFile, setOpenFiles]
  )

  /** Close a single tab by file ID. */
  const closeTab = useCallback(
    async (fileId: string) => {
      await closeTabs([fileId])
    },
    [closeTabs]
  )

  /** Move a tab from one index to another (drag reorder). */
  const reorderTabs = useCallback(
    (from: number, to: number) => {
      const next = moveItem(openFilesRef.current, from, to)
      if (next === openFilesRef.current) return
      setOpenFiles(next)
      persistSession(next)
    },
    [persistSession, setOpenFiles]
  )

  /**
   * Re-point open tabs after a file or folder was moved/renamed on disk.
   * `oldPath`/`newPath` are absolute; a folder remaps every tab inside it.
   */
  const renamePath = useCallback(
    (oldPath: string, newPath: string) => {
      const remaps = new Map<string, string>()
      for (const file of openFilesRef.current) {
        const next = remapPath(file.path, oldPath, newPath)
        if (next) remaps.set(file.path, next)
      }
      if (remaps.size === 0) return

      for (const [from, to] of remaps) {
        const buffer = buffersRef.current.get(from)
        if (buffer) {
          buffersRef.current.delete(from)
          buffersRef.current.set(to, buffer)
        }
        const timer = saveTimersRef.current.get(from)
        if (timer) {
          // Re-arm the pending autosave against the new location.
          clearTimeout(timer)
          saveTimersRef.current.delete(from)
          saveFile(to, buffer?.content ?? "", false)
        }
        openFilesMapRef.current.delete(from)
        openFilesMapRef.current.set(to, to)
      }
      editorModels.rename(oldPath, newPath)

      const next = openFilesRef.current.map((f) => {
        const to = remaps.get(f.path)
        return to ? { ...f, id: to, path: to, name: baseName(to) } : f
      })
      setOpenFiles(next)

      const active = activeFilePathRef.current
      const activeTo = active ? remaps.get(active) : undefined
      if (activeTo) {
        const file = next.find((f) => f.path === activeTo)!
        activeFileIdRef.current = file.id
        activeFilePathRef.current = file.path
        setActiveFileId(file.id)
        setActiveFilePath(file.path)
        setActiveFile(toNode(file))
      }
      persistSession(next, activeFilePathRef.current)
    },
    [persistSession, saveFile, setOpenFiles]
  )

  /**
   * Rename an open file on disk (used by the open-files list).
   * Returns the new absolute path, or null on failure.
   */
  const renameFile = useCallback(
    async (oldPath: string, newName: string): Promise<string | null> => {
      const root = workspaceRootRef.current
      const trimmed = newName.trim()
      if (!root || !trimmed || /[/\\]/.test(trimmed)) return null
      const sep = oldPath.includes("\\") ? "\\" : "/"
      const dir = oldPath.slice(0, oldPath.length - baseName(oldPath).length).replace(/[\\/]+$/, "")
      const newPath = `${dir}${sep}${trimmed}`
      if (newPath === oldPath) return oldPath
      try {
        editorModels.flush()
        await invoke("move_node", { workspaceRoot: root, source: oldPath, destination: newPath })
        renamePath(oldPath, newPath)
        return newPath
      } catch (error) {
        console.error("[Hibiscus] Failed to rename file:", error)
        return null
      }
    },
    [renamePath]
  )

  /**
   * Handle content change from the editor.
   * `path` defaults to the active file; EditorView passes it explicitly so a
   * change flushed during a tab switch is attributed to the right file.
   */
  const onChange = useCallback(
    (value: string, path?: string) => {
      const target = path ?? activeFilePathRef.current
      if (!target) return

      // Binary documents are read-only. Acting on change events for their
      // placeholder buffer would trigger an auto-save that destroys them.
      if (isBinaryFile(target)) return

      const buffer = buffersRef.current.get(target)
      if (!buffer) return
      if (buffer.content === value && !buffer.isDirty) return

      buffer.content = value
      const dirty = value !== buffer.savedContent
      if (dirty !== buffer.isDirty) {
        buffer.isDirty = dirty
        syncDirty(target, dirty)
      }

      if (dirty) saveFile(target, value, false)
    },
    [saveFile, syncDirty]
  )

  /** Force save the current file immediately (for Ctrl+S) */
  const saveCurrentFile = useCallback(async () => {
    editorModels.flush()
    const path = activeFilePathRef.current
    if (!path) return
    const buffer = buffersRef.current.get(path)
    if (buffer && buffer.isDirty) {
      await saveFile(path, buffer.content, true)
    }
  }, [saveFile])

  /** Save all dirty files */
  const saveAllFiles = useCallback(async () => {
    editorModels.flush()
    const saves: Promise<void>[] = []
    buffersRef.current.forEach((buffer, path) => {
      if (buffer.isDirty) saves.push(saveFile(path, buffer.content, true))
    })
    await Promise.all(saves)
  }, [saveFile])

  /** Save a specific open file immediately. */
  const saveFileByPath = useCallback(
    async (path: string) => {
      editorModels.flush()
      const buffer = buffersRef.current.get(path)
      if (buffer?.isDirty) await saveFile(path, buffer.content, true)
    },
    [saveFile]
  )

  /** Global keyboard shortcuts for save and close-tab */
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (!e.shiftKey && e.key === "s") {
        e.preventDefault()
        await saveCurrentFile()
      } else if (e.shiftKey && e.key === "S") {
        e.preventDefault()
        await saveAllFiles()
      } else if (!e.shiftKey && e.key === "w") {
        e.preventDefault()
        const id = activeFileIdRef.current
        if (id) await closeTab(id)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [saveCurrentFile, saveAllFiles, closeTab])

  /** Clean up on unmount -- save any dirty files */
  useEffect(() => {
    const timers = saveTimersRef.current
    const buffers = buffersRef.current
    return () => {
      editorModels.flush()
      timers.forEach((t) => clearTimeout(t))
      timers.clear()

      // Binary documents are read-only and must never be written from text.
      buffers.forEach(async (buffer, path) => {
        if (buffer.isDirty && !isBinaryFile(path)) {
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
  // External file changes (File Explorer, other editors).
  // Reload clean buffers from disk; never overwrite unsaved local edits.
  // ===========================================================================
  useEffect(() => {
    if (!workspaceRoot) return

    let unlisten: (() => void) | null = null
    let disposed = false

    listen<string[]>("fs-changed", async (event) => {
      const changed = new Set(event.payload.map((p) => p.replace(/\\/g, "/")))

      for (const [filePath, buffer] of Array.from(buffersRef.current.entries())) {
        if (!changed.has(filePath.replace(/\\/g, "/"))) continue

        // Binary documents have no text buffer to diff; the viewers re-check
        // them (by content hash) themselves.
        if (isBinaryFile(filePath)) continue

        // Our own in-flight save: the watcher is just echoing it back.
        if (savingRef.current.has(filePath)) continue

        try {
          const diskContent = await invoke<string>("read_text_file", { path: filePath })
          if (diskContent === buffer.savedContent) continue

          if (buffer.isDirty) {
            console.warn(
              `[Hibiscus] External change detected for ${baseName(filePath)} ` +
                `but file has unsaved changes. Not reloading.`
            )
            continue
          }

          buffer.content = diskContent
          buffer.savedContent = diskContent
          buffer.isDirty = false
          editorModels.syncContent(filePath, diskContent)

          if (filePath === activeFilePathRef.current) {
            setFileContent(diskContent)
            setIsDirty(false)
            setFileVersion((v) => v + 1)
          }
          console.log(`[Hibiscus] Reloaded external changes: ${baseName(filePath)}`)
        } catch (e) {
          // The file was deleted (moves are re-pointed via renamePath before
          // the watcher fires, so they do not land here).
          console.warn(`[Hibiscus] Could not reload ${filePath}:`, e)
          buffersRef.current.delete(filePath)
          openFilesMapRef.current.delete(filePath)
          editorModels.release(filePath)
          setOpenFiles((prev) => prev.filter((f) => f.path !== filePath))
          if (filePath === activeFilePathRef.current) activate(null)
        }
      }
    }).then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })

    return () => {
      disposed = true
      if (unlisten) unlisten()
    }
  }, [workspaceRoot, activate, setOpenFiles])

  // ===========================================================================
  // SESSION RESTORE
  // ===========================================================================
  useEffect(() => {
    if (!workspaceRoot || sessionRestoredRef.current) return

    const restoreSession = async () => {
      const session = await loadEditorSession(workspaceRoot)
      if (!session || session.openFiles.length === 0) return

      sessionRestoredRef.current = true
      const restored: OpenFile[] = []

      for (const filePath of session.openFiles) {
        if (openFilesMapRef.current.has(filePath)) continue
        try {
          let content: string
          if (isBinaryFile(filePath)) {
            const exists = await invoke<boolean>("file_exists", { path: filePath })
            if (!exists) throw new Error("File no longer exists")
            content = ""
          } else {
            content = await invoke<string>("read_text_file", { path: filePath })
          }
          buffersRef.current.set(filePath, { content, savedContent: content, isDirty: false })
          openFilesMapRef.current.set(filePath, filePath)
          restored.push({ id: filePath, path: filePath, name: baseName(filePath), type: "file", isDirty: false })
        } catch {
          console.warn(`[Hibiscus] Session restore: skipping deleted file ${filePath}`)
        }
      }

      if (restored.length > 0) setOpenFiles((prev) => [...prev, ...restored])

      const activeTarget = session.activeFile
      const target = restored.find((f) => f.path === activeTarget)
      if (target) {
        activate(target)
        setFileVersion((v) => v + 1)
      }
    }

    restoreSession()
  }, [workspaceRoot, activate, setOpenFiles])

  /** Save the current file with a new name/location (Save As) */
  const saveAsFile = useCallback(async (): Promise<boolean> => {
    editorModels.flush()
    const currentPath = activeFilePathRef.current
    if (!currentPath) return false

    try {
      const result = await save({
        defaultPath: baseName(currentPath),
        filters: [{ name: "All Files", extensions: ["*"] }],
      })

      const newPath =
        typeof result === "string" ? result : Array.isArray(result) ? result[0] : null
      if (!newPath) return false

      const buffer = buffersRef.current.get(currentPath)
      if (!buffer) return false

      if (isBinaryFile(currentPath)) {
        // Binary documents have no text buffer -- copy the bytes.
        await invoke("copy_file", { source: currentPath, destination: newPath })
      } else {
        await invoke("write_text_file", { path: newPath, contents: buffer.content })
      }

      buffer.savedContent = buffer.content
      buffer.isDirty = false
      renamePath(currentPath, newPath)
      syncDirty(newPath, false)

      console.log(`[Hibiscus] Saved as: ${baseName(newPath)}`)
      return true
    } catch (error) {
      console.error("[Hibiscus] Failed to save file as:", error)
      return false
    }
  }, [renamePath, syncDirty])

  /** Close the current active file (legacy compatibility wrapper). */
  const closeFile = useCallback(async (): Promise<boolean> => {
    const id = activeFileIdRef.current
    if (id) await closeTab(id)
    return true
  }, [closeTab])

  /** Check if any files have unsaved changes */
  const hasUnsavedFiles = useCallback((): boolean => {
    editorModels.flush()
    for (const buffer of buffersRef.current.values()) {
      if (buffer.isDirty) return true
    }
    return false
  }, [])

  /** Get list of files with unsaved changes */
  const getUnsavedFiles = useCallback((): string[] => {
    editorModels.flush()
    const unsaved: string[] = []
    for (const [path, buffer] of buffersRef.current.entries()) {
      if (buffer.isDirty) unsaved.push(baseName(path))
    }
    return unsaved
  }, [])

  /** Handle application exit with unsaved changes check */
  const handleExit = useCallback(async (): Promise<boolean> => {
    const unsavedFiles = getUnsavedFiles()
    if (unsavedFiles.length > 0) {
      const action = confirm(
        `You have unsaved changes in: ${unsavedFiles.join(", ")}\n\n` +
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
    saveFileByPath,

    // File menu operations
    saveAsFile,
    closeFile,
    hasUnsavedFiles,
    getUnsavedFiles,
    handleExit,

    // Multi-file tab interface
    openFiles,
    activeFileId,
    switchTab,
    closeTab,
    closeTabs,
    reorderTabs,
    renamePath,
    renameFile,

    // Buffer ref (read-only access for knowledge index)
    buffersRef,
  }
}
