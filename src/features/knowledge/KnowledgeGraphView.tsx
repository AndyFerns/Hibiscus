/**
 * ============================================================================
 * KnowledgeGraphView — Full-Screen Force-Directed Graph (Center Panel)
 * ============================================================================
 *
 * Visually expressive, interactive, cognitively intuitive graph visualization.
 *
 * FEATURES:
 * - Force-directed layout via react-force-graph (ForceGraph2D)
 * - Node visual system: default, hovered, active, neighbor, dimmed states
 * - Smart label system with zoom-based filtering and background pills
 * - Interaction system: hover highlighting, click-to-focus, smooth camera motion
 * - Zoom-based filtering: hide labels/edges at low zoom
 * - Focus mode: show only active node + neighbors
 * - Edge styling: highlight relevant connections
 * - Smooth camera centering with easing
 *
 * PERFORMANCE:
 * - Graph data is memoized by caller via index.version
 * - Canvas-based rendering (no DOM per node)
 * - Optimized neighbor lookups via adjacency map
 * - No expensive shadow blur per frame
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
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

interface FGLink {
  source: FGNode | string
  target: FGNode | string
}

type NodeState = "default" | "hovered" | "active" | "neighbor" | "dimmed"

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_NODE_RADIUS = 4
const MAX_NODE_RADIUS = 16
const HOVER_SCALE = 1.2
const ACTIVE_SCALE = 1.25
const NEIGHBOR_SCALE = 1.05
const DIMMED_OPACITY = 0.15
const LABEL_MIN_ZOOM = 0.4
const LABEL_FADE_START = 0.4
const LABEL_FADE_END = 0.6
const EDGE_FADE_START = 0.2
const EDGE_FADE_END = 0.4
const CAMERA_ANIMATION_DURATION = 800
const FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif"

// Easing function: easeOutCubic
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [globalScale, setGlobalScale] = useState(1)
  const animationRef = useRef<number | null>(null)

  // ===========================================================================
  // DATA PREPARATION
  // ===========================================================================

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

  // Build adjacency map for O(1) neighbor lookups
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of graph.edges) {
      if (!map.has(edge.source)) map.set(edge.source, new Set())
      if (!map.has(edge.target)) map.set(edge.target, new Set())
      map.get(edge.source)!.add(edge.target)
      map.get(edge.target)!.add(edge.source)
    }
    return map
  }, [graph])

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

  // Get effective radius with state-based scaling
  const getEffectiveRadius = useCallback(
    (node: FGNode, state: NodeState) => {
      const baseRadius = getNodeRadius(node)
      switch (state) {
        case "active":
          return baseRadius * ACTIVE_SCALE
        case "hovered":
          return baseRadius * HOVER_SCALE
        case "neighbor":
          return baseRadius * NEIGHBOR_SCALE
        default:
          return baseRadius
      }
    },
    [getNodeRadius]
  )

  // Determine node state based on current interaction context
  const getNodeState = useCallback(
    (nodeId: string): NodeState => {
      if (clickedNodeId === nodeId) return "active"
      if (hoveredNodeId === nodeId) return "hovered"

      // Check if this node is a neighbor of hovered or clicked node
      const focusId = clickedNodeId || hoveredNodeId
      if (focusId) {
        const neighbors = adjacencyMap.get(focusId)
        if (neighbors?.has(nodeId)) return "neighbor"
      }

      // In focus mode, non-neighbors are dimmed
      if (focusMode && focusId) {
        const neighbors = adjacencyMap.get(focusId)
        if (!neighbors?.has(nodeId) && nodeId !== focusId) return "dimmed"
      }

      // In hover state without focus mode, non-neighbors are slightly dimmed
      if (hoveredNodeId && !focusMode) {
        const neighbors = adjacencyMap.get(hoveredNodeId)
        if (!neighbors?.has(nodeId) && nodeId !== hoveredNodeId) return "dimmed"
      }

      return "default"
    },
    [clickedNodeId, hoveredNodeId, adjacencyMap, focusMode]
  )

  // Check if a link should be highlighted
  const getLinkState = useCallback(
    (link: FGLink): "highlighted" | "dimmed" | "default" => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id
      const targetId = typeof link.target === "string" ? link.target : link.target.id

      const focusId = clickedNodeId || hoveredNodeId
      if (!focusId) return "default"

      // Link is highlighted if connected to focus node
      if (sourceId === focusId || targetId === focusId) return "highlighted"

      // In focus mode, non-connected links are dimmed
      if (focusMode) return "dimmed"

      return "default"
    },
    [clickedNodeId, hoveredNodeId, focusMode]
  )

  // ===========================================================================
  // THEME COLORS
  // ===========================================================================

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
      accentSecondary: style.getPropertyValue("--accent-secondary").trim() || "#bb9af7",
      border: style.getPropertyValue("--border").trim() || "rgba(255,255,255,0.06)",
      panelBg: style.getPropertyValue("--panel-bg").trim() || "#131720",
      panelBgHover: style.getPropertyValue("--panel-bg-hover").trim() || "#1a1f2e",
      accentSoft: style.getPropertyValue("--accent-soft").trim() || "rgba(122, 162, 247, 0.15)",
    }
  }, [fgData]) // re-read on data change (theme may have changed)

  // ===========================================================================
  // LABEL VISIBILITY LOGIC
  // ===========================================================================

  // Determine if label should be shown for a node
  const shouldShowLabel = useCallback(
    (nodeId: string, zoom: number): boolean => {
      const state = getNodeState(nodeId)

      // Always show labels for active and hovered nodes
      if (state === "active" || state === "hovered") return true

      // Show neighbor labels when hovering
      if (hoveredNodeId && state === "neighbor") return true

      // Hide labels at low zoom levels
      if (zoom < LABEL_MIN_ZOOM) return false

      return true
    },
    [getNodeState, hoveredNodeId]
  )

  // Calculate label opacity based on zoom for smooth fade
  const getLabelOpacity = useCallback((zoom: number): number => {
    if (zoom >= LABEL_FADE_END) return 1
    if (zoom <= LABEL_FADE_START) return 0
    return (zoom - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START)
  }, [])

  // ===========================================================================
  // CAMERA MOTION
  // ===========================================================================

  // Smooth camera centering on node
  const centerOnNode = useCallback(
    (node: FGNode) => {
      if (!fgRef.current || node.x == null || node.y == null) return

      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      const startTime = performance.now()
      const startTransform = fgRef.current.getTransform()
      const targetX = node.x
      const targetY = node.y
      const targetZoom = Math.max(1.5, startTransform.k)

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / CAMERA_ANIMATION_DURATION, 1)
        const eased = easeOutCubic(progress)

        const currentX = startTransform.x + (targetX * targetZoom - startTransform.x) * eased
        const currentY = startTransform.y + (targetY * targetZoom - startTransform.y) * eased
        const currentZoom = startTransform.k + (targetZoom - startTransform.k) * eased

        fgRef.current.centerAt(currentX / currentZoom, currentY / currentZoom, currentZoom)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          animationRef.current = null
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    },
    []
  )

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  // Handle node hover
  const handleNodeHover = useCallback(
    (node: any) => {
      const nodeId = node?.id ?? null
      setHoveredNodeId(nodeId)
    },
    []
  )

  // Handle node click
  const handleNodeClick = useCallback(
    (node: any) => {
      if (node?.id) {
        const nodeId = node.id as string
        const fgNode = node as FGNode

        setClickedNodeId(nodeId)
        setFocusMode(true)
        centerOnNode(fgNode)
        onNodeClick(nodeId)
      }
    },
    [onNodeClick, centerOnNode]
  )

  // Handle background click to reset focus
  const handleBackgroundClick = useCallback(() => {
    setClickedNodeId(null)
    setFocusMode(false)
  }, [])

  // Handle zoom change
  const handleZoom = useCallback((transform: any) => {
    setGlobalScale(transform.k)
  }, [])

  // Exit focus mode
  const exitFocusMode = useCallback(() => {
    setClickedNodeId(null)
    setFocusMode(false)
  }, [])

  // ===========================================================================
  // CANVAS RENDERING
  // ===========================================================================

  // Custom node rendering on canvas
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, zoom: number) => {
      const fgNode = node as FGNode
      const state = getNodeState(fgNode.id)
      const radius = getEffectiveRadius(fgNode, state)
      const x = node.x ?? 0
      const y = node.y ?? 0

      // Determine visual properties based on state
      let fillColor = colors.accent
      let strokeColor = withAlpha(colors.accent, 0.5)
      let strokeWidth = 0.8
      let opacity = 1

      switch (state) {
        case "active":
          fillColor = colors.accentSecondary
          strokeColor = colors.accentSecondary
          strokeWidth = 2.5
          break
        case "hovered":
          fillColor = colors.accent
          strokeColor = colors.text
          strokeWidth = 1.5
          break
        case "neighbor":
          fillColor = colors.accent
          strokeColor = withAlpha(colors.accentSecondary, 0.7)
          strokeWidth = 1
          break
        case "dimmed":
          opacity = DIMMED_OPACITY
          fillColor = colors.textMuted
          strokeColor = withAlpha(colors.textMuted, 0.3)
          break
      }

      ctx.globalAlpha = opacity

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = fillColor
      ctx.fill()

      // Border ring
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.stroke()

      // Reset alpha
      ctx.globalAlpha = 1

      // Label rendering
      if (shouldShowLabel(fgNode.id, zoom)) {
        const labelOpacity = state === "active" || state === "hovered" ? 1 : getLabelOpacity(zoom)

        if (labelOpacity > 0) {
          ctx.globalAlpha = labelOpacity

          const fontSize = Math.max(11 / Math.sqrt(zoom), 8)
          ctx.font = `${state === "active" ? "600" : "500"} ${fontSize}px ${FONT_FAMILY}`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          const text = fgNode.label
          const textMetrics = ctx.measureText(text)
          const textWidth = textMetrics.width
          const textHeight = fontSize
          const paddingX = 6
          const paddingY = 3
          const labelY = y + radius + fontSize * 0.8 + 4

          // Background pill for readability
          const pillWidth = textWidth + paddingX * 2
          const pillHeight = textHeight + paddingY * 2
          const pillRadius = 4

          ctx.fillStyle = withAlpha(colors.bg, 0.85)
          ctx.beginPath()
          ctx.roundRect(
            x - pillWidth / 2,
            labelY - pillHeight / 2,
            pillWidth,
            pillHeight,
            pillRadius
          )
          ctx.fill()

          // Label text
          ctx.fillStyle = state === "active" ? colors.text : state === "dimmed" ? colors.textSubtle : colors.textMuted
          ctx.fillText(text, x, labelY)

          ctx.globalAlpha = 1
        }
      }
    },
    [colors, getNodeState, getEffectiveRadius, shouldShowLabel, getLabelOpacity]
  )

  // Link rendering
  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, zoom: number) => {
      const source = link.source as FGNode
      const target = link.target as FGNode
      if (!source || !target) return

      const state = getLinkState(link)
      const linkOpacity =
        zoom < EDGE_FADE_START ? 0 : zoom < EDGE_FADE_END ? (zoom - EDGE_FADE_START) / (EDGE_FADE_END - EDGE_FADE_START) : 1

      let strokeColor = withAlpha(colors.accent, 0.2 * linkOpacity)
      let lineWidth = 0.5

      switch (state) {
        case "highlighted":
          strokeColor = withAlpha(colors.accentSecondary, 0.6 * linkOpacity)
          lineWidth = 1.2
          break
        case "dimmed":
          strokeColor = withAlpha(colors.accent, 0.08 * linkOpacity)
          lineWidth = 0.3
          break
        default:
          strokeColor = withAlpha(colors.accent, 0.18 * linkOpacity)
          lineWidth = 0.5
      }

      ctx.beginPath()
      ctx.moveTo(source.x ?? 0, source.y ?? 0)
      ctx.lineTo(target.x ?? 0, target.y ?? 0)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = lineWidth
      ctx.stroke()
    },
    [colors, getLinkState]
  )

  // Pointer area for hit testing
  const paintPointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const fgNode = node as FGNode
      const state = getNodeState(fgNode.id)
      const radius = getEffectiveRadius(fgNode, state)
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, radius + 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    },
    [getNodeState, getEffectiveRadius]
  )

  // Node tooltip
  const getNodeLabel = useCallback(
    (node: any) => {
      const fgNode = node as FGNode
      const connections = fgNode.degree
      return `${fgNode.label} (${connections} connection${connections !== 1 ? "s" : ""})`
    },
    []
  )

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

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

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // Empty state
  if (graph.nodes.length === 0) {
    return (
      <div className="graph-view">
        <div className="graph-view-header">
          <button className="graph-view-back" onClick={onBack} title="Back to Editor">
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
          <span className="graph-view-empty-hint">Use [[note name]] syntax to create links between your notes</span>
        </div>
      </div>
    )
  }

  return (
    <div className="graph-view">
      {/* Header overlay */}
      <div className="graph-view-header">
        <button className="graph-view-back" onClick={onBack} title="Back to Editor (Ctrl+G)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
          <span>Editor</span>
        </button>
        <span className="graph-view-title">Knowledge Graph</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {focusMode && (
            <button
              className="graph-view-back"
              onClick={exitFocusMode}
              title="Exit focus mode (show full graph)"
              style={{ fontSize: "11px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M8 11h6" />
                <path d="M11 8v6" />
              </svg>
              <span>Reset View</span>
            </button>
          )}
          <span className="graph-view-stats">
            {graph.nodes.length} notes / {graph.edges.length} links
          </span>
        </div>
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
          nodePointerAreaPaint={paintPointerArea}
          nodeLabel={getNodeLabel}
          // Link rendering
          linkCanvasObject={paintLink}
          // Interactions
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          onZoom={handleZoom}
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
