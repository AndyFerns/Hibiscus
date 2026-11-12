/**
 * Tracks which items of a fixed-geometry list are in view, with rAF-throttled
 * scroll handling. State only changes when the visible range or the current
 * item actually changes, so scrolling causes very few React renders.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { currentIndex, visibleRange } from "./pdfLayout"

export function useVirtualList(
  scrollRef: RefObject<HTMLElement | null>,
  offsets: number[],
  heights: number[],
  overscan: number
) {
  const [range, setRange] = useState<[number, number]>([0, -1])
  const [current, setCurrent] = useState(0)
  const geometryRef = useRef({ offsets, heights })
  geometryRef.current = { offsets, heights }
  const frameRef = useRef(0)

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { offsets: o, heights: h } = geometryRef.current
    const next = visibleRange(o, h, el.scrollTop, el.clientHeight, overscan)
    setRange((prev) => (prev[0] === next[0] && prev[1] === next[1] ? prev : next))
    const cur = currentIndex(o, h, el.scrollTop, el.clientHeight)
    setCurrent((prev) => (prev === cur ? prev : cur))
  }, [scrollRef, overscan])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (frameRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0
        measure()
      })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [scrollRef, measure])

  // Re-measure whenever the geometry changes (zoom, resize, sizes loaded).
  useEffect(() => {
    measure()
  }, [offsets, heights, measure])

  return { range, current, measure }
}
