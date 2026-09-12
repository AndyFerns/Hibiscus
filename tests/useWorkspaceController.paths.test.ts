import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { posix, win32 } from "node:path"
import { invoke } from "@tauri-apps/api/core"
import { join } from "@tauri-apps/api/path"
import { useWorkspaceController } from "../src/hooks/useWorkspaceController"

vi.mock("../src/hooks/discoverWorkspace", () => ({ discoverWorkspace: async () => ({ found: false }) }))
vi.mock("../src/hooks/useWorkspacePersistence", () => ({ persistWorkspace: vi.fn() }))
vi.mock("../src/hooks/useWorkspaceRoot", () => ({ getLastWorkspaceRoot: () => null, pickWorkspaceRoot: vi.fn() }))
vi.mock("../src/hooks/useRecentFiles", () => ({ useRecentFiles: () => ({ addRecentFile: vi.fn(), addRecentFolder: vi.fn(), recentFiles: [], recentFolders: [] }) }))

describe.each([
  { platform: "POSIX", root: "/workspace", path: posix },
  { platform: "Windows", root: "C:\\workspace", path: win32 },
])("workspace operations on $platform", ({ root, path }) => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset().mockResolvedValue([])
    vi.mocked(join).mockReset().mockImplementation(async (...parts) => path.join(...parts))
  })

  it.each(["createFile", "createFolder"] as const)("%s resolves nested paths", async operation => {
    const { result } = renderHook(() => useWorkspaceController())
    await act(async () => { await result.current.loadWorkspace(root) })
    vi.mocked(invoke).mockClear()
    await act(async () => {
      expect(await result.current[operation]("folder\\item")).toBe(true)
    })
    expect(invoke).toHaveBeenCalledWith(operation === "createFile" ? "create_file" : "create_folder", { path: path.join(root, "folder", "item") })
    expect(invoke).toHaveBeenCalledWith("build_tree", { root })
  })

  it.each(["", "target\\nested"])("moves a node into destination '%s'", async destination => {
    const { result } = renderHook(() => useWorkspaceController())
    await act(async () => { await result.current.loadWorkspace(root) })
    vi.mocked(invoke).mockClear()
    await act(async () => { expect(await result.current.moveNode("source\\item", destination)).toBe(true) })
    expect(invoke).toHaveBeenCalledWith("move_node", {
      source: path.join(root, "source", "item"),
      destination: path.join(root, ...destination.split("\\"), "item"),
    })
    expect(invoke).toHaveBeenCalledWith("build_tree", { root })
  })
})
