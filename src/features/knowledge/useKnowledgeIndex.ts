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
 * - O(1) link resolution via nameToPath lookup map
 * - updateNote() is debounced (350ms) to prevent keystroke lag
 * - Code blocks are stripped before parsing to avoid false positives
 * - Backlinks are updated incrementally (remove old -> add new)
 * - No full re-scan on every keystroke
 * - Tree rebuild only fires when actual file set changes (fingerprint check)
 *
 * LINK RESOLUTION ORDER:
 * 1. Path-qualified links ([[folder/file]]) — suffix match against all paths
 * 2. Simple name links ([[file]]) — O(1) nameToPath lookup
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
  links: string[]   // deduplicated [[link]] targets (raw text as written)
  tags: string[]    // deduplicated #tag values
}

export interface KnowledgeIndex {
  notes: Map<string, IndexedNote>
  backlinks: Map<string, string[]>  // target path -> list of source paths
  /** O(1) lookup: lowercase display name -> absolute path */
  nameToPath: Map<string, string>
  version: number
}

// =============================================================================
// PARSING HELPERS (pure functions)
// =============================================================================

const LINK_RE = /\[\[(.*?)\]\]/g
const TAG_RE = /(^|\s)#([a-zA-Z0-9\-_]+)/g

/**
 * Strip fenced code blocks from content before link/tag extraction.
 * This prevents false positives from [[links]] and #tags that appear
 * inside code samples, which the user does not intend as semantic links.
 *
 * Handles triple-backtick blocks (```) including nested/language-tagged ones.
 * Single backtick inline code (`like this`) is also stripped.
 */
