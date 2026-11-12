import { describe, expect, it } from "vitest"
import {
  canDrop,
  findNode,
  isSelfOrDescendant,
  moveNodeInTree,
  movedId,
  parentId,
  remapIds,
} from "../src/components/Tree/treeOps"
import type { Node } from "../src/types/workspace"

const tree: Node[] = [
  {
    id: "notes",
    name: "notes",
    type: "folder",
    children: [
      { id: "notes/a.md", name: "a.md", type: "file", path: "notes/a.md" },
      {
        id: "notes/deep",
        name: "deep",
        type: "folder",
        children: [{ id: "notes/deep/b.md", name: "b.md", type: "file", path: "notes/deep/b.md" }],
      },
    ],
  },
  { id: "src", name: "src", type: "folder", children: [] },
  { id: "readme.md", name: "readme.md", type: "file", path: "readme.md" },
]

describe("treeOps", () => {
  it("computes parents for both separators", () => {
    expect(parentId("notes/a.md")).toBe("notes")
    expect(parentId("notes\\deep\\b.md")).toBe("notes/deep")
    expect(parentId("readme.md")).toBe("")
  })

  it("detects self and descendants separator-agnostically", () => {
    expect(isSelfOrDescendant("notes", "notes")).toBe(true)
    expect(isSelfOrDescendant("notes", "notes\\deep\\b.md")).toBe(true)
    expect(isSelfOrDescendant("notes", "notes-old/x")).toBe(false)
  })

  it("rejects illegal and no-op drops", () => {
    expect(canDrop("notes", "notes")).toBe(false) // into itself
    expect(canDrop("notes", "notes/deep")).toBe(false) // into a descendant
    expect(canDrop("notes/a.md", "notes")).toBe(false) // already there
    expect(canDrop("readme.md", "")).toBe(false) // already at root
    expect(canDrop("notes/a.md", "src")).toBe(true)
    expect(canDrop("notes/deep", "")).toBe(true)
  })

  it("moves a file into a folder with re-ided path", () => {
    const next = moveNodeInTree(tree, "readme.md", "src")
    expect(findNode(next, "readme.md")).toBeNull()
    const moved = findNode(next, "src/readme.md")
    expect(moved?.path).toBe("src/readme.md")
    // The original tree is untouched (immutable update).
    expect(findNode(tree, "readme.md")).not.toBeNull()
  })

  it("moves a folder to the root and re-ids its children", () => {
    const next = moveNodeInTree(tree, "notes/deep", "")
    expect(findNode(next, "deep/b.md")?.path).toBe("deep/b.md")
    expect(findNode(next, "notes/deep")).toBeNull()
    // Folders sort before files at the root.
    expect(next.map((n) => n.name)).toEqual(["deep", "notes", "src", "readme.md"])
  })

  it("returns the same tree for unknown nodes", () => {
    expect(moveNodeInTree(tree, "missing.md", "src")).toBe(tree)
    expect(moveNodeInTree(tree, "readme.md", "missing")).toBe(tree)
  })

  it("remaps expanded ids under a moved folder", () => {
    const expanded = new Set(["notes", "notes/deep", "src"])
    const next = remapIds(expanded, "notes", "src/notes", "/")
    expect([...next].sort()).toEqual(["src", "src/notes", "src/notes/deep"])
    // Unaffected sets keep their identity (no re-render).
    expect(remapIds(expanded, "other", "x", "/")).toBe(expanded)
  })

  it("computes the moved id", () => {
    expect(movedId(tree, "notes/a.md", "src")).toBe("src/a.md")
    expect(movedId(tree, "notes/a.md", "")).toBe("a.md")
  })
})
