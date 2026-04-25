// ============================================================================
// NewItemModal Component (v2 -- Keyboard-Centric)
// ============================================================================
//
// A production-grade modal for creating files and folders with:
// - Real-time path parsing and validation
// - Ranked autocomplete suggestions from the workspace tree
// - Breadcrumb path preview
// - Full keyboard navigation (Enter, Ctrl+Enter, Tab, Arrows, Esc)
// - Mode toggle (file / folder) with automatic detection
//
// ARCHITECTURE:
// This component is a thin UI layer over useNewItemController.
// It renders state -- it does not own business logic.
//
// ENTRY POINTS:
// Used by both the global modal (Ctrl+N / Ctrl+Shift+N) and can be
// embedded inline in the explorer panel.
// ============================================================================

import { useEffect, useRef, useCallback } from "react"
import { useNewItemController } from "../../features/newitem"
import { Node } from "../../types/workspace"
import "./NewItemModal.css"

export type NewItemModalMode = "file" | "folder"

export interface NewItemModalProps {
  /** Whether the modal is currently visible. */
  open: boolean
  /** Initial mode (can be overridden by user input). */
  mode: NewItemModalMode
  /** Callback when the modal should close. */
  onClose: () => void
  /** Workspace root path. */
  workspaceRoot: string | null
  /** Current workspace tree (for suggestions). */
  tree: Node[]
  /** Recently accessed paths (for suggestion boosting). */
  recentItems?: string[]
  /** Callback after successful creation -- receives absolute path. */
  onCreated?: (absolutePath: string, isFile: boolean) => void
}

