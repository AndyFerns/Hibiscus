import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { join } from "@tauri-apps/api/path"
import { useNewItemController } from "../src/features/newitem/useNewItemController"

afterEach(() => { vi.useRealTimers() })

it("shows creation errors, clears busy state, and allows a corrected submission", async () => {
  vi.useFakeTimers()
  vi.mocked(join).mockResolvedValue("/workspace/note.md")
  vi.mocked(invoke).mockRejectedValueOnce("Permission denied").mockResolvedValueOnce(undefined)
  const onCreated = vi.fn()
  const { result } = renderHook(() => useNewItemController({ workspaceRoot: "/workspace", tree: [], onCreated }))
  act(() => result.current.setInput("note.md"))
  act(() => vi.advanceTimersByTime(80))
  await act(async () => { await result.current.submit() })
  expect(result.current.state.validation).toEqual({ valid: false, message: "Permission denied" })
  expect(result.current.isCreating).toBe(false)
  expect(onCreated).not.toHaveBeenCalled()
  act(() => result.current.setInput("note.md"))
  act(() => vi.advanceTimersByTime(80))
  expect(result.current.state.validation.valid).toBe(true)
  await act(async () => { await result.current.submit() })
  expect(onCreated).toHaveBeenCalledWith("/workspace/note.md", true)
})
