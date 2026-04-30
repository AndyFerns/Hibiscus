/**
 * ============================================================================
 * BacklinksPanel — Shows backlinks for the current note
 * ============================================================================
 *
 * Displays a list of notes that link TO the currently active note.
 * Clicking a backlink opens that file in the editor.
 * ============================================================================
 */

import type { KnowledgeIndex } from "./useKnowledgeIndex"
import "./BacklinksPanel.css"

// =============================================================================
// TYPES
// =============================================================================

interface BacklinksPanelProps {
  currentPath: string | null
  index: KnowledgeIndex
  onOpenFile: (path: string) => void
}

// =============================================================================
// HELPERS
// =============================================================================

/** Extract display name from a file path */
function displayName(path: string): string {
  const base = path.split(/[/\\]/).pop() || path
  return base.replace(/\.(md|txt|markdown)$/i, "")
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BacklinksPanel({ currentPath, index, onOpenFile }: BacklinksPanelProps) {
  if (!currentPath) {
    return (
      <div className="backlinks-panel">
        <div className="backlinks-header">
          <span className="backlinks-title">Backlinks</span>
        </div>
        <div className="backlinks-empty">
          No file selected
        </div>
      </div>
    )
  }

  const backlinks = index.backlinks.get(currentPath) || []

  // Deduplicate (safety net)
  const unique = Array.from(new Set(backlinks))

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <span className="backlinks-title">Backlinks</span>
        <span className="backlinks-count">{unique.length}</span>
      </div>

      {unique.length === 0 ? (
        <div className="backlinks-empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>No notes link to this file</span>
        </div>
      ) : (
        <ul className="backlinks-list">
          {unique.map((sourcePath) => (
            <li key={sourcePath} className="backlinks-item">
              <button
                className="backlinks-link"
                onClick={() => onOpenFile(sourcePath)}
                title={sourcePath}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{displayName(sourcePath)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
