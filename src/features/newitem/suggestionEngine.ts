// ============================================================================
// Suggestion Engine
// ============================================================================
//
// Generates ranked autocomplete suggestions from the in-memory workspace tree.
//
// CONSTRAINTS:
// - In-memory only. No disk access.
// - O(n) within the current directory scope.
// - Memoized: result is cached by (inputKey, treeVersion) pair.
//
// RANKING:
// - Prefix match: highest score (1.0 base).
// - Contains match: medium score (0.5 base).
// - Recent usage: +0.3 boost.
// - Directory proximity: items in the same parent directory get +0.2 boost.
//
// The engine operates on a flat list of { path, type } entries derived
// from the workspace Node tree (see flattenTree in types.ts).
// ============================================================================

import { Suggestion, ParsedPath } from "./types"

interface FlatEntry {
  path: string
  type: "file" | "folder"
}

/** Maximum number of suggestions to return. */
const MAX_SUGGESTIONS = 8

/** Cache for memoization. Only the last result is stored (single-entry). */
let cache: {
  key: string
  version: number
  result: Suggestion[]
} | null = null

/**
 * Generate ranked suggestions for a parsed path input.
 *
 * @param parsed     - The parsed input from the input engine.
 * @param flatEntries - Flattened workspace tree entries.
 * @param recentItems - List of recently accessed relative paths.
 * @param treeVersion - A monotonic counter that increments when the tree changes.
 *                      Used for cache invalidation.
 */
export function generateSuggestions(
  parsed: ParsedPath,
  flatEntries: FlatEntry[],
  recentItems: string[],
  treeVersion: number
): Suggestion[] {
  // Nothing to suggest for empty input.
  if (!parsed.name) return []

  // Build cache key from the raw segments.
  const cacheKey = parsed.segments.join("/")
  if (cache && cache.key === cacheKey && cache.version === treeVersion) {
    return cache.result
  }

  const query = parsed.name.toLowerCase()
  const parentDir = parsed.parentDir.toLowerCase()
  const recentSet = new Set(recentItems.map(r => r.toLowerCase()))

  const scored: Suggestion[] = []

  for (const entry of flatEntries) {
    const entryName = entry.path.split("/").pop() || ""
    const entryNameLower = entryName.toLowerCase()
    const entryParent = entry.path.toLowerCase().split("/").slice(0, -1).join("/")

    // Score: prefix match is strongest, then contains, else skip.
    let score = 0
    if (entryNameLower.startsWith(query)) {
      score = 1.0
    } else if (entryNameLower.includes(query)) {
      score = 0.5
    } else {
      continue
    }

    // Proximity boost: items in the same parent directory.
    if (parentDir && entryParent === parentDir) {
      score += 0.2
    }

    // Recency boost.
    if (recentSet.has(entry.path.toLowerCase())) {
      score += 0.3
    }

    scored.push({
      label: entry.path,
      type: entry.type,
      score,
    })
  }

  // Sort descending by score, then alphabetically for stability.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.label.localeCompare(b.label)
  })

  const result = scored.slice(0, MAX_SUGGESTIONS)

  // Memoize.
  cache = { key: cacheKey, version: treeVersion, result }

  return result
}

/**
 * Invalidate the suggestion cache.
 * Called when the workspace tree changes.
 */
export function invalidateSuggestionCache(): void {
  cache = null
}
