/**
 * ============================================================================
 * DocumentShell
 * ============================================================================
 *
 * Shared frame for the read-only document viewers (PDF, DOCX, PPTX, images):
 * a toolbar with page navigation, zoom and fit controls, an optional
 * thumbnails toggle and "Extract to note", plus keyboard navigation:
 *
 *   PageDown / PageUp  next / previous page        Home / End   first / last
 *   Ctrl + = / Ctrl + - / Ctrl + 0  zoom in / out / fit width
 *
 * Ctrl + wheel zoom is wired by each viewer on its own scroll container.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { FitMode } from "./viewerPrefs"

export interface DocumentShellProps {
  path: string
  /** Shown in the badge, e.g. "PDF", "Word", "Slides", "Image" */
  kind: string
  /** "Page" or "Slide" */
  unit?: string
  page?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  zoom?: number
  fit?: FitMode
  onZoom?: (zoom: number) => void
  onFit?: (fit: FitMode) => void
  /** Label for the second fit button ("Fit page" / "Actual size") */
  fitPageLabel?: string
  thumbs?: boolean
  onToggleThumbs?: () => void
  /** Show "Extract to note" (PDF and DOCX only) */
  extractable?: boolean
  onOpenFile?: (path: string) => void
  children: ReactNode
}

const ZOOM_STEP = 1.2

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  prev: "M15 18l-6-6 6-6",
  next: "M9 18l6-6-6-6",
  zoomOut: "M5 12h14",
  zoomIn: "M12 5v14M5 12h14",
  fitWidth: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
  fitPage: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  thumbs: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  extract: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3",
  lock: "M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4",
}

export function DocumentShell({
  path,
  kind,
  unit = "Page",
  page,
  pageCount,
  onPageChange,
  zoom,
  fit,
  onZoom,
  onFit,
  fitPageLabel = "Fit page",
  thumbs,
  onToggleThumbs,
  extractable,
  onOpenFile,
  children,
}: DocumentShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pageDraft, setPageDraft] = useState<string>(page ? String(page) : "")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setPageDraft(page ? String(page) : "")
  }, [page])

  useEffect(() => {
    setMessage(null)
  }, [path])

  const goTo = useCallback(
    (p: number) => {
      if (!onPageChange || !pageCount) return
      onPageChange(Math.min(pageCount, Math.max(1, p)))
    },
    [onPageChange, pageCount]
  )

  const commitDraft = () => {
    const n = parseInt(pageDraft, 10)
    if (Number.isFinite(n)) goTo(n)
    else setPageDraft(page ? String(page) : "")
  }

  const zoomBy = useCallback(
    (factor: number) => {
      if (onZoom && zoom) onZoom(zoom * factor)
    },
    [onZoom, zoom]
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === "INPUT") return
    const mod = e.ctrlKey || e.metaKey
    if (mod && (e.key === "=" || e.key === "+")) {
      e.preventDefault()
      zoomBy(ZOOM_STEP)
    } else if (mod && e.key === "-") {
      e.preventDefault()
      zoomBy(1 / ZOOM_STEP)
    } else if (mod && e.key === "0") {
      e.preventDefault()
      onFit?.("width")
    } else if (!mod && page && pageCount) {
      if (e.key === "PageDown" || (unit === "Slide" && (e.key === "ArrowRight" || e.key === "ArrowDown"))) {
        e.preventDefault()
        goTo(page + 1)
      } else if (e.key === "PageUp" || (unit === "Slide" && (e.key === "ArrowLeft" || e.key === "ArrowUp"))) {
        e.preventDefault()
        goTo(page - 1)
      } else if (e.key === "Home") {
        e.preventDefault()
        goTo(1)
      } else if (e.key === "End") {
        e.preventDefault()
        goTo(pageCount)
      }
    }
  }

  const extract = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const notePath = await invoke<string>("extract_document_to_note", { sourcePath: path })
      const name = notePath.split(/[/\\]/).pop() || notePath
      setMessage(`Created ${name}`)
      onOpenFile?.(notePath)
    } catch (err) {
      console.error("[Hibiscus] Extraction failed:", err)
      setMessage(typeof err === "string" ? err : "Couldn't extract text")
    } finally {
      setBusy(false)
    }
  }

  const hasPaging = !!pageCount && pageCount > 0 && !!onPageChange

  return (
    <div className="docv" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="docv-toolbar" role="toolbar" aria-label={`${kind} viewer controls`}>
        <div className="docv-group">
          {onToggleThumbs && (
            <button
              className={`docv-btn${thumbs ? " docv-btn--on" : ""}`}
              onClick={onToggleThumbs}
              title={thumbs ? "Hide thumbnails" : "Show thumbnails"}
              aria-pressed={!!thumbs}
            >
              <Icon d={ICONS.thumbs} />
            </button>
          )}
          <span className="docv-badge" title={`${kind} files open read-only`}>
            <Icon d={ICONS.lock} size={11} />
            {kind}
          </span>
        </div>

        {hasPaging && (
          <div className="docv-group docv-pager">
            <button className="docv-btn" onClick={() => goTo((page ?? 1) - 1)} disabled={(page ?? 1) <= 1} title={`Previous ${unit.toLowerCase()} (PgUp)`}>
              <Icon d={ICONS.prev} />
            </button>
            <label className="docv-page">
              <span className="sr-only">{unit} number</span>
              <input
                className="docv-page-input"
                value={pageDraft}
                inputMode="numeric"
                onChange={(e) => setPageDraft(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitDraft()
                    rootRef.current?.focus()
                  } else if (e.key === "Escape") {
                    setPageDraft(page ? String(page) : "")
                    rootRef.current?.focus()
                  }
                }}
                aria-label={`${unit} number`}
              />
              <span className="docv-page-total">/ {pageCount}</span>
            </label>
            <button className="docv-btn" onClick={() => goTo((page ?? 1) + 1)} disabled={(page ?? 1) >= (pageCount ?? 1)} title={`Next ${unit.toLowerCase()} (PgDn)`}>
              <Icon d={ICONS.next} />
            </button>
          </div>
        )}

        {onZoom && zoom !== undefined && (
          <div className="docv-group">
            <button className="docv-btn" onClick={() => zoomBy(1 / ZOOM_STEP)} title="Zoom out (Ctrl -)">
              <Icon d={ICONS.zoomOut} />
            </button>
            <span className="docv-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button className="docv-btn" onClick={() => zoomBy(ZOOM_STEP)} title="Zoom in (Ctrl +)">
              <Icon d={ICONS.zoomIn} />
            </button>
            {onFit && (
              <>
                <button className={`docv-btn${fit === "width" ? " docv-btn--on" : ""}`} onClick={() => onFit("width")} title="Fit width (Ctrl 0)" aria-pressed={fit === "width"}>
                  <Icon d={ICONS.fitWidth} />
                </button>
                <button className={`docv-btn${fit === "page" ? " docv-btn--on" : ""}`} onClick={() => onFit("page")} title={fitPageLabel} aria-pressed={fit === "page"}>
                  <Icon d={ICONS.fitPage} />
                </button>
              </>
            )}
          </div>
        )}

        <div className="docv-spacer" />

        {message && <span className="docv-message">{message}</span>}

        {extractable && (
          <button
            className="docv-action"
            onClick={extract}
            disabled={busy}
            title="Extract the text into an editable Markdown note beside this file"
          >
            <Icon d={ICONS.extract} size={13} />
            <span>{busy ? "Extracting…" : "Extract to note"}</span>
          </button>
        )}
      </div>

      <div className="docv-body">{children}</div>
    </div>
  )
}
