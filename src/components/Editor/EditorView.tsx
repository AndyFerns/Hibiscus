/**
 * ============================================================================
 * EditorView Component
 * ============================================================================
 *
 * Monaco Editor wrapper component that provides:
 * - One text model per open file (see modelRegistry.ts), so switching tabs is
 *   an O(1) `setModel` with cursor/scroll/undo state preserved
 * - Automatic language detection from file extension
 * - Debounced change callbacks (the full-document `getValue()` copy runs at
 *   most once per pause in typing, not on every keystroke)
 * - rAF-throttled cursor reporting for the status bar
 * - A large-file mode that turns off the expensive extras
 * - Inline Markdown live preview (Obsidian-style) via MarkdownInlineDecorator
 *
 * This component is rendered inside the editor-container div in MainPane.
 * ============================================================================
 */

import * as monaco from "monaco-editor"
import { memo, useEffect, useRef } from "react"

import { getEditorConfig } from "../Editor/editorConfig"
import { applyEditorThemeFromCSS } from "../Editor/editorThemeAdapter"
import { FileRenderer } from "./FileRenderer"
import { MarkdownInlineDecorator } from "./markdownInlineDecorator"
import { editorModels } from "./modelRegistry"
import { isBinaryFile } from "../../utils/fileLoader"
import { setCursorPosition as publishCursor } from "../../state/cursorStore"

import "./EditorView.css"
import "./markdownInline.css"

/** Files bigger than this skip word wrap and the inline markdown decorator. */
const LARGE_FILE_CHARS = 2_000_000
const LARGE_FILE_LINES = 50_000

/** Delay before an edit is pushed to the controller (dirty flag, autosave). */
const CHANGE_FLUSH_MS = 120

/**
 * Detect language from file path extension
 * Used to set Monaco editor's syntax highlighting mode
 */
export function getLanguageFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop()

  switch (ext) {
    case "md":
    case "markdown":
      return "markdown"
    case "html":
    case "htm":
      return "html"
    case "xml":
    case "svg":
      return "xml"
    case "css":
      return "css"
    case "scss":
      return "scss"
    case "less":
      return "less"
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript"
    case "ts":
    case "tsx":
      return "typescript"
    case "json":
      return "json"
    case "yaml":
    case "yml":
      return "yaml"
    case "py":
      return "python"
    case "rs":
      return "rust"
    case "go":
      return "go"
    case "sql":
      return "sql"
    case "sh":
    case "bash":
      return "shell"
    case "txt":
    default:
      return "plaintext"
  }
}

function isMarkdownPath(path: string): boolean {
  const p = path.toLowerCase()
  return p.endsWith(".md") || p.endsWith(".markdown")
}

/**
 * Cursor position for status bar display
 */
export interface CursorPosition {
  line: number
  column: number
}

/**
 * EditorView Props Interface
 * @property path - File path (used for language detection and model lookup)
 * @property content - Seed text for a new model / replacement after an external change
 * @property version - Bumped by the controller when `content` must replace the model text
 * @property onChange - Called (debounced) with the new text and the file it belongs to
 * @property onCursorChange - Optional extra cursor listener (status bar uses cursorStore)
 * @property markdownViewMode - "live-preview" for inline rendering, "source" for raw markdown
 */
interface EditorViewProps {
  path: string
  content: string
  version: number
  onChange: (value: string, path?: string) => void
  onCursorChange?: (position: CursorPosition) => void
  onSave?: () => void
  markdownViewMode?: "live-preview" | "source"
  /** Opens a file in the editor (used by document viewers to open extracted notes) */
  onOpenFile?: (path: string) => void
}

