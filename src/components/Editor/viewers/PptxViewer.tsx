/**
 * ============================================================================
 * PptxViewer — one slide at a time, scaled to fit (pptx-preview)
 * ============================================================================
 *
 * The deck is parsed once; each slide is rendered on demand at a fixed
 * logical width and scaled with a CSS transform to fit the pane, so resizing
 * or zooming never re-renders the slide. A numbered slide strip at the bottom
 * and the arrow keys move between slides.
 * ============================================================================
 */

import { memo, useCallback, useEffect, useRef, useState } from "react"
import { init } from "pptx-preview"

import { DocumentShell } from "./DocumentShell"
import { DocumentLoading, DocumentErrorState } from "./DocumentState"
import { clampZoom, getViewerPrefs, setViewerPrefs, type FitMode } from "./viewerPrefs"

/** Logical render width; slides are scaled from here. */
const SLIDE_W = 960
const PAD = 24

type Previewer = ReturnType<typeof init>

interface PptxViewerProps {
  path: string
  bytes: ArrayBuffer
  docKey: string
  onOpenFile?: (path: string) => void
}

function PptxViewerImpl({ path, bytes, docKey }: PptxViewerProps) {
  const [initial] = useState(() => getViewerPrefs(path))
  const frameRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const previewerRef = useRef<Previewer | null>(null)

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [slide, setSlide] = useState(1)
  const [natural, setNatural] = useState({ w: SLIDE_W, h: SLIDE_W * 9 / 16 })
  const [fit, setFit] = useState<FitMode>(initial.fit === "custom" ? "custom" : "page")
  const [zoom, setZoom] = useState(initial.zoom)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  /** Render slide `n` (1-based) and measure its natural size. */
  const showSlide = useCallback((n: number) => {
    const previewer = previewerRef.current
    const host = hostRef.current
    if (!previewer || !host || !previewer.slideCount) return
    const idx = Math.min(previewer.slideCount, Math.max(1, n)) - 1
    try {
      previewer.renderSingleSlide(idx)
    } catch (err) {
      console.error("[Hibiscus] Slide render failed:", err)
    }
    const el = host.querySelector<HTMLElement>(`.pptx-preview-slide-wrapper-${idx}`) ?? host.firstElementChild as HTMLElement | null
    if (el && el.offsetWidth && el.offsetHeight) {
      setNatural((prev) =>
        prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight }
      )
    }
    setSlide(idx + 1)
  }, [])

  // ---- Parse the deck ----
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setStatus("loading")
    setError(null)
    host.replaceChildren()

    const previewer = init(host, { width: SLIDE_W, mode: "slide" })
    previewerRef.current = previewer
    previewer
      .load(bytes.slice(0))
      .then(() => {
        if (cancelled) return
        const total = previewer.slideCount ?? 0
        if (!total) throw new Error("This presentation has no slides.")
        setCount(total)
        setStatus("ready")
        requestAnimationFrame(() => !cancelled && showSlide(initial.page))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error("[Hibiscus] PPTX load failed:", err)
        setError(err instanceof Error ? err.message : "The presentation couldn't be read.")
        setStatus("error")
      })

    return () => {
      cancelled = true
      try {
        previewer.destroy()
      } catch {
        // already torn down
      }
      previewerRef.current = null
      host.replaceChildren()
    }
  }, [docKey, bytes, showSlide, initial.page])

  // ---- Viewport ----
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const apply = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (status === "ready") setViewerPrefs(path, { page: slide })
    const chip = stripRef.current?.querySelector<HTMLElement>(`[data-slide="${slide}"]`)
    chip?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [slide, path, status])

  const fitPage = viewport.w && viewport.h
    ? Math.min((viewport.w - PAD * 2) / natural.w, (viewport.h - PAD * 2) / natural.h)
    : 1
  const fitWidth = viewport.w ? (viewport.w - PAD * 2) / natural.w : 1
  const scale = clampZoom(fit === "page" ? fitPage : fit === "width" ? fitWidth : zoom)

  const handleZoom = useCallback((z: number) => {
    const next = clampZoom(z)
    setFit("custom")
    setZoom(next)
    setViewerPrefs(path, { fit: "custom", zoom: next })
  }, [path])

  const handleFit = useCallback((f: FitMode) => {
    setFit(f)
    setViewerPrefs(path, { fit: f })
  }, [path])

  return (
    <DocumentShell
      path={path}
      kind="Slides"
      unit="Slide"
      page={status === "ready" ? slide : undefined}
      pageCount={count}
      onPageChange={showSlide}
      zoom={scale}
      fit={fit}
      onZoom={handleZoom}
      onFit={handleFit}
    >
      <div className="pptxv">
        <div className="pptxv-stage" ref={frameRef}>
          {status === "loading" && <DocumentLoading label="Opening presentation…" />}
          {status === "error" && (
            <DocumentErrorState path={path} title="This presentation couldn't be displayed" reason={error} />
          )}
          <div
            className="pptxv-sizer"
            style={{
              width: natural.w * scale,
              height: natural.h * scale,
              visibility: status === "ready" ? "visible" : "hidden",
            }}
          >
            <div
              ref={hostRef}
              className="pptxv-host"
              style={{ width: natural.w, transform: `scale(${scale})` }}
            />
          </div>
        </div>
        {status === "ready" && count > 1 && (
          <div className="pptxv-strip" ref={stripRef} role="tablist" aria-label="Slides">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                data-slide={i + 1}
                role="tab"
                aria-selected={slide === i + 1}
                className={`pptxv-chip${slide === i + 1 ? " pptxv-chip--active" : ""}`}
                onClick={() => showSlide(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </DocumentShell>
  )
}

const PptxViewer = memo(PptxViewerImpl)
export default PptxViewer
