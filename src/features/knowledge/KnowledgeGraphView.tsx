/**
 * ============================================================================
 * KnowledgeGraphView — Canvas-Based Force-Directed Graph
 * ============================================================================
 *
 * Renders the knowledge graph using HTML5 Canvas with a simple
 * force-directed layout simulation. No external graph library needed.
 *
 * FEATURES:
 * - Force simulation: repulsion between nodes, attraction along edges
 * - Interactive: click nodes to navigate, drag to reposition
 * - Auto-fits to container, responsive resize
 * - Memoized graph data via index.version
 *
 * PERFORMANCE:
 * - Simulation runs via requestAnimationFrame
 * - Stops after convergence or max iterations
 * - Canvas rendering (no DOM node per element)
 * ============================================================================
 */

import { useRef, useEffect, useCallback, useMemo, useState } from "react"
import type { GraphData } from "./buildGraph"
import "./KnowledgeGraph.css"

// =============================================================================
// TYPES
// =============================================================================

interface KnowledgeGraphViewProps {
  graph: GraphData
  onNodeClick: (path: string) => void
}

interface SimNode {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
}

// =============================================================================
// FORCE SIMULATION CONSTANTS
// =============================================================================

const REPULSION = 800
const ATTRACTION = 0.005
const DAMPING = 0.85
const CENTER_GRAVITY = 0.01
const NODE_RADIUS = 6
const MAX_TICKS = 300
const CONVERGENCE_THRESHOLD = 0.1

// =============================================================================
// COMPONENT
// =============================================================================

export function KnowledgeGraphView({ graph, onNodeClick }: KnowledgeGraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const animFrameRef = useRef<number>(0)
  const tickRef = useRef(0)
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 })

  // Build simulation nodes from graph data (memoized by graph reference)
  const simData = useMemo(() => {
    const cx = dimensions.width / 2
    const cy = dimensions.height / 2

    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      // Arrange in a circle initially for better convergence
      const angle = (2 * Math.PI * i) / Math.max(graph.nodes.length, 1)
      const radius = Math.min(dimensions.width, dimensions.height) * 0.3
      return {
        id: n.id,
        label: n.label,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 10,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 10,
        vx: 0,
        vy: 0,
      }
    })

    // Edge index map for O(1) lookup
    const nodeIndex = new Map<string, number>()
    nodes.forEach((n, i) => nodeIndex.set(n.id, i))

    const edges = graph.edges
      .map((e) => ({
        source: nodeIndex.get(e.source),
        target: nodeIndex.get(e.target),
      }))
      .filter((e) => e.source !== undefined && e.target !== undefined) as {
      source: number
      target: number
    }[]

    return { nodes, edges }
  }, [graph, dimensions])

  // Observe container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Run simulation and render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Copy sim data so we can mutate positions
    const nodes = simData.nodes.map((n) => ({ ...n }))
    const edges = simData.edges
    simNodesRef.current = nodes
    tickRef.current = 0

    const cx = dimensions.width / 2
    const cy = dimensions.height / 2

    function tick() {
      if (tickRef.current >= MAX_TICKS) return false

      let totalMovement = 0

      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const distSq = dx * dx + dy * dy + 1
          const force = REPULSION / distSq
          const fx = (dx / Math.sqrt(distSq)) * force
          const fy = (dy / Math.sqrt(distSq)) * force

          nodes[i].vx -= fx
          nodes[i].vy -= fy
          nodes[j].vx += fx
          nodes[j].vy += fy
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const a = nodes[edge.source]
        const b = nodes[edge.target]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const fx = dx * ATTRACTION
        const fy = dy * ATTRACTION

        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }

      // Center gravity + velocity update
      for (const node of nodes) {
        node.vx += (cx - node.x) * CENTER_GRAVITY
        node.vy += (cy - node.y) * CENTER_GRAVITY
        node.vx *= DAMPING
        node.vy *= DAMPING
        node.x += node.vx
        node.y += node.vy
        totalMovement += Math.abs(node.vx) + Math.abs(node.vy)
      }

      tickRef.current++
      return totalMovement > CONVERGENCE_THRESHOLD
    }

    function render() {
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1

      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      // Draw edges
      ctx.strokeStyle = "rgba(122, 162, 247, 0.25)"
      ctx.lineWidth = 1
      for (const edge of edges) {
        const a = nodes[edge.source]
        const b = nodes[edge.target]
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(122, 162, 247, 0.9)"
        ctx.fill()
        ctx.strokeStyle = "rgba(122, 162, 247, 0.5)"
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = "var(--text, #c0caf5)"
        ctx.font = "11px Inter, system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.fillStyle = "#c0caf5"
        ctx.fillText(node.label, node.x, node.y - NODE_RADIUS - 4)
      }

      ctx.restore()
    }

    function animate() {
      const running = tick()
      render()
      if (running) {
        animFrameRef.current = requestAnimationFrame(animate)
      }
    }

    // Set canvas size with DPR
    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    canvas.style.width = `${dimensions.width}px`
    canvas.style.height = `${dimensions.height}px`

    animate()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [simData, dimensions])

  // Handle click → find nearest node
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const nodes = simNodesRef.current
      let closest: SimNode | null = null
      let closestDist = Infinity

      for (const node of nodes) {
        const dx = node.x - x
        const dy = node.y - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < closestDist && dist < NODE_RADIUS * 3) {
          closest = node
          closestDist = dist
        }
      }

      if (closest) {
        onNodeClick(closest.id)
      }
    },
    [onNodeClick]
  )

  // Empty state
  if (graph.nodes.length === 0) {
    return (
      <div className="knowledge-graph-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="12" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="19" cy="18" r="2" />
          <path d="M7 12h8M15 8l-8 4M15 16l-8-4" strokeLinecap="round" />
        </svg>
        <span>No linked notes found</span>
        <span className="knowledge-graph-empty-hint">
          Use [[note name]] to link notes together
        </span>
      </div>
    )
  }

  return (
    <div className="knowledge-graph" ref={containerRef}>
      <div className="knowledge-graph-header">
        <span className="knowledge-graph-title">Knowledge Graph</span>
        <span className="knowledge-graph-count">
          {graph.nodes.length} notes · {graph.edges.length} links
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="knowledge-graph-canvas"
        onClick={handleCanvasClick}
        title="Click a node to open the note"
      />
    </div>
  )
}
