import { describe, expect, it } from "vitest"
import {
  computeOffsets,
  currentIndex,
  indexAt,
  totalHeight,
  visibleRange,
} from "../src/components/Editor/viewers/pdfLayout"

describe("pdfLayout", () => {
  // 1000 pages of 1000px with a 20px gap and 10px top padding.
  const heights = new Array(1000).fill(1000)
  const offsets = computeOffsets(heights, 20, 10)

  it("computes offsets and total height", () => {
    expect(offsets[0]).toBe(10)
    expect(offsets[1]).toBe(1030)
    expect(offsets[999]).toBe(10 + 999 * 1020)
    expect(totalHeight(offsets, heights, 10)).toBe(offsets[999] + 1000 + 10)
  })

  it("finds the page at a position with binary search", () => {
    expect(indexAt(offsets, heights, 0)).toBe(0)
    expect(indexAt(offsets, heights, 1029)).toBe(0) // inside the gap after page 1
    expect(indexAt(offsets, heights, 1030)).toBe(1)
    expect(indexAt(offsets, heights, 10_000_000)).toBe(999)
  })

  it("renders only a small window of a huge document", () => {
    const [start, end] = visibleRange(offsets, heights, 500_000, 900, 2)
    expect(end - start + 1).toBeLessThanOrEqual(6)
    expect(start).toBeGreaterThan(480)
    expect(end).toBeLessThan(495)
  })

  it("clamps the window at both ends", () => {
    expect(visibleRange(offsets, heights, 0, 900, 2)).toEqual([0, 2])
    const [, end] = visibleRange(offsets, heights, offsets[999], 900, 2)
    expect(end).toBe(999)
    expect(visibleRange([], [], 0, 900, 2)).toEqual([0, -1])
  })

  it("reports the page on the reading line", () => {
    // Page 2 starts at 1030; reading line is a third down a 900px viewport.
    expect(currentIndex(offsets, heights, 800, 900)).toBe(1)
    expect(currentIndex(offsets, heights, 600, 900)).toBe(0)
  })

  it("handles mixed page sizes", () => {
    const mixed = [500, 1500, 300]
    const o = computeOffsets(mixed, 10, 0)
    expect(o).toEqual([0, 510, 2020])
    expect(indexAt(o, mixed, 2019)).toBe(1)
    expect(indexAt(o, mixed, 2020)).toBe(2)
  })
})
