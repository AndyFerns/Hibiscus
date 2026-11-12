/**
 * ============================================================================
 * Editor Model Registry
 * ============================================================================
 *
 * One Monaco text model per open file, keyed by absolute path.
 *
 * Why this exists:
 * The editor used to own a single model and call `model.setValue()` on every
 * tab switch. That re-tokenized the whole file, wiped undo history and view
 * state, and fired a content-change event that scheduled a pointless autosave
 * (which then bounced through the file watcher and rebuilt the tree).
 *
 * With one model per file, switching tabs is just `editor.setModel()` plus a
 * view-state restore: O(1), no re-tokenization, undo history preserved.
 *
 * This module deliberately does NOT import monaco-editor. The editor
 * controller hook calls into it (release / rename / sync / flush), and keeping
 * it Monaco-free means that hook stays testable in jsdom.
 * ============================================================================
 */

/** Minimal structural view of a Monaco ITextModel used by the registry. */
export interface TextModelLike {
  getValue(): string
  setValue(value: string): void
  dispose(): void
  isDisposed(): boolean
}

export interface ModelEntry {
  model: TextModelLike
  /** Saved `editor.saveViewState()` result (cursor, scroll, folding). */
  viewState: unknown
}

const entries = new Map<string, ModelEntry>()

/** >0 while the registry is applying a programmatic (non-user) edit. */
let suppressDepth = 0

/** Flushes the editor's pending debounced change, if any. Set by EditorView. */
let flushHook: (() => void) | null = null

/** Normalizes a path for prefix comparison (Windows separators, case kept). */
function norm(p: string): string {
  return p.replace(/\\/g, "/")
}

/**
 * Compute the new location of `path` after `oldPrefix` was moved to
 * `newPrefix`. Returns null when `path` is not inside `oldPrefix`.
 * Works for both a single file (exact match) and a folder (prefix match).
 */
export function remapPath(path: string, oldPrefix: string, newPrefix: string): string | null {
  const p = norm(path)
  const o = norm(oldPrefix).replace(/\/+$/, "")
  if (p === o) return newPrefix
  if (p.startsWith(o + "/")) {
    const sep = newPrefix.includes("\\") ? "\\" : "/"
    const rest = path.slice(oldPrefix.replace(/[\\/]+$/, "").length + 1)
    return newPrefix.replace(/[\\/]+$/, "") + sep + rest.replace(/[\\/]/g, sep)
  }
  return null
}

export const editorModels = {
  get(path: string): ModelEntry | undefined {
    const entry = entries.get(path)
    if (entry && entry.model.isDisposed()) {
      entries.delete(path)
      return undefined
    }
    return entry
  },

  set(path: string, entry: ModelEntry): void {
    entries.set(path, entry)
  },

  has(path: string): boolean {
    return this.get(path) !== undefined
  },

  /** Dispose and forget the model for a closed file. */
  release(path: string): void {
    const entry = entries.get(path)
    if (entry) {
      if (!entry.model.isDisposed()) entry.model.dispose()
      entries.delete(path)
    }
  },

  /**
   * Re-key models after a file or folder move/rename so open tabs keep their
   * undo history and view state. Models are created without URIs, so only
   * the map key has to change.
   */
  rename(oldPrefix: string, newPrefix: string): void {
    const moves: [string, string][] = []
    for (const key of entries.keys()) {
      const next = remapPath(key, oldPrefix, newPrefix)
      if (next) moves.push([key, next])
    }
    for (const [from, to] of moves) {
      const entry = entries.get(from)!
      entries.delete(from)
      entries.set(to, entry)
    }
  },

  /**
   * Replace a model's text after an external change on disk. Runs with change
   * events suppressed so the editor does not echo it back as a user edit.
   */
  syncContent(path: string, content: string): void {
    const entry = this.get(path)
    if (!entry) return
    if (entry.model.getValue() === content) return
    this.withSuppressed(() => entry.model.setValue(content))
  },

  withSuppressed<T>(fn: () => T): T {
    suppressDepth++
    try {
      return fn()
    } finally {
      suppressDepth--
    }
  },

  isSuppressed(): boolean {
    return suppressDepth > 0
  },

  /** Registered by EditorView so saves/closes can flush pending edits first. */
  setFlushHook(fn: (() => void) | null): void {
    flushHook = fn
  },

  /** Push any debounced editor change into the controller immediately. */
  flush(): void {
    flushHook?.()
  },

  clear(): void {
    for (const entry of entries.values()) {
      if (!entry.model.isDisposed()) entry.model.dispose()
    }
    entries.clear()
  },

  /** Test helper. */
  size(): number {
    return entries.size
  },
}
