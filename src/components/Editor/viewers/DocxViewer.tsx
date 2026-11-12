/**
 * ============================================================================
 * DocxViewer — paginated Word document rendering (docx-preview)
 * ============================================================================
 *
 * docx-preview lays the document out as real pages (one <section> per page,
 * split at the page breaks Word recorded), with headers, footers, footnotes,
 * tables and images, which is far closer to Word than the old single-column
 * HTML conversion. Page navigation and zoom drive that page list.
 *
 * Safety: alt-chunks (embedded raw HTML) and comments are not rendered, and
 * every link click is intercepted: web links open in the system browser,
 * in-document bookmarks scroll, and anything else is ignored.
 * ============================================================================
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { renderAsync } from "docx-preview"
import { openUrl } from "@tauri-apps/plugin-opener"

import { DocumentShell } from "./DocumentShell"
import { DocumentLoading, DocumentErrorState } from "./DocumentState"
import { clampZoom, getViewerPrefs, setViewerPrefs, type FitMode } from "./viewerPrefs"

const PAD = 24

interface DocxViewerProps {
  path: string
  bytes: ArrayBuffer
  docKey: string
  onOpenFile?: (path: string) => void
}

function DocxViewerImpl({ path, bytes, docKey, onOpenFile }: DocxViewerProps) {
  const [initial] = useState(() => getViewerPrefs(path))
  const scrollRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLElement[]>([])

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [page, setPage] = useState(1)
  const [fit, setFit] = useState<FitMode>(initial.fit)
  const [zoom, setZoom] = useState(initial.zoom)
  const [pageBox, setPageBox] = useState({ w: 816, h: 1056 })
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  // ---- Render the document ----
  useEffect(() => {
    const host = hostRef.current
    const styles = styleRef.current
    if (!host || !styles) return
    let cancelled = false
    setStatus("loading")
    setError(null)
    host.replaceChildren()
    styles.replaceChildren()

    renderAsync(bytes, host, styles, {
      className: "docx",
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      ignoreWidth: false,
      ignoreHeight: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: false,
      renderChanges: false,
      renderAltChunks: false,
      useBase64URL: false,
      experimental: false,
    })
      .then(() => {
        if (cancelled) return
        const pages = Array.from(host.querySelectorAll<HTMLElement>("section.docx"))
        pagesRef.current = pages
        setPageCount(pages.length)
        if (pages[0]) setPageBox({ w: pages[0].offsetWidth || 816, h: pages[0].offsetHeight || 1056 })
        setStatus("ready")
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[Hibiscus] DOCX render failed:", err)
        setError(err?.message ? String(err.message) : "The document couldn't be rendered.")
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [docKey, bytes])

  // ---- Viewport size ----
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let timer: number | null = null
    const apply = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    apply()
    const ro = new ResizeObserver(() => {
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(apply, 150)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (timer !== null) clearTimeout(timer)
    }
  }, [])

  const fitWidthZoom = viewport.w ? (viewport.w - PAD * 2) / pageBox.w : 1
  const fitPageZoom = viewport.h ? Math.min(fitWidthZoom, (viewport.h - PAD * 2) / pageBox.h) : fitWidthZoom
  const effectiveZoom = clampZoom(fit === "width" ? Math.min(fitWidthZoom, 1.6) : fit === "page" ? fitPageZoom : zoom)

  // ---- Current page tracking ----
  useEffect(() => {
    const el = scrollRef.current
    if (!el || status !== "ready") return
    let frame = 0
    const update = () => {
      frame = 0
      const pages = pagesRef.current
      if (!pages.length) return
      const line = el.getBoundingClientRect().top + el.clientHeight / 3
      let idx = 0
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].getBoundingClientRect().top <= line) idx = i
        else break
      }
      setPage(idx + 1)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [status, effectiveZoom])

  useEffect(() => {
    if (status === "ready") setViewerPrefs(path, { page })
  }, [page, path, status])

  const goToPage = useCallback((p: number) => {
    const el = scrollRef.current
    const target = pagesRef.current[p - 1]
    if (!el || !target) return
    const delta = target.getBoundingClientRect().top - el.getBoundingClientRect().top
    el.scrollTop += delta - PAD / 2
  }, [])

  // Restore the last page once, keep the current page in place across zooms.
  const restoredRef = useRef(false)
  const pageRef = useRef(page)
  pageRef.current = page
  useLayoutEffect(() => {
    if (status !== "ready") return
    if (!restoredRef.current) {
      restoredRef.current = true
      if (initial.page > 1) goToPage(initial.page)
    } else {
      goToPage(pageRef.current)
    }
  }, [status, effectiveZoom, goToPage, initial.page])

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

  // Ctrl + wheel zoom
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

  // Links: never navigate the app window.
  const onClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a")
    if (!anchor) return
    e.preventDefault()
    const href = anchor.getAttribute("href") || ""
    if (href.startsWith("#")) {
      const target = hostRef.current?.querySelector<HTMLElement>(`[id="${CSS.escape(href.slice(1))}"], [name="${CSS.escape(href.slice(1))}"]`)
      target?.scrollIntoView({ block: "start" })
    } else if (/^(https?:|mailto:)/i.test(href)) {
      openUrl(href).catch((err) => console.warn("[Hibiscus] Couldn't open link:", err))
    }
  }, [])

  return (
    <DocumentShell
      path={path}
      kind="Word"
      page={status === "ready" ? page : undefined}
      pageCount={pageCount}
      onPageChange={goToPage}
      zoom={effectiveZoom}
      fit={fit}
      onZoom={handleZoom}
      onFit={handleFit}
      extractable
      onOpenFile={onOpenFile}
    >
      <div className="docxv-scroll" ref={scrollRef}>
        {status === "loading" && <DocumentLoading label="Laying out pages…" />}
        {status === "error" && (
          <DocumentErrorState path={path} title="This document couldn't be displayed" reason={error} />
        )}
        <div ref={styleRef} hidden />
        <div
          ref={hostRef}
          className="docxv-host"
          style={{ zoom: effectiveZoom, visibility: status === "ready" ? "visible" : "hidden" }}
          onClick={onClick}
        />
      </div>
    </DocumentShell>
  )
}

const DocxViewer = memo(DocxViewerImpl)
export default DocxViewer