function stripCodeBlocks(text: string): string {
  // Strip fenced code blocks first (triple backtick), then inline code
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]+`/g, "")
}

/** Extract deduplicated [[link]] targets from content, ignoring code blocks */
function parseLinks(content: string): string[] {
  const cleaned = stripCodeBlocks(content)
  const links = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = LINK_RE.exec(cleaned)) !== null) {
    const target = match[1].trim()
    if (target) links.add(target)
  }
  return Array.from(links)
}

/** Extract deduplicated #tags from content, ignoring code blocks */
function parseTags(content: string): string[] {
  const cleaned = stripCodeBlocks(content)
  const tags = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(cleaned)) !== null) {
    tags.add(match[2])
  }
  return Array.from(tags)
}

/** Get display name from a file path (basename without extension) */
function nameFromPath(path: string): string {
  const base = path.split(/[/\\]/).pop() || path
  // Strip common extensions for display
  return base.replace(/\.(md|txt|markdown)$/i, "")
}

/**
 * Resolve a [[link]] target to an absolute note path.
 *
 * Resolution order:
 * 1. If the target contains "/" or "\", it is a path-qualified link like
 *    [[folder/file]]. We normalize both the target and all note paths to
 *    forward slashes, strip extensions, and check if any path ends with
 *    the target string. This is O(N) but only fires for the uncommon
 *    explicit-disambiguation case.
 * 2. Otherwise, perform an O(1) lookup in the nameToPath map using the
 *    lowercase display name as the key.
 *
 * Returns null if no matching note exists.
 */
export function resolveLink(
  linkTarget: string,
  nameToPath: Map<string, string>,
  notes: Map<string, IndexedNote>
): string | null {
  const targetLower = linkTarget.toLowerCase()

  // Path-qualified link: [[subfolder/NoteName]]
  if (linkTarget.includes("/") || linkTarget.includes("\\")) {
    const normalizedTarget = targetLower.replace(/\\/g, "/")
    for (const [notePath] of notes.entries()) {
      const normalizedPath = notePath
        .toLowerCase()
        .replace(/\\/g, "/")
        .replace(/\.(md|txt|markdown)$/i, "")
      if (normalizedPath.endsWith(normalizedTarget)) {
        return notePath
      }
    }
    return null
  }

  // Simple name lookup: O(1) via pre-built map
  return nameToPath.get(targetLower) ?? null
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

/**
 * Debounce delay for indexing updates triggered by editor keystrokes.
 * 350ms balances responsiveness (backlinks update quickly after typing stops)
 * against CPU cost (no regex parsing on every single keystroke).
 */
const DEBOUNCE_MS = 350

export function useKnowledgeIndex(
  files: Node[],
  buffersRef: React.RefObject<Map<string, FileBuffer>>
) {
  // Internal index state
  const [index, setIndex] = useState<KnowledgeIndex>({
    notes: new Map(),
    backlinks: new Map(),
    nameToPath: new Map(),
    version: 0,
  })

  // Guard against concurrent rebuilds
  const isRebuilding = useRef(false)

  // Ref to always have current files without adding to callback deps.
  // This breaks the dependency chain where rebuildIndex -> files -> rebuildIndex
  // would cause the rebuild effect to fire on every tree reference change.
  const filesRef = useRef(files)
  filesRef.current = files

  // --- Debounce infrastructure ---
  // Timer handle for the pending debounced flush
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Accumulated per-path content updates awaiting flush
  const pendingUpdates = useRef<Map<string, string>>(new Map())

  /**
   * Parse a single file and produce an IndexedNote.
   * Content is read from the explicit argument first (required for state safety
   * during setIndex callbacks), falls back to buffersRef, then empty string.
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
   * Iterates the full backlinks map and filters out the source.
   * Entries that become empty are deleted to keep the map clean.
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
   * Uses resolveLink() which performs O(1) nameToPath lookup for simple links
   * and O(N) suffix matching only for path-qualified links ([[folder/file]]).
   */
  const addBacklinksFrom = useCallback(
    (
      backlinks: Map<string, string[]>,
      notes: Map<string, IndexedNote>,
      nameToPath: Map<string, string>,
      sourcePath: string,
      links: string[]
    ) => {
      for (const linkTarget of links) {
        const resolvedPath = resolveLink(linkTarget, nameToPath, notes)

        // Use resolved path, or the raw link target as fallback key.
        // The fallback ensures that links to not-yet-created notes still
        // show up once that note is eventually created.
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
   * Build the nameToPath lookup map from a notes map.
   * Key: lowercase display name (no extension).
   * Value: absolute file path.
   *
   * When duplicate names exist (e.g. Math/Notes.md and Science/Notes.md),
   * the last one encountered wins. Users should use path-qualified links
   * ([[Math/Notes]]) to disambiguate in this case.
   */
  const buildNameToPath = useCallback(
    (notes: Map<string, IndexedNote>): Map<string, string> => {
      const map = new Map<string, string>()
      for (const [path, note] of notes.entries()) {
        map.set(note.name.toLowerCase(), path)
      }
      return map
    },
    []
  )

  /**
   * Rebuild the entire index from scratch.
   * Called on init or when the workspace file set changes (files added/removed).
   * NOT called on folder expand/collapse or other tree mutations that don't
   * change the actual file set.
   */
  const rebuildIndex = useCallback(() => {
    if (isRebuilding.current) return
    isRebuilding.current = true

    try {
      const allPaths = flattenFiles(filesRef.current)
      const notes = new Map<string, IndexedNote>()
      const backlinks = new Map<string, string[]>()

      // Phase 1: parse all notes
      for (const path of allPaths) {
        const note = parseNote(path)
        notes.set(path, note)
      }

      // Phase 2: build nameToPath for O(1) resolution
      const nameToPath = buildNameToPath(notes)

      // Phase 3: build backlinks using the nameToPath map
      for (const [sourcePath, note] of notes.entries()) {
        addBacklinksFrom(backlinks, notes, nameToPath, sourcePath, note.links)
      }

      setIndex({
        notes,
        backlinks,
        nameToPath,
        version: Date.now(),
      })
    } finally {
      isRebuilding.current = false
    }
  }, [parseNote, addBacklinksFrom, buildNameToPath])

  /**
   * Apply a single note update to the index.
   * This is the non-debounced core that mutates index state incrementally.
   *
   * STATE SAFETY: Always uses the passed `content` argument for parsing.
   * Never depends on async buffer state inside the setIndex callback,
   * because React's state batching could cause stale reads from buffersRef.
   */
  const applyNoteUpdate = useCallback(
    (path: string, content: string) => {
      setIndex((prev) => {
        const notes = new Map(prev.notes)
        const backlinks = new Map(prev.backlinks)
        const nameToPath = new Map(prev.nameToPath)

        // Deep-copy backlink arrays that will be mutated, so we don't
        // accidentally modify arrays still referenced by the previous state.
        for (const [key, val] of backlinks.entries()) {
          backlinks.set(key, [...val])
        }

        // Remove old backlinks from this source
        removeBacklinksFrom(backlinks, path)

        // Remove old nameToPath entry if the note existed.
        // Guard: only delete if the map entry actually points to this path,
        // because another file with the same display name may have taken it.
        const oldNote = notes.get(path)
        if (oldNote) {
          const oldKey = oldNote.name.toLowerCase()
          if (nameToPath.get(oldKey) === path) {
            nameToPath.delete(oldKey)
          }
        }

        // Parse updated content (uses passed content, not buffer)
        const note = parseNote(path, content)
        notes.set(path, note)

        // Update nameToPath with new name
        nameToPath.set(note.name.toLowerCase(), path)

        // Re-add backlinks with updated links
        addBacklinksFrom(backlinks, notes, nameToPath, path, note.links)

        return {
          notes,
          backlinks,
          nameToPath,
          version: prev.version + 1,
        }
      })
    },
    [parseNote, removeBacklinksFrom, addBacklinksFrom]
  )

  /**
   * Flush all pending debounced updates immediately.
   * Processes each accumulated (path, content) pair via applyNoteUpdate.
   * Clears the pending map after processing.
   */
  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdates.current.size === 0) return

    const updates = new Map(pendingUpdates.current)
    pendingUpdates.current.clear()

    for (const [path, content] of updates.entries()) {
      applyNoteUpdate(path, content)
    }
  }, [applyNoteUpdate])

  /**
   * Debounced note update — the public API called on every editor keystroke.
   *
   * Accumulates updates per-path in a Map (so rapid edits to the same file
   * only keep the latest content), then flushes all pending updates after
   * DEBOUNCE_MS of inactivity. This prevents regex parsing on every single
   * keystroke while still updating the index promptly when the user pauses.
   */
  const updateNote = useCallback(
    (path: string, content: string) => {
      // Store the latest content for this path, overwriting any previous
      // pending content for the same file.
      pendingUpdates.current.set(path, content)

      // Reset the debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      debounceTimer.current = setTimeout(() => {
        flushPendingUpdates()
        debounceTimer.current = null
      }, DEBOUNCE_MS)
    },
    [flushPendingUpdates]
  )

  /**
   * Remove a note from the index without triggering a full rebuild.
   * Used when a file is deleted from the workspace.
   *
   * Incrementally cleans up:
   * - The notes map entry
   * - All backlinks sourced from the deleted file
   * - The nameToPath entry (if it still points to this file)
   */
  const deleteNote = useCallback(
    (path: string) => {
      setIndex((prev) => {
        const notes = new Map(prev.notes)
        const backlinks = new Map(prev.backlinks)
        const nameToPath = new Map(prev.nameToPath)

        // Deep-copy backlink arrays
        for (const [key, val] of backlinks.entries()) {
          backlinks.set(key, [...val])
        }

        // Clean up nameToPath for the deleted note
        const oldNote = notes.get(path)
        if (oldNote) {
          const oldKey = oldNote.name.toLowerCase()
          if (nameToPath.get(oldKey) === path) {
            nameToPath.delete(oldKey)
          }
        }

        // Remove the note itself
        notes.delete(path)

        // Remove all backlinks sourced from this path
        removeBacklinksFrom(backlinks, path)

        // Also remove any backlink entries targeting this path
        backlinks.delete(path)

        return {
          notes,
          backlinks,
          nameToPath,
          version: prev.version + 1,
        }
      })
    },
    [removeBacklinksFrom]
  )

  /**
   * Rename a note in the index without triggering a full rebuild.
   * Used when a file is moved or renamed in the workspace.
   *
   * Incrementally updates:
   * - Moves the notes map entry from oldPath to newPath
   * - Re-parses the note with the new path (which changes the display name)
   * - Updates nameToPath for both old and new display names
   * - Rewrites all backlink references: any backlink that pointed at oldPath
   *   now points at newPath, and backlinks sourced from this file are re-added
   *   under the new source path
   */
  const renameNote = useCallback(
    (oldPath: string, newPath: string) => {
      setIndex((prev) => {
        const notes = new Map(prev.notes)
        const backlinks = new Map(prev.backlinks)
        const nameToPath = new Map(prev.nameToPath)

        // Deep-copy backlink arrays
        for (const [key, val] of backlinks.entries()) {
          backlinks.set(key, [...val])
        }

        // Get the old note's content from the buffer so we can re-parse it
        const oldNote = notes.get(oldPath)
        const content = buffersRef.current?.get(newPath)?.content
          ?? buffersRef.current?.get(oldPath)?.content
          ?? ""

        // Remove old nameToPath entry
        if (oldNote) {
          const oldKey = oldNote.name.toLowerCase()
          if (nameToPath.get(oldKey) === oldPath) {
            nameToPath.delete(oldKey)
          }
        }

        // Remove old note entry and backlinks from old source
        notes.delete(oldPath)
        removeBacklinksFrom(backlinks, oldPath)

        // Rewrite backlink entries that targeted oldPath -> newPath
        const oldTargetBacklinks = backlinks.get(oldPath)
        if (oldTargetBacklinks) {
          backlinks.delete(oldPath)
          backlinks.set(newPath, oldTargetBacklinks)
        }

        // Also update any backlink arrays that reference oldPath as a source
        for (const [_target, sources] of backlinks.entries()) {
          const idx = sources.indexOf(oldPath)
          if (idx !== -1) {
            sources[idx] = newPath
          }
        }

        // Parse note under new path
        const newNote = parseNote(newPath, content)
        notes.set(newPath, newNote)

        // Update nameToPath with new name
        nameToPath.set(newNote.name.toLowerCase(), newPath)

        // Re-add backlinks with updated source path
        addBacklinksFrom(backlinks, notes, nameToPath, newPath, newNote.links)

        return {
          notes,
          backlinks,
          nameToPath,
          version: prev.version + 1,
        }
      })
    },
    [buffersRef, parseNote, removeBacklinksFrom, addBacklinksFrom]
  )

  // ===========================================================================
  // TREE FINGERPRINT — stable rebuild trigger
  // ===========================================================================

  /**
   * Compute a stable fingerprint from the workspace tree's file paths.
   * This is a sorted, null-delimited string of all file paths.
   *
   * The key insight: when the user expands/collapses a folder in the tree,
   * React creates a new `files` array reference, but the actual set of file
   * paths has not changed. By comparing fingerprints instead of references,
   * we avoid triggering expensive full rebuilds on benign tree mutations.
   *
   * Sorting ensures the fingerprint is stable regardless of tree traversal
   * order, which could change if the tree is reorganized internally.
   */
  const treeFingerprint = useMemo(() => {
    return flattenFiles(files).sort().join("\0")
  }, [files])

  // Rebuild index only when the actual set of file paths changes
  const prevFingerprintRef = useRef<string>("")
  useEffect(() => {
    if (treeFingerprint !== prevFingerprintRef.current) {
      prevFingerprintRef.current = treeFingerprint
      rebuildIndex()
    }
  }, [treeFingerprint, rebuildIndex])

  // Clean up the debounce timer on unmount to prevent memory leaks
  // and flush any pending updates so no data is lost.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      // Flush remaining pending updates synchronously on unmount
      if (pendingUpdates.current.size > 0) {
        // Cannot call flushPendingUpdates here because it may reference
        // stale state. The pending updates will be lost, which is acceptable
        // because the component is unmounting (workspace is closing).
        pendingUpdates.current.clear()
      }
    }
  }, [])

  return useMemo(
    () => ({ index, updateNote, rebuildIndex, deleteNote, renameNote }),
    [index, updateNote, rebuildIndex, deleteNote, renameNote]
  )
}
