/**
 * Tab operations on the editor controller: reorder, bulk close, rename/move
 * re-pointing, and the no-spurious-autosave guarantee on tab switches.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const mockInvoke = vi.fn()

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: () => Promise.resolve(() => {}),
}))

vi.mock("@tauri-apps/api/path", () => ({
  isAbsolute: () => Promise.resolve(true),
  join: (...parts: string[]) => Promise.resolve(parts.join("/")),
}))

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }))

import { moveItem, useEditorController } from "../src/hooks/useEditorController"
import { editorModels, remapPath } from "../src/components/Editor/modelRegistry"

const ROOT = "/ws"
const files = ["/ws/a.md", "/ws/b.md", "/ws/notes/c.md", "/ws/notes/d.md"]

async function openAll() {
  const hook = renderHook(() => useEditorController(ROOT))
  for (const path of files) {
    await act(async () => {
      await hook.result.current.openFile({ id: path, name: path.split("/").pop()!, path, type: "file" })
    })
  }
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  editorModels.clear()
  mockInvoke.mockImplementation((cmd: string, args?: { path?: string }) => {
    if (cmd === "read_text_file") return Promise.resolve(`content of ${args?.path}`)
    return Promise.resolve(undefined)
  })
})

describe("pure helpers", () => {
  it("moveItem moves forward and backward", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3])
    const same = [1, 2]
    expect(moveItem(same, 1, 1)).toBe(same)
  })

  it("remapPath handles files, folders and Windows separators", () => {
    expect(remapPath("/ws/a.md", "/ws/a.md", "/ws/z.md")).toBe("/ws/z.md")
    expect(remapPath("/ws/notes/c.md", "/ws/notes", "/ws/archive/notes")).toBe("/ws/archive/notes/c.md")
    expect(remapPath("/ws/notes-old/c.md", "/ws/notes", "/ws/x")).toBeNull()
    expect(remapPath("C:\\ws\\notes\\c.md", "C:\\ws\\notes", "C:\\ws\\n2")).toBe("C:\\ws\\n2\\c.md")
  })
})

describe("tab operations", () => {
  it("reorders tabs and keeps the active tab", async () => {
    const { result } = await openAll()
    expect(result.current.activeFilePath).toBe("/ws/notes/d.md")

    act(() => result.current.reorderTabs(3, 0))
    expect(result.current.openFiles.map((f) => f.path)).toEqual([
      "/ws/notes/d.md",
      "/ws/a.md",
      "/ws/b.md",
      "/ws/notes/c.md",
    ])
    expect(result.current.activeFilePath).toBe("/ws/notes/d.md")
  })

  it("closes several tabs and activates the nearest survivor", async () => {
    const { result } = await openAll()
    act(() => result.current.switchTab("/ws/b.md"))

    await act(async () => {
      await result.current.closeTabs(["/ws/a.md", "/ws/b.md"])
    })
    expect(result.current.openFiles.map((f) => f.path)).toEqual(["/ws/notes/c.md", "/ws/notes/d.md"])
    expect(result.current.activeFilePath).toBe("/ws/notes/c.md")

    await act(async () => {
      await result.current.closeTabs(["/ws/notes/c.md", "/ws/notes/d.md"])
    })
    expect(result.current.openFiles).toHaveLength(0)
    expect(result.current.activeFilePath).toBeNull()
  })

  it("re-points tabs inside a moved folder instead of closing them", async () => {
    const { result } = await openAll()

    act(() => result.current.renamePath("/ws/notes", "/ws/archive/notes"))

    expect(result.current.openFiles.map((f) => f.path)).toEqual([
      "/ws/a.md",
      "/ws/b.md",
      "/ws/archive/notes/c.md",
      "/ws/archive/notes/d.md",
    ])
    expect(result.current.activeFilePath).toBe("/ws/archive/notes/d.md")
    expect(result.current.buffersRef.current.has("/ws/archive/notes/c.md")).toBe(true)
    expect(result.current.buffersRef.current.has("/ws/notes/c.md")).toBe(false)
  })

  it("keeps unsaved edits when a file is renamed", async () => {
    const { result } = await openAll()
    act(() => result.current.switchTab("/ws/a.md"))
    act(() => result.current.onChange("edited a"))

    await act(async () => {
      expect(await result.current.renameFile("/ws/a.md", "alpha.md")).toBe("/ws/alpha.md")
    })

    expect(mockInvoke).toHaveBeenCalledWith("move_node", {
      workspaceRoot: ROOT,
      source: "/ws/a.md",
      destination: "/ws/alpha.md",
    })
    const tab = result.current.openFiles.find((f) => f.path === "/ws/alpha.md")
    expect(tab?.name).toBe("alpha.md")
    expect(tab?.isDirty).toBe(true)
    expect(result.current.buffersRef.current.get("/ws/alpha.md")?.content).toBe("edited a")
  })

  it("rejects rename to a name with path separators", async () => {
    const { result } = await openAll()
    await act(async () => {
      expect(await result.current.renameFile("/ws/a.md", "../evil.md")).toBeNull()
    })
    expect(mockInvoke).not.toHaveBeenCalledWith("move_node", expect.anything())
  })

  it("does not write anything when only switching tabs", async () => {
    vi.useFakeTimers()
    try {
      const { result } = await openAll()
      mockInvoke.mockClear()
      act(() => result.current.switchTab("/ws/a.md"))
      act(() => result.current.switchTab("/ws/b.md"))
      // An echo of unchanged text (what Monaco used to emit on setValue).
      act(() => result.current.onChange("content of /ws/b.md"))
      await act(async () => {
        vi.advanceTimersByTime(3000)
      })
      const writes = mockInvoke.mock.calls.filter(
        ([cmd, args]) => cmd === "write_text_file" && !(args as { path: string }).path.endsWith("session.json")
      )
      expect(writes).toHaveLength(0)
      expect(result.current.openFiles.every((f) => !f.isDirty)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("only re-creates the tab list when a dirty flag flips", async () => {
    const { result } = await openAll()
    act(() => result.current.switchTab("/ws/a.md"))
    act(() => result.current.onChange("x"))
    const afterFirst = result.current.openFiles
    act(() => result.current.onChange("xy"))
    act(() => result.current.onChange("xyz"))
    expect(result.current.openFiles).toBe(afterFirst)
  })

  it("keeps callback identities stable across edits", async () => {
    const { result } = await openAll()
    const { switchTab, closeTab, onChange, reorderTabs } = result.current
    act(() => result.current.onChange("changed"))
    expect(result.current.switchTab).toBe(switchTab)
    expect(result.current.closeTab).toBe(closeTab)
    expect(result.current.onChange).toBe(onChange)
    expect(result.current.reorderTabs).toBe(reorderTabs)
  })
})
