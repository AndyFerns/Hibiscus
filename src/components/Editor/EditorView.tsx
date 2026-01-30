/**
 * ============================================================================
 * EditorView Component
 * ============================================================================
 * 
 * Monaco Editor wrapper component that provides:
 * - Automatic language detection from file extension
 * - Content synchronization with parent state
 * - Debounced change callbacks
 * - Proper cleanup on unmount
 * 
 * IMPORTANT LAYOUT NOTES:
 * - The container uses flex: 1 to fill available space
 * - minHeight: 0 prevents overflow bugs in flex/grid contexts
 * - Monaco's automaticLayout handles resize events
 * 
 * This component is rendered inside the editor-container div in App.tsx
 * ============================================================================
 */

import * as monaco from "monaco-editor"
import { useEffect, useRef } from "react"
import "./EditorView.css"

/**
 * Detect language from file path extension
 * Used to set Monaco editor's syntax highlighting mode
 * 
 * @param path - File path to analyze
 * @returns Monaco language identifier string
 */
function getLanguageFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop()

  // Map file extensions to Monaco language identifiers
  switch (ext) {
    // Markup languages
    case "md":
    case "markdown":
      return "markdown"
    case "html":
    case "htm":
      return "html"
    case "xml":
      return "xml"

    // Stylesheets
    case "css":
      return "css"
    case "scss":
      return "scss"
    case "less":
      return "less"

    // JavaScript ecosystem
    case "js":
      return "javascript"
    case "jsx":
      return "javascript"
    case "ts":
      return "typescript"
    case "tsx":
      return "typescript"

    // Data formats
    case "json":
      return "json"
    case "yaml":
    case "yml":
      return "yaml"

    // Other languages
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

    // Plain text fallback
    case "txt":
    default:
      return "plaintext"
  }
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
 * @property path - File path (used for language detection)
 * @property content - Current file content
 * @property onChange - Callback fired when content changes
 * @property onCursorChange - Callback fired when cursor position changes
 */
interface EditorViewProps {
  path: string
  content: string
  onChange: (value: string) => void
  onCursorChange?: (position: CursorPosition) => void
  onSave?: () => void
}

export function EditorView({
  path,
  content,
  onChange,
  onCursorChange,
  onSave,
}: EditorViewProps) {
  // Refs for Monaco editor instance and container DOM element
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  // ===========================================================================
  // BUG FIX: Use ref to avoid stale closure in Monaco command handler
  // The addCommand callback is registered once on mount. Without this ref,
  // it would capture the initial onSave, causing Ctrl+S to use stale state
  // (wrong file path, outdated content). The ref is updated on every render.
  // ===========================================================================
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  /**
   * Initialize Monaco editor on mount
   * Creates the editor instance with initial content and configuration
   */
  useEffect(() => {
    if (!containerRef.current) return

    // Create Monaco editor instance with dark theme
    editorRef.current = monaco.editor.create(containerRef.current, {
      value: content,
      language: getLanguageFromPath(path),
      theme: "vs-dark",

      // Auto-resize when container changes
      automaticLayout: true,

      // Editor appearance settings
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
      lineHeight: 1.6,

      // Text behavior
      wordWrap: "on",
      tabSize: 2,

      // UI enhancements
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",

      // Padding for breathing room
      padding: { top: 12, bottom: 12 },

      // Hide unnecessary UI elements
      renderLineHighlight: "line",
      scrollBeyondLastLine: false,
    })

    // Set up change listener to propagate edits to parent
    editorRef.current.onDidChangeModelContent(() => {
      onChange(editorRef.current!.getValue())
    })

    // Set up cursor position listener for status bar
    editorRef.current.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column,
        })
      }
    })

    // Register Save command (Ctrl+S / Cmd+S)
    // Uses onSaveRef to always call the LATEST onSave callback
    editorRef.current.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        // Access current onSave via ref to avoid stale closure
        if (onSaveRef.current) {
          onSaveRef.current()
        }
      }
    )

    // Cleanup: dispose editor on unmount
    return () => {
      editorRef.current?.dispose()
    }
  }, []) // Empty deps: only run on mount

  /**
   * Sync content from parent when it changes externally
   * (e.g., when switching files or reverting changes)
   */
  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model && model.getValue() !== content) {
      // Preserve cursor position during content update
      const position = editorRef.current?.getPosition()
      model.setValue(content)
      if (position) {
        editorRef.current?.setPosition(position)
      }
    }
  }, [content])

  /**
   * Update language mode when file path changes
   * Enables syntax highlighting for the new file type
   */
  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, getLanguageFromPath(path))
    }
  }, [path])

  return (
    <div
      ref={containerRef}
      className="monaco-container"
      style={{
        /**
         * CRITICAL: These inline styles are intentionally kept here
         * because they're essential for Monaco's layout calculation.
         * Moving them to CSS can cause rendering issues.
         */
        flex: 1,        // Fill available space in flex container
        minHeight: 0,   // Prevent overflow bugs in flex/grid contexts
      }}
    />
  )
}

