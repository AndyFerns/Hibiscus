/**
 * ============================================================================
 * buildGraph — Knowledge Graph Builder
 * ============================================================================
 *
 * Converts a KnowledgeIndex into a renderable graph structure.
 * - Nodes = all indexed notes
 * - Edges = resolved [[links]] between notes
 * - Unresolved links are safely ignored (no crash)
 * - Duplicate edges are deduplicated
 *
 * Uses the pre-built nameToPath map from KnowledgeIndex for O(1) link
 * resolution instead of building a redundant lookup on every call.
 * Path-qualified links ([[folder/file]]) fall back to suffix matching
 * via the shared resolveLink() helper.
 * ============================================================================
 */

import type { KnowledgeIndex } from "./useKnowledgeIndex"
import { resolveLink } from "./useKnowledgeIndex"

// =============================================================================
// TYPES
// =============================================================================

export interface GraphNode {
  id: string
  label: string
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// =============================================================================
// BUILDER
// =============================================================================

export function buildGraph(index: KnowledgeIndex): GraphData {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>() // dedup key: "source->target"

  // Create nodes from all indexed notes
  for (const [path, note] of index.notes.entries()) {
    nodes.push({ id: path, label: note.name })
  }

  // Create edges from links, using the index's nameToPath for O(1) resolution.
  // resolveLink handles both simple name lookups and path-qualified links.
  for (const [sourcePath, note] of index.notes.entries()) {
    for (const linkTarget of note.links) {
      const targetPath = resolveLink(linkTarget, index.nameToPath, index.notes)

      // Only create edge if target exists as a note (safely ignore unresolved)
      if (targetPath && targetPath !== sourcePath) {
        const edgeKey = `${sourcePath}\u2192${targetPath}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({ source: sourcePath, target: targetPath })
        }
      }
    }
  }

  return { nodes, edges }
}
