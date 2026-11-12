/**
 * ============================================================================
 * PdfViewer — virtualized, navigable PDF rendering
 * ============================================================================
 *
 * Why it is fast on large documents:
 * - Every page size is known up front (fetched from pdf.js in the background),
 *   so the scroll height is exact and nothing jumps while pages render.
 * - Only the pages in view (plus a small overscan) exist in the DOM. Pages
 *   that scroll away are unmounted, which frees their canvases and text
 *   layers, so memory stays flat whether the PDF has 10 pages or 1,000.
 * - Pages are absolutely positioned; scrolling never triggers layout of
 *   hundreds of siblings.
 * - The parsed PDFDocumentProxy is cached (keyed by content hash), so
 *   switching tabs back to a PDF doesn't re-parse it.
 * - Resizes are debounced, and the device pixel ratio is capped at 2.
 * ============================================================================
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Page, pdfjs } from "react-pdf"
import type { PDFDocumentProxy } from "pdfjs-dist"
import "react-pdf/dist/Page/TextLayer.css"

import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

import { DocumentShell } from "./DocumentShell"
import { DocumentLoading, DocumentErrorState } from "./DocumentState"
import { clampZoom, getViewerPrefs, setViewerPrefs, type FitMode } from "./viewerPrefs"
import { computeOffsets, totalHeight } from "./pdfLayout"
import { useVirtualList } from "./useVirtualList"

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/** CSS pixels per PDF point at 100% zoom. */
const PX_PER_PT = 96 / 72
const PAGE_GAP = 16
const PAD = 24
const OVERSCAN = 2
const THUMB_WIDTH = 112
const THUMB_GAP = 14
const RESIZE_DEBOUNCE_MS = 150

interface PageSize {
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// Parsed-document cache (last 3 PDFs)
// ---------------------------------------------------------------------------

const DOC_CACHE_LIMIT = 3
const docCache = new Map<string, Promise<PDFDocumentProxy>>()

function assetUrl(dir: string): string {
  return new URL(`pdfjs/${dir}/`, document.baseURI).href
}

function getPdf(key: string, bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const hit = docCache.get(key)
  if (hit) {
    docCache.delete(key)
    docCache.set(key, hit)
    return hit
  }
  // pdf.js transfers the buffer to its worker; give it a copy so the shared
  // byte cache stays intact.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    cMapUrl: assetUrl("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: assetUrl("standard_fonts"),
  })
  const promise = task.promise
  promise.catch(() => docCache.delete(key))
  docCache.set(key, promise)
  while (docCache.size > DOC_CACHE_LIMIT) {
    const [oldKey, oldDoc] = docCache.entries().next().value as [string, Promise<PDFDocumentProxy>]
    docCache.delete(oldKey)
    oldDoc.then((d) => d.destroy()).catch(() => {})
  }
  return promise
}

