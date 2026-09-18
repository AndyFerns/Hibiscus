import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { join } from "@tauri-apps/api/path"
import { createItemCommand } from "../src/features/newitem/createItemCommand"

const request = { path: "folder/note.md", type: "file" as const, openAfterCreate: false }

beforeEach(() => {
  vi.mocked(invoke).mockReset().mockResolvedValue(undefined)
  vi.mocked(join).mockReset().mockResolvedValue("/workspace/folder/note.md")
})

describe("createItemCommand", () => {
  it.each(["file", "folder"] as const)("creates a %s using the resolved path", async type => {
    expect(await createItemCommand("/workspace", { ...request, type })).toEqual({
      success: true, path: "/workspace/folder/note.md",
    })
    // workspaceRoot is forwarded so the backend can enforce containment.
    expect(invoke).toHaveBeenCalledWith("create_item", {
      workspaceRoot: "/workspace",
      path: "/workspace/folder/note.md",
      isDir: type === "folder",
    })
  })

  it("returns path resolution errors without creating an item", async () => {
    vi.mocked(join).mockRejectedValue(new Error("Path unavailable"))
    expect(await createItemCommand("/workspace", request)).toEqual({ success: false, error: "Path unavailable" })
    expect(invoke).not.toHaveBeenCalled()
  })

  it("returns backend errors", async () => {
    vi.mocked(invoke).mockRejectedValue("Permission denied")
    expect(await createItemCommand("/workspace", request)).toEqual({ success: false, error: "Permission denied" })
  })
})
