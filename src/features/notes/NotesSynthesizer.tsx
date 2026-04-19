/**
 * ============================================================================
 * NotesSynthesizer — Notes Combination UI (Right Panel)
 * ============================================================================
 *
 * UI for selecting note files, previewing combined output, and saving
 * the synthesized markdown document.
 * ============================================================================
 */

import type { useNotesSynthesis } from "./useNotesSynthesis"
import "./NotesSynthesizer.css"

type NotesHook = ReturnType<typeof useNotesSynthesis>

interface NotesSynthesizerProps {
  notes: NotesHook
}

/** Format badges for file types */
function formatBadge(format: string): string {
  switch (format) {
    case "md": return "MD"
    case "txt": return "TXT"
    case "pdf": return "PDF ⚠"
    case "docx": return "DOCX ⚠"
    default: return format.toUpperCase()
  }
}

export function NotesSynthesizer({ notes }: NotesSynthesizerProps) {
  const {
    inputs,
    output,
    isProcessing,
    error,
    removeFile,
    clearAll,
    synthesize,
    saveOutput,
  } = notes

  return (
    <div className="notes-panel">
      {/* Header */}
      <div className="notes-panel-header">
        <span className="notes-panel-title">Notes Synthesis</span>
      </div>

      {/* File list */}
      <div className="notes-file-list">
        {inputs.length === 0 ? (
          <p className="notes-empty">
            Add .txt or .md files to synthesize into a single document.
          </p>
        ) : (
          inputs.map((input) => (
            <div key={input.path} className="notes-file-item">
              <span className="notes-file-name">{input.name}</span>
              <span className={`notes-file-badge ${input.content === undefined ? "unsupported" : ""}`}>
                {formatBadge(input.format)}
              </span>
              <button
                className="notes-file-remove"
                onClick={() => removeFile(input.path)}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="notes-actions">
        <button
          className="notes-btn notes-btn-primary"
          onClick={synthesize}
          disabled={inputs.length === 0 || isProcessing}
        >
          {isProcessing ? "Processing..." : "Synthesize"}
        </button>
        {inputs.length > 0 && (
          <button className="notes-btn notes-btn-secondary" onClick={clearAll}>
            Clear All
          </button>
        )}
      </div>

      {/* Error */}
      {error && <div className="notes-error">{error}</div>}

      {/* Output preview */}
      {output && (
        <div className="notes-output">
          <div className="notes-output-header">
            <span className="notes-output-title">Preview: {output.title}</span>
            <button
              className="notes-btn notes-btn-primary"
              onClick={() => saveOutput()}
            >
              Save .md
            </button>
          </div>
          <pre className="notes-output-preview">{output.content}</pre>
        </div>
      )}
    </div>
  )
}
