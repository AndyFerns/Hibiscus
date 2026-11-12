/**
 * Pure helpers for manipulating the workspace tree on the client.
 *
 * Node ids are workspace-relative paths as produced by `build_tree`
 * (backslash-separated on Windows, forward slash elsewhere). These helpers
 * compare ids separator-agnostically.
 */

import type { Node } from "../../types/workspace"

function norm(id: string): string {
  return id.replace(/\\/g, "/").replace(/\/+$/, "")
}

/** Parent id of a node ("" for root-level nodes). */
export function parentId(id: string): string {
  const n = norm(id)
  const idx = n.lastIndexOf("/")
  return idx === -1 ? "" : n.slice(0, idx)
}

/** True when `id` is `ancestorId` itself or lives somewhere inside it. */
export function isSelfOrDescendant(ancestorId: string, id: string): boolean {
  const a = norm(ancestorId)
  const b = norm(id)
  return b === a || b.startsWith(a + "/")
}

/**
 * Whether dropping `sourceId` into folder `targetFolderId` ("" = root) is a
 * meaningful, legal move.
 */
export function canDrop(sourceId: string, targetFolderId: string): boolean {
  if (!sourceId) return false
  // A folder cannot go inside itself or its own descendants.
  if (targetFolderId && isSelfOrDescendant(sourceId, targetFolderId)) return false
  // Dropping into the folder it already lives in is a no-op.
  if (norm(parentId(sourceId)) === norm(targetFolderId)) return false
  return true
}

export function findNode(tree: Node[], id: string): Node | null {
  const target = norm(id)
  const stack = [...tree]
  while (stack.length) {
    const node = stack.pop()!
    if (norm(node.id) === target) return node
    if (node.children) stack.push(...node.children)
  }
  return null
}

export function detectSeparator(tree: Node[]): string {
  const stack = [...tree]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id.includes("\\")) return "\\"
    if (node.id.includes("/")) return "/"
    if (node.children) stack.push(...node.children)
  }
  if (typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent)) {
    return "\\"
  }
  return "/"
}

/** Re-id a subtree so every id sits under `newId`. */
function reid(node: Node, newId: string, sep: string): Node {
  const next: Node = { ...node, id: newId }
  if (node.path !== undefined) next.path = newId
  if (node.children) {
    next.children = node.children.map((c) => reid(c, `${newId}${sep}${c.name}`, sep))
  }
  return next
}

function sortNodes(nodes: Node[]): Node[] {
  return nodes.slice().sort((a, b) => {
    const af = a.type === "folder" ? 0 : 1
    const bf = b.type === "folder" ? 0 : 1
    if (af !== bf) return af - bf
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
}

/**
 * Return a new tree with `sourceId` moved into `targetFolderId` ("" = root).
 * Returns the original tree unchanged when either node is missing.
 */
export function moveNodeInTree(tree: Node[], sourceId: string, targetFolderId: string): Node[] {
  const source = findNode(tree, sourceId)
  if (!source) return tree
  if (targetFolderId && !findNode(tree, targetFolderId)) return tree

  const sep = detectSeparator(tree)
  const removeFrom = (nodes: Node[]): Node[] =>
    nodes
      .filter((n) => norm(n.id) !== norm(sourceId))
      .map((n) => (n.children ? { ...n, children: removeFrom(n.children) } : n))

  const newId = targetFolderId ? `${targetFolderId}${sep}${source.name}` : source.name
  const moved = reid(source, newId, sep)
  const without = removeFrom(tree)

  if (!targetFolderId) return sortNodes([...without, moved])

  const insert = (nodes: Node[]): Node[] =>
    nodes.map((n) => {
      if (norm(n.id) === norm(targetFolderId)) {
        return { ...n, children: sortNodes([...(n.children ?? []), moved]) }
      }
      return n.children ? { ...n, children: insert(n.children) } : n
    })
  return insert(without)
}

/** New id of `sourceId` after being moved into `targetFolderId` ("" = root). */
export function movedId(tree: Node[], sourceId: string, targetFolderId: string): string {
  const name = norm(sourceId).split("/").pop() || sourceId
  return targetFolderId ? `${targetFolderId}${detectSeparator(tree)}${name}` : name
}

/** Re-key a set of ids after `oldId` (and everything inside it) moved to `newId`. */
export function remapIds(ids: Set<string>, oldId: string, newId: string, sep: string): Set<string> {
  let changed = false
  const next = new Set<string>()
  for (const id of ids) {
    if (isSelfOrDescendant(oldId, id)) {
      const rest = norm(id).slice(norm(oldId).length).replace(/^\//, "")
      next.add(rest ? `${newId}${sep}${rest.split("/").join(sep)}` : newId)
      changed = true
    } else {
      next.add(id)
    }
  }
  return changed ? next : ids
}
