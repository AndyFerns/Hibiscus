/**
 * ============================================================================
 * useTreeDrag — pointer-driven drag and drop for the file explorer
 * ============================================================================
 *
 * Replaces HTML5 drag-and-drop, which flickered (dragleave fires on every
 * child element), could not be animated, and showed the browser's own
 * translucent snapshot. Here:
 *
 * - A drag starts once the pointer travels 4px from where it was pressed, so
 *   plain clicks still open files.
 * - The floating ghost is moved imperatively once per frame (see dragGhost);
 *   hovering only toggles classes on the hovered row, so React does not
 *   re-render the tree while you drag.
 * - Drop targets are discovered with elementFromPoint + data attributes:
 *     data-drop-folder="<id>"  a folder (or "" for the workspace root)
 *     data-drop-open           somewhere that opens the file (the tab bar)
 *   Hovering a file targets the folder that contains it.
 * - Hovering a collapsed folder for 500ms expands it; the list auto-scrolls
 *   near its top and bottom edges.
 * - Esc cancels; illegal targets (a folder into itself or its descendants,
 *   or the folder it already lives in) show a "no" state and spring back.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, type RefObject } from "react"
import type { Node } from "../../types/workspace"
import { createDragGhost, type DragGhost } from "../dnd/dragGhost"
import { canDrop, findNode } from "./treeOps"

const DRAG_THRESHOLD = 4
const EXPAND_DELAY_MS = 500
const EDGE_SCROLL_PX = 36
const EDGE_SCROLL_SPEED = 12

type Target =
  | { kind: "folder"; folderId: string; el: HTMLElement; valid: boolean }
  | { kind: "open"; el: HTMLElement; valid: boolean }
  | null

interface Options {
  tree: Node[]
  scrollRef: RefObject<HTMLElement | null>
  expandedNodes: Set<string>
  expandNode: (id: string) => void
  onMoveNode?: (sourceId: string, targetFolderId: string) => unknown
  onOpen: (node: Node) => void
}

function cssId(id: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&")
}

export function useTreeDrag({ tree, scrollRef, expandedNodes, expandNode, onMoveNode, onOpen }: Options) {
  // Latest values for listeners registered during a drag
  const latest = useRef({ tree, expandedNodes, expandNode, onMoveNode, onOpen })
  latest.current = { tree, expandedNodes, expandNode, onMoveNode, onOpen }

  const sessionRef = useRef<{
    sourceId: string
    sourceEl: HTMLElement
    startX: number
    startY: number
    pointerId: number
    ghost: DragGhost | null
    target: Target
    highlighted: HTMLElement | null
    expandTimer: number | null
    expandFor: string | null
    frame: number
    lastX: number
    lastY: number
  } | null>(null)

  const suppressClickRef = useRef(false)

  const clearHighlight = (s: NonNullable<typeof sessionRef.current>) => {
    if (s.highlighted) {
      s.highlighted.classList.remove("dnd-over", "dnd-over--invalid")
      s.highlighted = null
    }
  }

  const resolveTarget = (s: NonNullable<typeof sessionRef.current>, x: number, y: number): Target => {
    const hit = document.elementFromPoint(x, y) as HTMLElement | null
    if (!hit || hit.closest(".dnd-ghost")) return null

    const openZone = hit.closest<HTMLElement>("[data-drop-open]")
    if (openZone) {
      const node = findNode(latest.current.tree, s.sourceId)
      return { kind: "open", el: openZone, valid: !!node && node.type !== "folder" }
    }

    const zone = hit.closest<HTMLElement>("[data-drop-folder]")
    if (!zone) return null
    const folderId = zone.dataset.dropFolder ?? ""
    // Highlight the folder row itself (a file row targets its parent folder).
    let el: HTMLElement | null = zone
    if (zone.dataset.nodeType === "file") {
      el = folderId
        ? scrollRef.current?.querySelector<HTMLElement>(`[data-node-id="${cssId(folderId)}"]`) ?? zone
        : scrollRef.current?.closest<HTMLElement>("[data-drop-root]") ?? zone
    }
    return { kind: "folder", folderId, el: el!, valid: canDrop(s.sourceId, folderId) }
  }

  const applyTarget = (s: NonNullable<typeof sessionRef.current>, target: Target) => {
    const prev = s.target
    const same =
      prev && target && prev.kind === target.kind && prev.el === target.el && prev.valid === target.valid
    s.target = target
    if (!same) {
      clearHighlight(s)
      if (target) {
        target.el.classList.add(target.valid ? "dnd-over" : "dnd-over--invalid")
        s.highlighted = target.el
      }
    }

    // Spring-load collapsed folders.
    const folderId = target?.kind === "folder" && target.valid ? target.folderId : null
    if (folderId !== s.expandFor) {
      if (s.expandTimer !== null) clearTimeout(s.expandTimer)
      s.expandTimer = null
      s.expandFor = folderId
      if (folderId && !latest.current.expandedNodes.has(folderId)) {
        s.expandTimer = window.setTimeout(() => {
          latest.current.expandNode(folderId)
        }, EXPAND_DELAY_MS)
      }
    }
  }

  const edgeScroll = (y: number) => {
    const el = scrollRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (y < r.top + EDGE_SCROLL_PX) el.scrollTop -= EDGE_SCROLL_SPEED
    else if (y > r.bottom - EDGE_SCROLL_PX) el.scrollTop += EDGE_SCROLL_SPEED
  }

  const endSession = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    sessionRef.current = null
    clearHighlight(s)
    if (s.expandTimer !== null) clearTimeout(s.expandTimer)
    cancelAnimationFrame(s.frame)
    s.sourceEl.classList.remove("tree-node--dragging")
    document.body.classList.remove("dnd-active")
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerCancel)
    window.removeEventListener("keydown", onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancel = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    const ghost = s.ghost
    endSession()
    ghost?.returnHome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endSession])

  function onPointerMove(e: PointerEvent) {
    const s = sessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    s.lastX = e.clientX
    s.lastY = e.clientY

    if (!s.ghost) {
      if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < DRAG_THRESHOLD) return
      // Start the drag.
      s.ghost = createDragGhost(s.sourceEl, s.startX, s.startY, { className: "dnd-ghost--tree" })
      s.sourceEl.classList.add("tree-node--dragging")
      document.body.classList.add("dnd-active")
      suppressClickRef.current = true
    }

    s.ghost.moveTo(e.clientX, e.clientY)
    if (!s.frame) {
      s.frame = requestAnimationFrame(() => {
        const cur = sessionRef.current
        if (!cur) return
        cur.frame = 0
        applyTarget(cur, resolveTarget(cur, cur.lastX, cur.lastY))
        edgeScroll(cur.lastY)
      })
    }
  }

  function onPointerUp(e: PointerEvent) {
    const s = sessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    if (!s.ghost) {
      // Never crossed the threshold: it was a click.
      endSession()
      return
    }
    const target = resolveTarget(s, e.clientX, e.clientY)
    const ghost = s.ghost
    const sourceId = s.sourceId
    endSession()

    if (!target || !target.valid) {
      ghost.returnHome()
      return
    }

    ghost.dropInto(target.el)
    // Landing bounce on the receiving row.
    target.el.classList.remove("dnd-landed")
    void target.el.offsetWidth
    target.el.classList.add("dnd-landed")
    window.setTimeout(() => target.el.classList.remove("dnd-landed"), 450)

    if (target.kind === "open") {
      const node = findNode(latest.current.tree, sourceId)
      if (node) latest.current.onOpen(node)
    } else {
      latest.current.onMoveNode?.(sourceId, target.folderId)
    }
  }

  function onPointerCancel(e: PointerEvent) {
    const s = sessionRef.current
    if (!s || e.pointerId !== s.pointerId) return
    cancel()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && sessionRef.current?.ghost) {
      e.preventDefault()
      e.stopPropagation()
      cancel()
    }
  }

  /** Attach to the tree container's onPointerDown. */
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-node-id]")
    if (!row || !scrollRef.current?.contains(row)) return
    if (sessionRef.current) return
    sessionRef.current = {
      sourceId: row.dataset.nodeId!,
      sourceEl: row,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      ghost: null,
      target: null,
      highlighted: null,
      expandTimer: null,
      expandFor: null,
      frame: 0,
      lastX: e.clientX,
      lastY: e.clientY,
    }
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerCancel)
    window.addEventListener("keydown", onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef])

  /** Attach to the tree container's onClickCapture to swallow the post-drag click. */
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  // Reset the click guard if the drag ended outside the tree (no click fires there).
  useEffect(() => {
    const reset = () => {
      if (!sessionRef.current) window.setTimeout(() => (suppressClickRef.current = false), 0)
    }
    window.addEventListener("pointerup", reset)
    return () => window.removeEventListener("pointerup", reset)
  }, [])

  useEffect(() => () => cancel(), [cancel])

  return { onPointerDown, onClickCapture }
}