/** Read every page size, first page immediately, the rest in idle chunks. */
async function loadPageSizes(
  pdf: PDFDocumentProxy,
  onUpdate: (sizes: PageSize[]) => void,
  isCancelled: () => boolean
) {
  const n = pdf.numPages
  const first = (await pdf.getPage(1)).getViewport({ scale: 1 })
  const sizes: PageSize[] = new Array(n).fill(null).map(() => ({ w: first.width, h: first.height }))
  onUpdate(sizes.slice())

  const CHUNK = 40
  for (let start = 2; start <= n; start += CHUNK) {
    if (isCancelled()) return
    const end = Math.min(n, start + CHUNK - 1)
    const batch = []
    for (let i = start; i <= end; i++) batch.push(pdf.getPage(i))
    const pages = await Promise.all(batch)
    let changed = false
    pages.forEach((p, idx) => {
      const vp = p.getViewport({ scale: 1 })
      const s = sizes[start - 1 + idx]
      if (s.w !== vp.width || s.h !== vp.height) {
        sizes[start - 1 + idx] = { w: vp.width, h: vp.height }
        changed = true
      }
    })
    if (changed && !isCancelled()) onUpdate(sizes.slice())
    // Yield so scrolling stays smooth while sizes stream in.
    await new Promise((r) => setTimeout(r, 0))
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PdfViewerProps {
  path: string
  bytes: ArrayBuffer
  docKey: string
  onOpenFile?: (path: string) => void
}

function PdfViewerImpl({ path, bytes, docKey, onOpenFile }: PdfViewerProps) {
  const [initial] = useState(() => getViewerPrefs(path))
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sizes, setSizes] = useState<PageSize[]>([])
  const [fit, setFit] = useState<FitMode>(initial.fit)
  const [zoom, setZoom] = useState(initial.zoom)
  const [thumbs, setThumbs] = useState(initial.thumbs)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  const scrollRef = useRef<HTMLDivElement>(null)
  const thumbScrollRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const anchorRef = useRef<{ index: number; frac: number } | null>(null)

  // ---- Load document + page sizes ----
  useEffect(() => {
    let cancelled = false
    restoredRef.current = false
    setPdf(null)
    setSizes([])
    setError(null)
    getPdf(docKey, bytes)
      .then((doc) => {
        if (cancelled) return
        setPdf(doc)
        return loadPageSizes(doc, (s) => !cancelled && setSizes(s), () => cancelled)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[Hibiscus] PDF load failed:", err)
        setError(err?.message ? String(err.message) : "pdf.js couldn't parse this file.")
      })
    return () => {
      cancelled = true
    }
  }, [docKey, bytes])

  // ---- Track viewport size (debounced) ----
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let timer: number | null = null
    const apply = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    apply()
    const ro = new ResizeObserver(() => {
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(apply, RESIZE_DEBOUNCE_MS)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (timer !== null) clearTimeout(timer)
    }
  }, [])

  // ---- Scale ----
  const maxW = useMemo(() => sizes.reduce((m, s) => Math.max(m, s.w), 0), [sizes])
  const fitWidthZoom = maxW && viewport.w ? (viewport.w - PAD * 2) / (maxW * PX_PER_PT) : 1
  const fitPageZoom =
    sizes.length && viewport.h
      ? Math.min(fitWidthZoom, (viewport.h - PAD * 2) / (sizes[0].h * PX_PER_PT))
      : fitWidthZoom
  const effectiveZoom = clampZoom(fit === "width" ? fitWidthZoom : fit === "page" ? fitPageZoom : zoom)
  const scale = effectiveZoom * PX_PER_PT

  // ---- Geometry ----
  const heights = useMemo(() => sizes.map((s) => Math.round(s.h * scale)), [sizes, scale])
  const offsets = useMemo(() => computeOffsets(heights, PAGE_GAP, PAD), [heights])
  const contentHeight = totalHeight(offsets, heights, PAD)
  const contentWidth = Math.max(viewport.w, Math.round(maxW * scale) + PAD * 2)

  const { range, current, measure } = useVirtualList(scrollRef, offsets, heights, OVERSCAN)
  const page = sizes.length ? current + 1 : 0

  // Latest geometry for listeners registered once.
  const geometryRef = useRef({ offsets, heights })
  geometryRef.current = { offsets, heights }

  // Remember the reading position (page + fraction into it) on every user
  // scroll, so zoom changes and late-arriving page sizes can keep it fixed.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const { offsets: o, heights: h } = geometryRef.current
      if (!o.length) return
      let idx = 0
      let lo = 0
      let hi = o.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (o[mid] <= el.scrollTop) {
          idx = mid
          lo = mid + 1
        } else hi = mid - 1
      }
      anchorRef.current = { index: idx, frac: (el.scrollTop - o[idx]) / Math.max(1, h[idx]) }
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // Persist the current page for next time.
  useEffect(() => {
    if (restoredRef.current && page > 0) setViewerPrefs(path, { page })
  }, [page, path])

  // Re-apply the reading position whenever the geometry changes.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !heights.length) return
    if (!restoredRef.current) {
      // First layout: jump to the page the reader was on last time.
      const target = Math.min(heights.length, Math.max(1, getViewerPrefs(path).page)) - 1
      el.scrollTop = target > 0 ? offsets[target] - PAD / 2 : 0
      restoredRef.current = true
    } else {
      const anchor = anchorRef.current
      if (anchor && anchor.index < heights.length) {
        el.scrollTop = offsets[anchor.index] + anchor.frac * heights[anchor.index]
      }
    }
    measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsets])

  const goToPage = useCallback(
    (p: number) => {
      const el = scrollRef.current
      if (!el || !offsets.length) return
      const idx = Math.min(offsets.length, Math.max(1, p)) - 1
      el.scrollTo({ top: Math.max(0, offsets[idx] - PAD / 2), behavior: "auto" })
    },
    [offsets]
  )

  const handleZoom = useCallback((z: number) => {
    setFit("custom")
    setZoom(clampZoom(z))
    setViewerPrefs(path, { fit: "custom", zoom: clampZoom(z) })
  }, [path])

  const handleFit = useCallback((f: FitMode) => {
    setFit(f)
    setViewerPrefs(path, { fit: f })
  }, [path])

  const toggleThumbs = useCallback(() => {
    setThumbs((t) => {
      setViewerPrefs(path, { thumbs: !t })
      return !t
    })
  }, [path])

  // Ctrl + wheel zoom (needs a non-passive native listener).
  const zoomRef = useRef(effectiveZoom)
  zoomRef.current = effectiveZoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      handleZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [handleZoom])

  const dpr = Math.min(2, window.devicePixelRatio || 1)

  // ---- Render ----
  const ready = !!pdf && sizes.length > 0 && !error
  const pages = []
  if (ready) {
    for (let i = range[0]; i <= range[1]; i++) {
      const w = Math.round(sizes[i].w * scale)
      pages.push(
        <div
          key={i}
          className="pdfv-page"
          style={{ top: offsets[i], width: w, height: heights[i], left: Math.round((contentWidth - w) / 2) }}
          data-page={i + 1}
        >
          <Page
            pdf={pdf}
            pageNumber={i + 1}
            scale={scale}
            devicePixelRatio={dpr}
            renderTextLayer
            renderAnnotationLayer={false}
            loading={null}
          />
        </div>
      )
    }
  }

  return (
    <DocumentShell
      path={path}
      kind="PDF"
      page={page}
      pageCount={sizes.length}
      onPageChange={goToPage}
      zoom={effectiveZoom}
      fit={fit}
      onZoom={handleZoom}
      onFit={handleFit}
      thumbs={thumbs}
      onToggleThumbs={ready ? toggleThumbs : undefined}
      extractable
      onOpenFile={onOpenFile}
    >
      <div className="pdfv">
        {thumbs && ready && (
          <PdfThumbnails
            pdf={pdf!}
            sizes={sizes}
            current={current}
            onSelect={goToPage}
            scrollRef={thumbScrollRef}
          />
        )}
        {/* The scroll element is always mounted so the ResizeObserver and
            scroll listeners stay attached across loading -> ready. */}
        <div className="pdfv-scroll" ref={scrollRef}>
          {error ? (
            <DocumentErrorState path={path} title="This PDF couldn't be displayed" reason={error} />
          ) : !ready ? (
            <DocumentLoading label="Rendering PDF…" />
          ) : (
            <div className="pdfv-canvas" style={{ height: contentHeight, width: contentWidth }}>
              {pages}
            </div>
          )}
        </div>
      </div>
    </DocumentShell>
  )
}