export function NewItemModal({
  open,
  mode,
  onClose,
  workspaceRoot,
  tree,
  recentItems = [],
  onCreated,
}: NewItemModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLUListElement>(null)

  const {
    state,
    setInput,
    setMode,
    selectPrev,
    selectNext,
    applySuggestion,
    submit,
    reset,
    isCreating,
  } = useNewItemController({
    workspaceRoot,
    tree,
    recentItems,
    onCreated,
  })

  // Sync external mode prop when modal opens.
  useEffect(() => {
    if (open) {
      reset()
      setMode(mode)
      // Focus input after DOM update.
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open, mode, reset, setMode])

  // Scroll selected suggestion into view.
  useEffect(() => {
    if (state.selectedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.children
      const selected = items[state.selectedIndex] as HTMLElement | undefined
      selected?.scrollIntoView({ block: "nearest" })
    }
  }, [state.selectedIndex])

  // ---- Keyboard handler ----
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        onClose()
        break

      case "Enter":
        e.preventDefault()
        if (!state.validation.valid || isCreating) return
        submit(e.ctrlKey || e.metaKey).then(result => {
          if (result.success) onClose()
        })
        break

      case "Tab":
        e.preventDefault()
        if (state.suggestions.length > 0) {
          // If no suggestion selected, select first, then apply.
          if (state.selectedIndex < 0) {
            selectNext()
          }
          applySuggestion()
        }
        break

      case "ArrowUp":
        e.preventDefault()
        selectPrev()
        break

      case "ArrowDown":
        e.preventDefault()
        selectNext()
        break

      default:
        break
    }
  }, [
    state.validation.valid, state.suggestions.length, state.selectedIndex,
    isCreating, onClose, submit, applySuggestion, selectPrev, selectNext,
  ])

  // ---- Suggestion click handler ----
  const handleSuggestionClick = useCallback((index: number) => {
    // Set the selected index and apply immediately.
    setInput(state.suggestions[index]?.label || "")
  }, [state.suggestions, setInput])

  // ---- Render nothing when closed ----
  if (!open) return null

  // ---- Derived display values ----
  const breadcrumbs = state.parsedPath.segments.length > 1
    ? state.parsedPath.segments.slice(0, -1)
    : []
  const itemName = state.parsedPath.name || ""
  const modeLabel = state.mode === "file" ? "File" : "Folder"
  const title = `New ${modeLabel}`

  return (
    <>
      {/* Backdrop */}
      <div className="new-item-modal-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="new-item-modal" role="dialog" aria-label={title}>
        <div className="new-item-modal-content">
          {/* Header with mode toggle */}
          <div className="new-item-modal-header">
            <h2 className="new-item-modal-title">{title}</h2>
            <div className="new-item-modal-mode-toggle">
              <button
                className={`new-item-modal-mode-btn ${state.mode === "file" ? "new-item-modal-mode-btn--active" : ""}`}
                onClick={() => setMode("file")}
                type="button"
                tabIndex={-1}
              >
                File
              </button>
              <button
                className={`new-item-modal-mode-btn ${state.mode === "folder" ? "new-item-modal-mode-btn--active" : ""}`}
                onClick={() => setMode("folder")}
                type="button"
                tabIndex={-1}
              >
                Folder
              </button>
            </div>
          </div>

          {/* Input */}
          <div className="new-item-modal-body">
            <div className="new-item-modal-input-group">
              <input
                ref={inputRef}
                id="new-item-path-input"
                type="text"
                className="new-item-modal-input"
                value={state.rawInput}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={state.mode === "file" ? "path/to/file.ext" : "path/to/folder/"}
                disabled={isCreating}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!state.validation.valid && state.rawInput.length > 0}
                aria-describedby={
                  !state.validation.valid && state.rawInput.length > 0
                    ? "new-item-validation"
                    : undefined
                }
                aria-haspopup="listbox"
                aria-expanded={state.suggestions.length > 0}
                aria-activedescendant={
                  state.selectedIndex >= 0
                    ? `suggestion-${state.selectedIndex}`
                    : undefined
                }
              />
            </div>

            {/* Suggestions list */}
            {state.suggestions.length > 0 && (
              <ul
                ref={suggestionsRef}
                className="new-item-modal-suggestions"
                role="listbox"
                aria-label="Path suggestions"
              >
                {state.suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.label}
                    id={`suggestion-${index}`}
                    className={`new-item-modal-suggestion ${
                      index === state.selectedIndex ? "new-item-modal-suggestion--selected" : ""
                    }`}
                    role="option"
                    aria-selected={index === state.selectedIndex}
                    onClick={() => handleSuggestionClick(index)}
                  >
                    <span className="new-item-modal-suggestion-icon">
                      {suggestion.type === "folder" ? "\u{1F4C1}" : "\u{1F4C4}"}
                    </span>
                    <span className="new-item-modal-suggestion-label">
                      {suggestion.label}
                    </span>
                    <span className="new-item-modal-suggestion-type">
                      {suggestion.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Breadcrumb path preview */}
            {breadcrumbs.length > 0 && (
              <div className="new-item-modal-breadcrumbs" aria-label="Path preview">
                {breadcrumbs.map((segment, i) => (
                  <span key={i} className="new-item-modal-breadcrumb">
                    {segment}
                    <span className="new-item-modal-breadcrumb-sep">/</span>
                  </span>
                ))}
                <span className="new-item-modal-breadcrumb new-item-modal-breadcrumb--current">
                  {itemName}
                </span>
              </div>
            )}

            {/* Validation message */}
            {!state.validation.valid && state.rawInput.length > 0 && (
              <div id="new-item-validation" className="new-item-modal-error" role="alert">
                {state.validation.message}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="new-item-modal-footer">
            <div className="new-item-modal-hints">
              <span className="new-item-modal-hint">Enter: Create</span>
              <span className="new-item-modal-hint">Ctrl+Enter: Create + Open</span>
              <span className="new-item-modal-hint">Tab: Autocomplete</span>
            </div>
            <div className="new-item-modal-actions">
              <button
                className="new-item-modal-button new-item-modal-button--cancel"
                onClick={onClose}
                disabled={isCreating}
                type="button"
              >
                Cancel
              </button>
              <button
                id="new-item-create-btn"
                className="new-item-modal-button new-item-modal-button--create"
                onClick={() => submit(false).then(r => { if (r.success) onClose() })}
                disabled={!state.validation.valid || isCreating}
                type="button"
              >
                {isCreating ? "Creating..." : `Create ${modeLabel}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
