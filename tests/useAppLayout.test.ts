import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useAppLayout } from "../src/hooks/useAppLayout"
import { getCursorPosition } from "../src/state/cursorStore"

describe("useAppLayout", () => {
  it("provides the default application layout", () => {
    const { result } = renderHook(() => useAppLayout())

    expect(result.current.showLeftPanel).toBe(true)
    expect(result.current.showRightPanel).toBe(false)
    expect(result.current.showShortcutOverlay).toBe(false)
    expect(result.current.centerView).toBe("editor")
    expect(getCursorPosition()).toEqual({ line: 1, column: 1 })
  })

  it("toggles panel visibility independently", () => {
    const { result } = renderHook(() => useAppLayout())

    act(() => result.current.toggleLeftPanel())
    expect(result.current.showLeftPanel).toBe(false)
    expect(result.current.showRightPanel).toBe(false)

    act(() => result.current.toggleRightPanel())
    expect(result.current.showLeftPanel).toBe(false)
    expect(result.current.showRightPanel).toBe(true)
  })

  it("toggles between editor and graph views", () => {
    const { result } = renderHook(() => useAppLayout())

    act(() => result.current.toggleGraphView())
    expect(result.current.centerView).toBe("graph")

    act(() => result.current.toggleGraphView())
    expect(result.current.centerView).toBe("editor")
  })

  it("toggles and closes the shortcut overlay", () => {
    const { result } = renderHook(() => useAppLayout())

    act(() => result.current.toggleShortcutOverlay())
    expect(result.current.showShortcutOverlay).toBe(true)

    act(() => result.current.closeShortcutOverlay())
    expect(result.current.showShortcutOverlay).toBe(false)
  })

  it("allows orchestration events to update view and cursor state", () => {
    const { result } = renderHook(() => useAppLayout())

    act(() => {
      result.current.setCenterView("graph")
      result.current.setCursorPosition({ line: 12, column: 4 })
    })

    expect(result.current.centerView).toBe("graph")
    expect(getCursorPosition()).toEqual({ line: 12, column: 4 })
  })
})
