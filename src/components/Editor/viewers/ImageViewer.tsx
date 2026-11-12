/**
 * ImageViewer — fit / actual size, zoom (buttons, Ctrl+wheel) and drag-to-pan,
 * on a checkerboard so transparency is visible. SVGs are shown through <img>,
 * which never runs scripts embedded in them.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { DocumentShell } from "./DocumentShell"
import { clampZoom, getViewerPrefs, setViewerPrefs, type FitMode } from "./viewerPrefs"
import type { DocumentReport } from "../../../utils/fileLoader"

const PAD = 24

const MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  tiff: "image/tiff",
}

interface ImageViewerProps {
  path: string
  bytes: ArrayBuffer
  docKey: string
  report?: DocumentReport | null
  onOpenFile?: (path: string) => void
}

function ImageViewerImpl({ path, bytes, report }: ImageViewerProps) {
  const [initial] = useState(() => getViewerPrefs(path))
  const scrollRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  // For images, "page" means "fit inside the pane"; "width" means actual size.
  const [fit, setFit] = useState<FitMode>(initial.fit === "custom" ? "custom" : "page")
  const [zoom, setZoom] = useState(initial.zoom)
  const [failed, setFailed] = useState(false)

  const url = useMemo(() => {
    const ext = path.split(".").pop()?.toLowerCase() ?? ""
    const type = MIME[report?.kind ?? ""] ?? MIME[ext] ?? "application/octet-stream"
    return URL.createObjectURL(new Blob([bytes], { type }))
  }, [bytes, path, report?.kind])

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const apply = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fitZoom =
    natural && viewport.w && viewport.h
      ? Math.min(1, (viewport.w - PAD * 2) / natural.w, (viewport.h - PAD * 2) / natural.h)
      : 1
  const scale = clampZoom(fit === "page" ? fitZoom : fit === "width" ? 1 : zoom)

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

  const zoomRef = useRef(scale)
  zoomRef.current = scale
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

  // Drag to pan when the image overflows.
  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current
    if (!el || e.button !== 0) return
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return
    const start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    el.setPointerCapture(e.pointerId)
    el.classList.add("imgv-scroll--panning")
    const move = (ev: PointerEvent) => {
      el.scrollLeft = start.left - (ev.clientX - start.x)
      el.scrollTop = start.top - (ev.clientY - start.y)
    }
    const up = () => {
      el.classList.remove("imgv-scroll--panning")
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
  }

  const w = natural ? Math.round(natural.w * scale) : undefined
  const h = natural ? Math.round(natural.h * scale) : undefined

  return (
    <DocumentShell
      path={path}
      kind={natural ? `Image · ${natural.w}×${natural.h}` : "Image"}
      zoom={scale}
      fit={fit}
      onZoom={handleZoom}
      onFit={handleFit}
      fitPageLabel="Fit to pane"
    >
      <div className="imgv-scroll" ref={scrollRef} onPointerDown={onPointerDown}>
        {failed ? (
          <div className="docv-state docv-state--error" role="alert">
            <h3 className="docv-state-title">This image couldn't be decoded</h3>
            <p className="docv-state-reason">The data may be damaged or in a format the viewer doesn't support.</p>
          </div>
        ) : (
          <div className="imgv-stage">
            <img
              className="imgv-img"
              src={url}
              alt={path.split(/[/\\]/).pop() ?? "image"}
              draggable={false}
              width={w}
              height={h}
              onLoad={(e) => {
                const img = e.currentTarget
                setNatural({ w: img.naturalWidth || 300, h: img.naturalHeight || 150 })
              }}
              onError={() => setFailed(true)}
            />
          </div>
        )}
      </div>
    </DocumentShell>
  )
}

const ImageViewer = memo(ImageViewerImpl)
export default ImageViewer
