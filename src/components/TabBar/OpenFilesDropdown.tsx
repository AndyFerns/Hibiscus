/**
 * ============================================================================
 * OpenFilesDropdown — VS Code-style "Open Editors", as a compact dropdown
 * ============================================================================
 *
 * A trigger at the right end of the tab bar ("3 ▾", or Ctrl+Shift+E) opens a
 * popover anchored under the tab bar, never wider than ~360px or taller than
 * 60% of the window, listing every open file in tab order. From it you can:
 *
 *   - switch to a file (click, Enter)
 *   - close it (✕, middle-click, Delete)
 *   - save it (hover the dirty dot)
 *   - rename it in place (F2 or double-click)
 *   - reorder it (drag the row, or Alt+↑ / Alt+↓)
 *   - filter the list by typing
 *   - Save all / Close saved / Close all
 *
 * The popover is portalled to <body> with fixed positioning so the tab bar's
 * overflow clipping can't cut it off.
 * ============================================================================
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { OpenFile } from "../../types/editor"
import { useReorderDrag } from "../dnd/useReorderDrag"
import "./OpenFilesDropdown.css"

interface OpenFilesDropdownProps {
  openFiles: OpenFile[]
  activeFileId: string | null
  workspaceRoot: string | null
  onSelect: (fileId: string) => void
  onClose: (fileId: string) => void
  onCloseMany?: (fileIds: string[]) => void
  onReorder?: (from: number, to: number) => void
  onRename?: (path: string, newName: string) => Promise<string | null>
  onSave?: (path: string) => void
  onSaveAll?: () => void
}

/** Folder of `path` relative to the workspace, for the dimmed second line. */
export function relativeDir(path: string, root: string | null): string {
  const norm = path.replace(/\\/g, "/")
  const dir = norm.slice(0, norm.lastIndexOf("/"))
  if (root) {
    const r = root.replace(/\\/g, "/").replace(/\/+$/, "")
    if (dir === r) return ""
    if (dir.startsWith(r + "/")) return dir.slice(r.length + 1)
  }
  return dir
}

function FileGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9 1H4C3.45 1 3 1.45 3 2V14C3 14.55 3.45 15 4 15H12C12.55 15 13 14.55 13 14V5L9 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9 1V5H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export const OpenFilesDropdown = memo(function OpenFilesDropdown({
  openFiles,
  activeFileId,
  workspaceRoot,
  onSelect,
  onClose,
  onCloseMany,
  onReorder,
  onRename,
  onSave,
  onSaveAll,
}: OpenFilesDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focusIdx, setFocusIdx] = useState(0)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)

  const dirtyCount = useMemo(() => openFiles.filter((f) => f.isDirty).length, [openFiles])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = openFiles.map((file, index) => ({ file, index }))
    if (!q) return all
    return all.filter(({ file }) => file.path.toLowerCase().includes(q))
  }, [openFiles, query])

  const reorder = useReorderDrag({
    containerRef: listRef,
    axis: "y",
    onReorder: (from, to) => onReorder?.(from, to),
    disabled: !onReorder || !!query.trim() || !!renaming,
    ghostClassName: "dnd-ghost--row",
  })

  // ---- open / close ----
  const place = useCallback(() => {
    const tabBar = triggerRef.current?.closest(".tab-bar")
    const anchor = (tabBar ?? triggerRef.current)?.getBoundingClientRect()
    if (!anchor) return
    setPos({ top: Math.round(anchor.bottom + 4), right: Math.max(8, Math.round(window.innerWidth - anchor.right + 8)) })
  }, [])

  const openPanel = useCallback(() => {
    place()
    setQuery("")
    setRenaming(null)
    const activeIdx = openFiles.findIndex((f) => f.id === activeFileId)
    setFocusIdx(Math.max(0, activeIdx))
    setOpen(true)
  }, [place, openFiles, activeFileId])

  const closePanel = useCallback((restoreFocus = true) => {
    setOpen(false)
    setRenaming(null)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // Ctrl+Shift+E toggles the list from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault()
        e.stopPropagation()
        if (open) closePanel()
        else openPanel()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, openPanel, closePanel])

  // Dismiss on outside click, window resize/blur.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      if ((t as HTMLElement).closest?.(".dnd-ghost")) return
      closePanel(false)
    }
    const onResize = () => place()
    const onBlur = () => closePanel(false)
    window.addEventListener("pointerdown", onDown, true)
    window.addEventListener("resize", onResize)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("blur", onBlur)
    }
  }, [open, closePanel, place])

  useLayoutEffect(() => {
    if (open && !renaming) filterRef.current?.focus()
  }, [open, renaming])

  // Clamp focus when the list shrinks; keep the focused row in view.
  useEffect(() => {
    if (focusIdx > visible.length - 1) setFocusIdx(Math.max(0, visible.length - 1))
  }, [visible.length, focusIdx])

  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${focusIdx}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [focusIdx, open])

  // Nothing open any more: close the panel.
  useEffect(() => {
    if (open && openFiles.length === 0) closePanel(false)
  }, [open, openFiles.length, closePanel])

  // ---- actions ----
  const choose = (fileId: string) => {
    onSelect(fileId)
    closePanel(false)
  }

  const startRename = (file: OpenFile) => {
    if (!onRename) return
    setRenaming(file.id)
    setRenameDraft(file.name)
    setRenameError(null)
  }

  // Enter and the following blur would both commit; let only one through.
  const committingRef = useRef(false)
  const commitRename = async (file: OpenFile) => {
    if (committingRef.current) return
    const name = renameDraft.trim()
    if (!name || name === file.name) {
      setRenaming(null)
      return
    }
    if (/[\\/:*?"<>|]/.test(name)) {
      setRenameError("Names can't contain \\ / : * ? \" < > |")
      return
    }
    committingRef.current = true
    try {
      const result = await onRename?.(file.path, name)
      if (result) {
        setRenaming(null)
        setRenameError(null)
        filterRef.current?.focus()
      } else {
        setRenameError("Couldn't rename. A file with that name may already exist.")
      }
    } finally {
      committingRef.current = false
    }
  }

  const moveFocused = (delta: number) => {
    if (!onReorder || query.trim()) return
    const entry = visible[focusIdx]
    if (!entry) return
    const to = entry.index + delta
    if (to < 0 || to >= openFiles.length) return
    reorder.prepareFlip()
    onReorder(entry.index, to)
    setFocusIdx(to)
  }

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (renaming) return
    const entry = visible[focusIdx]
    if (e.key === "Escape") {
      e.preventDefault()
      if (query) setQuery("")
      else closePanel()
    } else if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault()
      moveFocused(-1)
    } else if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault()
      moveFocused(1)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusIdx((i) => Math.min(visible.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusIdx((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter" && entry) {
      e.preventDefault()
      choose(entry.file.id)
    } else if (e.key === "Delete" && entry && !(e.target instanceof HTMLInputElement && (e.target as HTMLInputElement).value)) {
      e.preventDefault()
      onClose(entry.file.id)
    } else if (e.key === "F2" && entry) {
      e.preventDefault()
      startRename(entry.file)
    }
  }

  const closeSaved = () => {
    const ids = openFiles.filter((f) => !f.isDirty).map((f) => f.id)
    if (onCloseMany) onCloseMany(ids)
    else ids.forEach(onClose)
  }

  const closeAll = () => {
    const ids = openFiles.map((f) => f.id)
    if (onCloseMany) onCloseMany(ids)
    else ids.forEach(onClose)
  }

  // ---- render ----
  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="open-files-panel"
          style={{ top: pos.top, right: pos.right }}
          role="dialog"
          aria-label="Open files"
          onKeyDown={onPanelKeyDown}
        >
          <div className="open-files-header">
            <span className="open-files-title">Open files</span>
            <span className="open-files-count">
              {openFiles.length}
              {dirtyCount > 0 && <span className="open-files-unsaved"> · {dirtyCount} unsaved</span>}
            </span>
          </div>

          <div className="open-files-filter">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              ref={filterRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setFocusIdx(0)
              }}
              placeholder="Filter open files"
              aria-label="Filter open files"
              aria-controls="open-files-list"
              aria-activedescendant={visible[focusIdx] ? `open-file-${focusIdx}` : undefined}
            />
          </div>

          <ul
            id="open-files-list"
            ref={listRef}
            className="open-files-list"
            role="listbox"
            aria-label="Open files"
            onPointerDown={reorder.onPointerDown}
            onClickCapture={reorder.onClickCapture}
          >
            {visible.length === 0 && <li className="open-files-empty">No open files match "{query}"</li>}
            {visible.map(({ file, index }, row) => {
              const isActive = file.id === activeFileId
              const isFocused = row === focusIdx
              const dir = relativeDir(file.path, workspaceRoot)
              const classes = [
                "open-files-row",
                isActive ? "open-files-row--active" : "",
                isFocused ? "open-files-row--focused" : "",
                file.isDirty ? "open-files-row--dirty" : "",
              ]
                .filter(Boolean)
                .join(" ")

              return (
                <li
                  key={file.id}
                  id={`open-file-${row}`}
                  className={classes}
                  role="option"
                  aria-selected={isActive}
                  data-row={row}
                  data-reorder-index={query.trim() ? undefined : index}
                  data-reorder-key={file.id}
                  title={file.path}
                  onMouseMove={() => !isFocused && setFocusIdx(row)}
                  onClick={() => renaming !== file.id && choose(file.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    startRename(file)
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      onClose(file.id)
                    }
                  }}
                >
                  {onReorder && !query.trim() && (
                    <span className="open-files-grip" aria-hidden="true">
                      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                        <circle cx="2" cy="2" r="1" /><circle cx="6" cy="2" r="1" />
                        <circle cx="2" cy="6" r="1" /><circle cx="6" cy="6" r="1" />
                        <circle cx="2" cy="10" r="1" /><circle cx="6" cy="10" r="1" />
                      </svg>
                    </span>
                  )}
                  <span className="open-files-icon"><FileGlyph /></span>

                  {renaming === file.id ? (
                    <span className="open-files-rename" data-no-drag="">
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => {
                          setRenameDraft(e.target.value)
                          setRenameError(null)
                        }}
                        onFocus={(e) => {
                          const dot = e.target.value.lastIndexOf(".")
                          e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length)
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === "Enter") commitRename(file)
                          else if (e.key === "Escape") {
                            setRenaming(null)
                            setRenameError(null)
                            filterRef.current?.focus()
                          }
                        }}
                        onBlur={() => commitRename(file)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`New name for ${file.name}`}
                        aria-invalid={!!renameError}
                      />
                      {renameError && <span className="open-files-rename-error">{renameError}</span>}
                    </span>
                  ) : (
                    <span className="open-files-text">
                      <span className="open-files-name">{file.name}</span>
                      {dir && <span className="open-files-dir">{dir}</span>}
                    </span>
                  )}

                  <span className="open-files-actions">
                    {file.isDirty && onSave ? (
                      <button
                        className="open-files-btn open-files-btn--save"
                        title="Save"
                        aria-label={`Save ${file.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSave(file.path)
                        }}
                      >
                        <span className="open-files-dot" aria-hidden="true" />
                        <svg className="open-files-save-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 2.5h8l2.5 2.5v8.5a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          <path d="M5 2.5v3h5v-3M5 13.5V9.5h6v4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : null}
                    {onRename && renaming !== file.id && (
                      <button
                        className="open-files-btn open-files-btn--hover"
                        title="Rename (F2)"
                        aria-label={`Rename ${file.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(file)
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="open-files-btn open-files-btn--close"
                      title="Close (Del)"
                      aria-label={`Close ${file.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onClose(file.id)
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="open-files-footer">
            {onSaveAll && (
              <button className="open-files-footer-btn" onClick={onSaveAll} disabled={dirtyCount === 0}>
                Save all
              </button>
            )}
            <button className="open-files-footer-btn" onClick={closeSaved} disabled={openFiles.every((f) => f.isDirty)}>
              Close saved
            </button>
            <button className="open-files-footer-btn" onClick={closeAll}>
              Close all
            </button>
            <span className="open-files-hint">Alt+↑↓ reorder · F2 rename</span>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        className={`open-files-trigger${open ? " open-files-trigger--open" : ""}`}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Open files (Ctrl+Shift+E)"
        data-no-drag=""
      >
        <span className="open-files-trigger-count">{openFiles.length}</span>
        {dirtyCount > 0 && <span className="open-files-trigger-dot" aria-label={`${dirtyCount} unsaved`} />}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {panel}
    </>
  )
})