function EditorViewImpl({
  path,
  content,
  version,
  onChange,
  onCursorChange,
  onSave,
  markdownViewMode = "live-preview",
  onOpenFile,
}: EditorViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decoratorRef = useRef<MarkdownInlineDecorator | null>(null)

  // Path whose model is currently attached to the editor
  const attachedPathRef = useRef<string | null>(null)
  // Whether the attached model is in large-file mode
  const largeRef = useRef(false)

  // Pending debounced change (path it belongs to + timer)
  const pendingTimerRef = useRef<number | null>(null)
  const pendingPathRef = useRef<string | null>(null)

  // ===========================================================================
  // Callbacks live in refs: Monaco listeners are registered once on mount and
  // must always call the latest callback (stale closures used to save to the
  // wrong file after a tab switch).
  // ===========================================================================
  const onChangeRef = useRef(onChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const onSaveRef = useRef(onSave)
  onChangeRef.current = onChange
  onCursorChangeRef.current = onCursorChange
  onSaveRef.current = onSave

  /** Push the pending edit (if any) to the controller right now. */
  const flushPendingChange = () => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    const target = pendingPathRef.current
    pendingPathRef.current = null
    if (!target) return
    const entry = editorModels.get(target)
    if (entry) onChangeRef.current?.(entry.model.getValue(), target)
  }
  const flushRef = useRef(flushPendingChange)
  flushRef.current = flushPendingChange

  /** Mount: create the editor once, with no model attached yet. */
  useEffect(() => {
    if (!containerRef.current) return

    applyEditorThemeFromCSS()

    const editor = monaco.editor.create(containerRef.current, {
      ...getEditorConfig("", "plaintext"),
      model: null,
    })
    editorRef.current = editor

    editor.onDidChangeModelContent(() => {
      // Programmatic edits (external reloads) are not user changes.
      if (editorModels.isSuppressed()) return
      const target = attachedPathRef.current
      if (!target) return
      if (pendingPathRef.current && pendingPathRef.current !== target) {
        flushRef.current()
      }
      pendingPathRef.current = target
      if (pendingTimerRef.current !== null) clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = window.setTimeout(() => flushRef.current(), CHANGE_FLUSH_MS)
    })

    // Cursor: coalesce to one update per animation frame.
    let cursorFrame = 0
    let lastCursor: CursorPosition | null = null
    editor.onDidChangeCursorPosition((e) => {
      lastCursor = { line: e.position.lineNumber, column: e.position.column }
      if (cursorFrame) return
      cursorFrame = requestAnimationFrame(() => {
        cursorFrame = 0
        if (!lastCursor) return
        publishCursor(lastCursor)
        onCursorChangeRef.current?.(lastCursor)
      })
    })

    // Ctrl+S / Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      flushRef.current()
      if (onSaveRef.current) {
        onSaveRef.current()
      }
    })

    editorModels.setFlushHook(() => flushRef.current())

    return () => {
      flushRef.current()
      editorModels.setFlushHook(null)
      if (cursorFrame) cancelAnimationFrame(cursorFrame)
      decoratorRef.current?.dispose()
      decoratorRef.current = null
      const prev = attachedPathRef.current
      if (prev) {
        const entry = editorModels.get(prev)
        if (entry) entry.viewState = editor.saveViewState()
      }
      // Detach before disposing so models survive (they belong to the registry).
      editor.setModel(null)
      editor.dispose()
      editorRef.current = null
    }
  }, [])

  /**
   * Attach the model for `path` (creating it on first open), or replace its
   * text when the controller bumps `version` for an external change.
   */
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const prevPath = attachedPathRef.current

    if (prevPath !== path) {
      flushRef.current()

      if (prevPath) {
        const prevEntry = editorModels.get(prevPath)
        if (prevEntry) prevEntry.viewState = editor.saveViewState()
      }

      // Binary documents are rendered by the viewers; keep Monaco empty.
      if (isBinaryFile(path)) {
        editor.setModel(null)
        attachedPathRef.current = null
        return
      }

      const language = getLanguageFromPath(path)
      let entry = editorModels.get(path)
      if (!entry) {
        const model = monaco.editor.createModel(content, language)
        entry = { model, viewState: null }
        editorModels.set(path, entry)
      } else {
        const model = entry.model as monaco.editor.ITextModel
        if (model.getLanguageId() !== language) {
          monaco.editor.setModelLanguage(model, language)
        }
      }

      const model = entry.model as monaco.editor.ITextModel
      editor.setModel(model)
      if (entry.viewState) {
        editor.restoreViewState(entry.viewState as monaco.editor.ICodeEditorViewState)
      }
      attachedPathRef.current = path

      // Large-file mode
      const large =
        model.getValueLength() > LARGE_FILE_CHARS || model.getLineCount() > LARGE_FILE_LINES
      largeRef.current = large
      editor.updateOptions({ wordWrap: large ? "off" : "on" })

      const pos = editor.getPosition()
      if (pos) publishCursor({ line: pos.lineNumber, column: pos.column })
      return
    }

    // Same file, new version: the controller has fresh text from disk.
    // Skip if the user is mid-edit; their pending change wins.
    if (pendingTimerRef.current !== null) return
    const entry = editorModels.get(path)
    if (entry && entry.model.getValue() !== content) {
      editorModels.withSuppressed(() => {
        const model = entry.model as monaco.editor.ITextModel
        model.pushEditOperations(
          [],
          [{ range: model.getFullModelRange(), text: content }],
          () => null
        )
      })
    }
    // `content` intentionally omitted: it only matters with a path/version change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, version])

  // ===========================================================================
  // INLINE MARKDOWN DECORATOR — lifecycle management
  // ===========================================================================
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const shouldEnable =
      isMarkdownPath(path) && markdownViewMode === "live-preview" && !largeRef.current

    if (shouldEnable) {
      if (!decoratorRef.current) {
        decoratorRef.current = new MarkdownInlineDecorator(editor, {
          onNavigateLink: (url: string) => {
            console.log("[Hibiscus] Link navigation:", url)
          },
          onNavigateWikiLink: (page: string) => {
            console.log("[Hibiscus] WikiLink navigation:", page)
          },
        })
      }
      decoratorRef.current.setEnabled(true)
    } else if (decoratorRef.current) {
      decoratorRef.current.setEnabled(false)
    }
  }, [path, markdownViewMode])

  return (
    <div className="editor-view-root">
      <FileRenderer file={{ path }} onOpenFile={onOpenFile}>
        <div ref={containerRef} className="monaco-container" />
      </FileRenderer>
    </div>
  )
}

/**
 * Memoized: EditorView only re-renders when the active file, its version or
 * the view mode change, never on unrelated app state (pomodoro ticks,
 * knowledge-index updates, panel toggles).
 */
export const EditorView = memo(EditorViewImpl)
