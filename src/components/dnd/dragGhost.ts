/**
 * ============================================================================
 * Drag ghost — the floating chip that follows the pointer while dragging
 * ============================================================================
 *
 * "Lift and tilt": on pickup the row lifts into a floating card (scale up and
 * a soft shadow); while moving it leans up to ±8° in the direction of travel,
 * driven by pointer velocity, and eases back upright when the pointer stops.
 * A successful drop shrinks the card into its target; a cancelled or invalid
 * drop springs it back to where it came from.
 *
 * Everything here is imperative DOM + Web Animations: pointer moves write a
 * single `transform` per animation frame and never touch React state, which
 * is what keeps dragging smooth even in a large tree.
 * ============================================================================
 */

const MAX_TILT_DEG = 8
const LIFT_SCALE = 1.04

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

export interface DragGhost {
  /** Move the ghost so the grab point sits under (x, y). */
  moveTo(x: number, y: number): void
  /** Animate into `target` (or fade out) and remove. */
  dropInto(target: Element | null): Promise<void>
  /** Spring back to the origin and remove. */
  returnHome(): Promise<void>
  /** Current on-screen box of the ghost. */
  getRect(): DOMRect
  /** Remove immediately. */
  destroy(): void
}

export function createDragGhost(
  source: HTMLElement,
  grabX: number,
  grabY: number,
  options: { label?: string; className?: string } = {}
): DragGhost {
  const reduced = prefersReducedMotion()
  const rect = source.getBoundingClientRect()
  const offsetX = grabX - rect.left
  const offsetY = grabY - rect.top

  const ghost = document.createElement("div")
  ghost.className = `dnd-ghost${options.className ? ` ${options.className}` : ""}`
  ghost.setAttribute("aria-hidden", "true")
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute("id")
  clone.style.margin = "0"
  ghost.appendChild(clone)
  if (options.label) {
    const badge = document.createElement("span")
    badge.className = "dnd-ghost-badge"
    badge.textContent = options.label
    ghost.appendChild(badge)
  }
  ghost.style.width = `${rect.width}px`
  ghost.style.left = "0px"
  ghost.style.top = "0px"
  document.body.appendChild(ghost)

  let x = grabX
  let y = grabY
  let lastX = grabX
  let lastT = performance.now()
  let tilt = 0
  let targetTilt = 0
  let frame = 0
  let alive = true

  const write = () => {
    ghost.style.transform =
      `translate3d(${x - offsetX}px, ${y - offsetY}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${LIFT_SCALE})`
  }

  // Continuous loop so the tilt eases back to 0 even when the pointer rests.
  const tick = () => {
    if (!alive) return
    const now = performance.now()
    if (now - lastT > 60) targetTilt = 0
    tilt += (targetTilt - tilt) * 0.25
    if (Math.abs(tilt) < 0.01) tilt = 0
    write()
    frame = requestAnimationFrame(tick)
  }

  // Pickup: from the row's exact position to lifted.
  ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1)`
  if (!reduced) {
    ghost.animate(
      [
        { boxShadow: "0 0 0 rgba(0,0,0,0)", opacity: 0.6 },
        { boxShadow: "var(--dnd-ghost-shadow)", opacity: 1 },
      ],
      { duration: 140, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    )
    frame = requestAnimationFrame(tick)
  } else {
    write()
  }

  const remove = () => {
    alive = false
    cancelAnimationFrame(frame)
    ghost.remove()
  }

  const currentTransform = () =>
    `translate3d(${x - offsetX}px, ${y - offsetY}px, 0) rotate(${tilt}deg) scale(${LIFT_SCALE})`

  return {
    moveTo(nx, ny) {
      const now = performance.now()
      const dt = Math.max(1, now - lastT)
      const vx = (nx - lastX) / dt // px per ms
      targetTilt = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, vx * 6))
      lastX = nx
      lastT = now
      x = nx
      y = ny
      if (reduced) write()
    },

    async dropInto(target) {
      alive = false
      cancelAnimationFrame(frame)
      if (reduced || !target) {
        await ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" }).finished.catch(() => {})
        ghost.remove()
        return
      }
      const t = target.getBoundingClientRect()
      const gw = ghost.offsetWidth
      const gh = ghost.offsetHeight
      const tx = t.left + Math.min(t.width, 120) / 2 - gw / 2
      const ty = t.top + t.height / 2 - gh / 2
      await ghost
        .animate(
          [
            { transform: currentTransform(), opacity: 1 },
            { transform: `translate3d(${tx}px, ${ty}px, 0) rotate(0deg) scale(0.35)`, opacity: 0 },
          ],
          { duration: 180, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
        )
        .finished.catch(() => {})
      ghost.remove()
    },

    async returnHome() {
      alive = false
      cancelAnimationFrame(frame)
      if (reduced || !source.isConnected) {
        await ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" }).finished.catch(() => {})
        ghost.remove()
        return
      }
      const home = source.getBoundingClientRect()
      await ghost
        .animate(
          [
            { transform: currentTransform() },
            { transform: `translate3d(${home.left}px, ${home.top}px, 0) rotate(0deg) scale(1)` },
          ],
          { duration: 280, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" }
        )
        .finished.catch(() => {})
      ghost.remove()
    },

    getRect: () => ghost.getBoundingClientRect(),

    destroy: remove,
  }
}
