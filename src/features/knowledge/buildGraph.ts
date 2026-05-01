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
 * ============================================================================
 */

import type { KnowledgeIndex } from "./useKnowledgeIndex"

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
  const edgeSet = new Set<string>() // dedup key: "source→target"

  // Build name→path lookup for link resolution
  const nameToPath = new Map<string, string>()
  for (const [path, note] of index.notes.entries()) {
    nameToPath.set(note.name.toLowerCase(), path)
  }

  // Create nodes from all indexed notes
  for (const [path, note] of index.notes.entries()) {
    nodes.push({ id: path, label: note.name })
  }

  // Create edges from links
  for (const [sourcePath, note] of index.notes.entries()) {
    for (const linkTarget of note.links) {
      const targetPath = nameToPath.get(linkTarget.toLowerCase())

      // Only create edge if target exists as a note (safely ignore unresolved)
      if (targetPath && targetPath !== sourcePath) {
        const edgeKey = `${sourcePath}→${targetPath}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({ source: sourcePath, target: targetPath })
        }
      }
    }
  }

  return { nodes, edges }
}
