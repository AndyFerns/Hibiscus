import { beforeEach, describe, expect, it, vi } from "vitest"
import { posix, win32 } from "node:path"
import { join } from "@tauri-apps/api/path"
import { resolveWorkspacePath } from "../src/utils/workspacePath"

const nativeJoin = vi.mocked(join)

describe.each([
  { platform: "POSIX", root: "/workspace", path: posix },
  { platform: "Windows", root: "C:\\workspace", path: win32 },
])("resolveWorkspacePath on $platform", ({ root, path }) => {
  beforeEach(() => {
    nativeJoin.mockReset()
    nativeJoin.mockImplementation(async (...parts) => path.join(...parts))
  })

  it.each(["folder/note.md", "folder\\note.md", "folder\\nested/note.md"])(
    "resolves relative path %s", async relative => {
      const segments = relative.split(/[/\\]/)
      expect(await resolveWorkspacePath(root, relative)).toBe(path.join(root, ...segments))
      expect(nativeJoin).toHaveBeenCalledWith(root, ...segments)
    },
  )

  it("resolves an empty destination to the workspace root", async () => {
    expect(await resolveWorkspacePath(root, "")).toBe(root)
  })
})