// ---------------------------------------------------------------------------
// Thumbnails (also virtualized)
// ---------------------------------------------------------------------------

const PdfThumbnails = memo(function PdfThumbnails({
  pdf,
  sizes,
  current,
  onSelect,
  scrollRef,
}: {
  pdf: PDFDocumentProxy
  sizes: PageSize[]
  current: number
  onSelect: (page: number) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const LABEL = 18
  const heights = useMemo(
    () => sizes.map((s) => Math.round((s.h / s.w) * THUMB_WIDTH) + LABEL),
    [sizes]
  )
  const offsets = useMemo(() => computeOffsets(heights, THUMB_GAP, 12), [heights])
  const { range } = useVirtualList(scrollRef, offsets, heights, 3)

  // Keep the active thumbnail in view.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || offsets[current] === undefined) return
    const top = offsets[current]
    const bottom = top + heights[current]
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3) })
    }
  }, [current, offsets, heights, scrollRef])

  const items = []
  for (let i = range[0]; i <= range[1]; i++) {
    items.push(
      <button
        key={i}
        className={`pdfv-thumb${i === current ? " pdfv-thumb--active" : ""}`}
        style={{ top: offsets[i], height: heights[i] }}
        onClick={() => onSelect(i + 1)}
        aria-label={`Page ${i + 1}`}
        aria-current={i === current ? "page" : undefined}
      >
        <span className="pdfv-thumb-img" style={{ height: heights[i] - LABEL }}>
          <Page
            pdf={pdf}
            pageNumber={i + 1}
            width={THUMB_WIDTH}
            devicePixelRatio={1}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
          />
        </span>
        <span className="pdfv-thumb-label">{i + 1}</span>
      </button>
    )
  }

  return (
    <div className="pdfv-thumbs" ref={scrollRef}>
      <div style={{ position: "relative", height: totalHeight(offsets, heights, 12) }}>{items}</div>
    </div>
  )
})

const PdfViewer = memo(PdfViewerImpl)
export default PdfViewer
