/**
 * ============================================================================
 * useKnowledgeIndex Hook — Knowledge System Core
 * ============================================================================
 *
 * Maintains an in-memory index of notes in the workspace:
 * - Parses [[wiki-links]] and #tags from file content
 * - Tracks forward links and backlinks between notes
 * - Supports incremental updates (single-file re-parse on change)
 * - Version counter for memoization in consumers
 *
 * PERFORMANCE:
 * - updateNote() is O(n) of the single file's content only
 * - Backlinks are updated incrementally (remove old → add new)
 * - No full re-scan on every keystroke
 * ============================================================================
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import type { Node } from "../../types/workspace"

// =============================================================================
// TYPES
// =============================================================================

export interface IndexedNote {
  path: string
  name: string
  links: string[]   // deduplicated [[link]] targets
  tags: string[]    // deduplicated #tag values
}

export interface KnowledgeIndex {
  notes: Map<string, IndexedNote>
  backlinks: Map<string, string[]>  // target path → list of source paths
  version: number
}

// =============================================================================
// PARSING HELPERS (pure functions)
// =============================================================================

const LINK_RE = /\[\[(.*?)\]\]/g
const TAG_RE = /(^|\s)#([a-zA-Z0-9\-_]+)/g

/** Extract deduplicated [[link]] targets from content */
function parseLinks(content: string): string[] {
  const links = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = LINK_RE.exec(content)) !== null) {
    const target = match[1].trim()
    if (target) links.add(target)
  }
  return Array.from(links)
}

/** Extract deduplicated #tags from content */
function parseTags(content: string): string[] {
  const tags = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(content)) !== null) {
    tags.add(match[2])
  }
  return Array.from(tags)
}

/** Get display name from a file path */
function nameFromPath(path: string): string {
  const base = path.split(/[/\\]/).pop() || path
  // Strip common extensions for display
  return base.replace(/\.(md|txt|markdown)$/i, "")
}

// =============================================================================
// TREE FLATTENER — extract all file paths from workspace tree
// =============================================================================

function flattenFiles(nodes: Node[]): string[] {
  const paths: string[] = []

  function walk(list: Node[]) {
    for (const node of list) {
      if (node.type === "file" && node.path) {
        paths.push(node.path)
      }
      if (node.children) walk(node.children)
    }
  }

  walk(nodes)
  return paths
}

// =============================================================================
// HOOK
// =============================================================================

interface FileBuffer {
  content: string
  savedContent: string
  isDirty: boolean
}

export function useKnowledgeIndex(
  files: Node[],
  buffersRef: React.RefObject<Map<string, FileBuffer>>
) {
  // Internal index state
  const [index, setIndex] = useState<KnowledgeIndex>({
    notes: new Map(),
    backlinks: new Map(),
    version: 0,
  })

  // Guard against concurrent rebuilds
  const isRebuilding = useRef(false)

  /**
   * Parse a single file and produce an IndexedNote.
   * Content is read from buffersRef first, falls back to empty.
   */
  const parseNote = useCallback(
    (path: string, content?: string): IndexedNote => {
      // Resolve content: explicit arg > buffer > empty
      let text = content
      if (text === undefined) {
        const buf = buffersRef.current?.get(path)
        text = buf?.content ?? ""
      }

      return {
        path,
        name: nameFromPath(path),
        links: parseLinks(text),
        tags: parseTags(text),
      }
    },
    [buffersRef]
  )

  /**
   * Remove all backlink entries sourced from a specific path.
   */
  const removeBacklinksFrom = useCallback(
    (backlinks: Map<string, string[]>, sourcePath: string) => {
      for (const [target, sources] of backlinks.entries()) {
        const filtered = sources.filter((s) => s !== sourcePath)
        if (filtered.length === 0) {
          backlinks.delete(target)
        } else {
          backlinks.set(target, filtered)
        }
      }
    },
    []
  )

  /**
   * Add backlink entries for a note's links.
   * Links are resolved to paths by matching note names in the index.
   */
  const addBacklinksFrom = useCallback(
    (
      backlinks: Map<string, string[]>,
      notes: Map<string, IndexedNote>,
      sourcePath: string,
      links: string[]
    ) => {
      for (const linkTarget of links) {
        // Resolve link target to an actual note path
        // Match by name (case-insensitive) against all indexed notes
        const targetLower = linkTarget.toLowerCase()
        let resolvedPath: string | null = null

        for (const [notePath, note] of notes.entries()) {
          if (note.name.toLowerCase() === targetLower) {
            resolvedPath = notePath
            break
          }
        }

        // Use resolved path, or the raw link target as fallback
        const key = resolvedPath || linkTarget
        const existing = backlinks.get(key) || []
        if (!existing.includes(sourcePath)) {
          backlinks.set(key, [...existing, sourcePath])
        }
      }
    },
    []
  )

  /**
   * Rebuild the entire index from scratch.
   * Called on init or when workspace tree changes significantly.
   */
  const rebuildIndex = useCallback(() => {
    if (isRebuilding.current) return
    isRebuilding.current = true

    try {
      const allPaths = flattenFiles(files)
      const notes = new Map<string, IndexedNote>()
      const backlinks = new Map<string, string[]>()

      // Phase 1: parse all notes
      for (const path of allPaths) {
        const note = parseNote(path)
        notes.set(path, note)
      }

      // Phase 2: build backlinks
      for (const [sourcePath, note] of notes.entries()) {
        addBacklinksFrom(backlinks, notes, sourcePath, note.links)
      }

      setIndex({
        notes,
        backlinks,
        version: Date.now(),
      })
    } finally {
      isRebuilding.current = false
    }
  }, [files, parseNote, addBacklinksFrom])

  /**
   * Incrementally update a single note in the index.
   * O(n) of the single file's content only.
   */
  const updateNote = useCallback(
    (path: string, content: string) => {
      setIndex((prev) => {
        const notes = new Map(prev.notes)
        const backlinks = new Map(prev.backlinks)

        // Deep-copy backlink arrays that will be mutated
        for (const [key, val] of backlinks.entries()) {
          backlinks.set(key, [...val])
        }

        // Remove old backlinks from this source
        removeBacklinksFrom(backlinks, path)

        // Parse updated content
        const note = parseNote(path, content)
        notes.set(path, note)

        // Re-add backlinks with updated links
        addBacklinksFrom(backlinks, notes, path, note.links)

        return {
          notes,
          backlinks,
          version: prev.version + 1,
        }
      })
    },
    [parseNote, removeBacklinksFrom, addBacklinksFrom]
  )

  // Build initial index when files change (workspace tree updates)
  const prevFilesRef = useRef<Node[]>([])
  useEffect(() => {
    // Only rebuild if the tree reference actually changed
    if (files !== prevFilesRef.current) {
      prevFilesRef.current = files
      rebuildIndex()
    }
  }, [files, rebuildIndex])

  return useMemo(
    () => ({ index, updateNote, rebuildIndex }),
    [index, updateNote, rebuildIndex]
  )
}
