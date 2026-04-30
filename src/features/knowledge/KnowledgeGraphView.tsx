/**
 * ============================================================================
 * KnowledgeGraphView — Full-Screen Force-Directed Graph (Center Panel)
 * ============================================================================
 *
 * Renders the knowledge graph using react-force-graph (2D) as a center panel
 * view that replaces the editor. Uses the existing theme system for styling.
 *
 * FEATURES:
 * - Force-directed layout via react-force-graph (ForceGraph2D)
 * - Zoom, pan, and node dragging out of the box
 * - Node size proportional to connection degree
 * - Active file node highlighted with distinct color
 * - Click node to open file in editor
 * - Back button to return to editor view
 * - Header bar with stats
 *
 * PERFORMANCE:
 * - Graph data is memoized by caller via index.version
 * - Canvas-based rendering (no DOM per node)
 * ============================================================================
 */

import { useRef, useEffect, useCallback, useMemo, useState } from "react"
import ForceGraph2D from "react-force-graph-2d"
import type { GraphData, GraphNode } from "./buildGraph"
import "./KnowledgeGraph.css"

// =============================================================================
// TYPES
// =============================================================================

interface KnowledgeGraphViewProps {
  graph: GraphData
  activeFilePath: string | null
  onNodeClick: (path: string) => void
  onBack: () => void
}

// Internal node shape for ForceGraph2D (extends GraphNode with layout fields)
interface FGNode extends GraphNode {
  x?: number
  y?: number
  degree: number
}

interface FGLink {
  source: string
  target: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_NODE_RADIUS = 4
const MAX_NODE_RADIUS = 14
const LABEL_FONT = "11px Inter, system-ui, sans-serif"

// =============================================================================
// COMPONENT
// =============================================================================

export function KnowledgeGraphView({
  graph,
  activeFilePath,
  onNodeClick,
  onBack,
}: KnowledgeGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Compute degree map for node sizing
  const degreeMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of graph.edges) {
      map.set(edge.source, (map.get(edge.source) || 0) + 1)
      map.set(edge.target, (map.get(edge.target) || 0) + 1)
    }
    return map
  }, [graph])

  // Max degree for normalization
  const maxDegree = useMemo(() => {
    let max = 1
    for (const d of degreeMap.values()) {
      if (d > max) max = d
    }
    return max
  }, [degreeMap])

  // Build ForceGraph2D-compatible data
  const fgData = useMemo(() => {
    const nodes: FGNode[] = graph.nodes.map((n) => ({
      ...n,
      degree: degreeMap.get(n.id) || 0,
    }))

    const links: FGLink[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
    }))

    return { nodes, links }
  }, [graph, degreeMap])

  // Node radius based on degree
  const getNodeRadius = useCallback(
    (node: FGNode) => {
      const t = maxDegree > 1 ? node.degree / maxDegree : 0
      return MIN_NODE_RADIUS + t * (MAX_NODE_RADIUS - MIN_NODE_RADIUS)
    },
    [maxDegree]
  )

  // Observe container size for responsive graph
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Center graph on mount / data change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 60)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [fgData])

  // Resolve theme colors from CSS variables at render time
  const colors = useMemo(() => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    return {
      bg: style.getPropertyValue("--editor-bg").trim() || "#0a0d12",
      text: style.getPropertyValue("--text").trim() || "#e6e6eb",
      textMuted: style.getPropertyValue("--text-muted").trim() || "#8b92a8",
      textSubtle: style.getPropertyValue("--text-subtle").trim() || "#5c6370",
      accent: style.getPropertyValue("--accent").trim() || "#7aa2f7",
      accentSecondary:
        style.getPropertyValue("--accent-secondary").trim() || "#bb9af7",
      border: style.getPropertyValue("--border").trim() || "rgba(255,255,255,0.06)",
      panelBg: style.getPropertyValue("--panel-bg").trim() || "#131720",
      panelBgHover:
        style.getPropertyValue("--panel-bg-hover").trim() || "#1a1f2e",
    }
  }, [fgData]) // re-read on data change (theme may have changed)

  // Custom node rendering on canvas
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const fgNode = node as FGNode
      const radius = getNodeRadius(fgNode)
      const isActive = fgNode.id === activeFilePath
      const x = node.x ?? 0
      const y = node.y ?? 0

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)

      if (isActive) {
        // Active node: brighter accent with glow
        ctx.fillStyle = colors.accentSecondary
        ctx.shadowColor = colors.accentSecondary
        ctx.shadowBlur = 8
      } else {
        ctx.fillStyle = colors.accent
        ctx.shadowBlur = 0
      }
      ctx.fill()
      ctx.shadowBlur = 0

      // Border ring
      ctx.strokeStyle = isActive
        ? colors.accentSecondary
        : `${colors.accent}88`
      ctx.lineWidth = isActive ? 1.5 : 0.8
      ctx.stroke()

      // Label (only show when zoomed in enough)
      if (globalScale > 0.6) {
        const fontSize = Math.max(10 / globalScale, 3)
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillStyle = isActive ? colors.text : colors.textMuted
        ctx.fillText(fgNode.label, x, y + radius + 2)
      }
    },
    [getNodeRadius, activeFilePath, colors]
  )

  // Link rendering
  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      const source = link.source
      const target = link.target
      if (!source || !target) return

      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)
      ctx.strokeStyle = `${colors.accent}30`
      ctx.lineWidth = 0.6
      ctx.stroke()
    },
    [colors]
  )

  // Handle node click — open file and switch to editor
  const handleNodeClick = useCallback(
    (node: any) => {
      if (node?.id) {
        onNodeClick(node.id as string)
      }
    },
    [onNodeClick]
  )

  // Node tooltip
  const getNodeLabel = useCallback((node: any) => {
    const fgNode = node as FGNode
    const connections = fgNode.degree
    return `${fgNode.label} (${connections} connection${connections !== 1 ? "s" : ""})`
  }, [])

  // Empty state
  if (graph.nodes.length === 0) {
    return (
      <div className="graph-view">
        <div className="graph-view-header">
          <button
            className="graph-view-back"
            onClick={onBack}
            title="Back to Editor"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8L10 4" />
            </svg>
            <span>Editor</span>
          </button>
          <span className="graph-view-title">Knowledge Graph</span>
          <span className="graph-view-stats" />
        </div>
        <div className="graph-view-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="18" cy="18" r="2.5" />
            <path d="M8.5 11L15.5 7M8.5 13L15.5 17" />
          </svg>
          <span className="graph-view-empty-title">No linked notes</span>
          <span className="graph-view-empty-hint">
            Use [[note name]] syntax to create links between your notes
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="graph-view">
      {/* Header overlay */}
      <div className="graph-view-header">
        <button
          className="graph-view-back"
          onClick={onBack}
          title="Back to Editor (Ctrl+G)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
          <span>Editor</span>
        </button>
        <span className="graph-view-title">Knowledge Graph</span>
        <span className="graph-view-stats">
          {graph.nodes.length} notes / {graph.edges.length} links
        </span>
      </div>

      {/* Graph canvas container */}
      <div className="graph-view-canvas" ref={containerRef}>
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={fgData}
          // Node rendering
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const radius = getNodeRadius(node as FGNode)
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, radius + 2, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.fill()
          }}
          nodeLabel={getNodeLabel}
          // Link rendering
          linkCanvasObject={paintLink}
          // Interactions
          onNodeClick={handleNodeClick}
          // Layout
          backgroundColor={colors.bg}
          // Physics tuning
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={50}
          cooldownTicks={200}
          // Enable zoom/pan
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={true}
        />
      </div>
    </div>
  )
}
