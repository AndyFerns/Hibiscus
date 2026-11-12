/**
 * Pure layout math for the virtualized page list (PDF pages, thumbnails).
 * Kept free of React/DOM so it can be unit tested directly.
 */

/** Top offset of every item given their heights, a gap and top padding. */
export function computeOffsets(heights: number[], gap: number, padTop: number): number[] {
  const offsets = new Array<number>(heights.length)
  let y = padTop
  for (let i = 0; i < heights.length; i++) {
    offsets[i] = y
    y += heights[i] + gap
  }
  return offsets
}

/** Total scroll height for the list. */
export function totalHeight(offsets: number[], heights: number[], padBottom: number): number {
  if (offsets.length === 0) return padBottom
  const last = offsets.length - 1
  return offsets[last] + heights[last] + padBottom
}

/** Index of the item containing vertical position `y` (clamped). */
export function indexAt(offsets: number[], heights: number[], y: number): number {
  const n = offsets.length
  if (n === 0) return 0
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= y) lo = mid
    else hi = mid - 1
  }
  // Inside the gap after `lo`? Then it still belongs to `lo`.
  void heights
  return lo
}

/**
 * Items intersecting the viewport, widened by `overscan` items each side.
 * Returns an inclusive [start, end] pair; [0, -1] for an empty list.
 */
export function visibleRange(
  offsets: number[],
  heights: number[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number
): [number, number] {
  const n = offsets.length
  if (n === 0) return [0, -1]
  const first = indexAt(offsets, heights, scrollTop)
  const last = indexAt(offsets, heights, scrollTop + Math.max(0, viewportHeight - 1))
  return [Math.max(0, first - overscan), Math.min(n - 1, last + overscan)]
}

/**
 * The "current" page: the one occupying the reading line, a third of the way
 * down the viewport (matches how people perceive "the page I'm on").
 */
export function currentIndex(
  offsets: number[],
  heights: number[],
  scrollTop: number,
  viewportHeight: number
): number {
  return indexAt(offsets, heights, scrollTop + viewportHeight / 3)
}
