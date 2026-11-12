/**
 * ============================================================================
 * useReorderDrag — drag to reorder a list (tab strip, open-files list)
 * ============================================================================
 *
 * Items are found through data attributes on the container's children:
 *   data-reorder-index  position in the list
 *   data-reorder-key    stable identity (for the FLIP animation)
 *
 * While dragging, the item lifts into a tilting ghost (same as the tree), the
 * original stays as a faded placeholder, and an accent bar shows the insert
 * position. On drop the list re-orders and every item FLIP-animates from
 * where it was to where it is, with the moved item settling from the ghost's
 * position, so the change is easy to follow without being slow.
 * ============================================================================
 */

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import { createDragGhost, type DragGhost } from "./dragGhost"

const DRAG_THRESHOLD = 4
const FLIP_MS = 180

type Axis = "x" | "y"

interface Options {
  containerRef: RefObject<HTMLElement | null>
  axis: Axis
  /** Called with (from, to) where `to` is the final index of the moved item. */
  onReorder: (from: number, to: number) => void
  /** Disable (e.g. while the list is filtered). */
  disabled?: boolean
  /** Extra class for the ghost. */
  ghostClassName?: string
}

function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

export function useReorderDrag({ containerRef, axis, onReorder, disabled, ghostClassName }: Options) {
  const latest = useRef({ onReorder, disabled })
  latest.current = { onReorder, disabled }

  // FLIP: rects captured right before a reorder, consumed after the re-render.
  const flipRectsRef = useRef<Map<string, DOMRect> | null>(null)
  const suppressClickRef = useRef(false)

  const session = useRef<{
    from: number
    el: HTMLElement
    startX: number
    startY: number
    pointerId: number
    ghost: DragGhost | null
    insertAt: number
    marked: HTMLElement | null
  } | null>(null)

  const items = (): HTMLElement[] =>
    Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-reorder-index]") ?? [])

  const clearMark = () => {
    const s = session.current
    if (s?.marked) {
      s.marked.classList.remove("dnd-insert-before", "dnd-insert-after", "dnd-insert-above", "dnd-insert-below")
      s.marked = null
    }
  }

  /** Insertion slot (0..n) for a pointer position, from item midpoints. */
  const slotAt = (x: number, y: number): number => {
    const list = items()
    for (let i = 0; i < list.length; i++) {
      const r = list[i].getBoundingClientRect()
      const mid = axis === "x" ? r.left + r.width / 2 : r.top + r.height / 2
      if ((axis === "x" ? x : y) < mid) return i
    }
    return list.length
  }

  const markSlot = (slot: number) => {
    const s = session.current
    if (!s) return
    clearMark()
    const list = items()
    // No indicator when dropping would not move anything.
    if (slot === s.from || slot === s.from + 1) {
      s.insertAt = s.from
      return
    }
    s.insertAt = slot > s.from ? slot - 1 : slot
    const before = axis === "x" ? "dnd-insert-before" : "dnd-insert-above"
    const after = axis === "x" ? "dnd-insert-after" : "dnd-insert-below"
    if (slot < list.length) {
      list[slot].classList.add(before)
      s.marked = list[slot]
    } else if (list.length) {
      list[list.length - 1].classList.add(after)
      s.marked = list[list.length - 1]
    }
  }

  const captureRects = (ghostRect: DOMRect | null, movedKey: string | undefined) => {
    const rects = new Map<string, DOMRect>()
    for (const el of items()) {
      const key = el.dataset.reorderKey
      if (key) rects.set(key, el.getBoundingClientRect())
    }
    if (ghostRect && movedKey) rects.set(movedKey, ghostRect)
    flipRectsRef.current = rects
  }

  const end = () => {
    const s = session.current
    if (!s) return
    clearMark()
    s.el.classList.remove("dnd-reorder-source")
    document.body.classList.remove("dnd-active")
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    window.removeEventListener("keydown", onKey, true)
    session.current = null
  }

  function onMove(e: PointerEvent) {
    const s = session.current
    if (!s || e.pointerId !== s.pointerId) return
    if (!s.ghost) {
      if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < DRAG_THRESHOLD) return
      s.ghost = createDragGhost(s.el, s.startX, s.startY, { className: ghostClassName })
      s.el.classList.add("dnd-reorder-source")
      document.body.classList.add("dnd-active")
      suppressClickRef.current = true
    }
    s.ghost.moveTo(e.clientX, e.clientY)
    markSlot(slotAt(e.clientX, e.clientY))

    // Auto-scroll the container near its edges.
    const c = containerRef.current
    if (c) {
      const r = c.getBoundingClientRect()
      if (axis === "x") {
        if (e.clientX < r.left + 30) c.scrollLeft -= 10
        else if (e.clientX > r.right - 30) c.scrollLeft += 10
      } else {
        if (e.clientY < r.top + 24) c.scrollTop -= 8
        else if (e.clientY > r.bottom - 24) c.scrollTop += 8
      }
    }
  }

  function onUp(e: PointerEvent) {
    const s = session.current
    if (!s || e.pointerId !== s.pointerId) return
    const { ghost, from, insertAt, el } = s
    end()
    if (!ghost) return
    if (insertAt === from) {
      ghost.returnHome()
      return
    }
    captureRects(ghost.getRect(), el.dataset.reorderKey)
    ghost.destroy()
    latest.current.onReorder(from, insertAt)
  }

  function onCancel(e: PointerEvent) {
    const s = session.current
    if (!s || e.pointerId !== s.pointerId) return
    const ghost = s.ghost
    end()
    ghost?.returnHome()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape" && session.current?.ghost) {
      e.preventDefault()
      e.stopPropagation()
      const ghost = session.current.ghost
      end()
      ghost.returnHome()
    }
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (latest.current.disabled || e.button !== 0 || session.current) return
    const target = e.target as HTMLElement
    // Buttons and inputs inside an item keep their own behaviour.
    if (target.closest("button, input, [data-no-drag]")) return
    const el = target.closest<HTMLElement>("[data-reorder-index]")
    if (!el || !containerRef.current?.contains(el)) return
    session.current = {
      from: Number(el.dataset.reorderIndex),
      el,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      ghost: null,
      insertAt: Number(el.dataset.reorderIndex),
      marked: null,
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
    window.addEventListener("keydown", onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, axis, ghostClassName])

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  /**
   * Call after a reorder from anywhere (drag or keyboard): record positions
   * now; the FLIP plays after the next commit.
   */
  const prepareFlip = useCallback(() => captureRects(null, undefined), [])

  // Play the FLIP after every commit that follows a captured reorder.
  useLayoutEffect(() => {
    const rects = flipRectsRef.current
    if (!rects) return
    flipRectsRef.current = null
    if (prefersReducedMotion()) return
    for (const el of items()) {
      const key = el.dataset.reorderKey
      const before = key ? rects.get(key) : undefined
      if (!before) continue
      const after = el.getBoundingClientRect()
      const dx = before.left - after.left
      const dy = before.top - after.top
      if (!dx && !dy) continue
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: FLIP_MS, easing: "cubic-bezier(.2,.8,.2,1)" }
      )
    }
  })

  return { onPointerDown, onClickCapture, prepareFlip }
}
