/**
 * ============================================================================
 * Workbench Layout Component
 * ============================================================================
 * 
 * The main application shell using CSS Grid for an IDE-like layout.
 * 
 * LAYOUT STRUCTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                          TOP (header)                       │
 * ├───────────────┬─────────────────────────────┬───────────────┤
 * │               │                             │               │
 * │     LEFT      │           MAIN              │     RIGHT     │
 * │   (sidebar)   │         (editor)            │  (calendar)   │
 * │               │                             │               │
 * ├───────────────┴─────────────────────────────┴───────────────┤
 * │                         BOTTOM (status)                     │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * RESIZABLE PANELS:
 * - Left and right panels are resizable via drag handles
 * - Panel widths are controlled by CSS variables
 * - Min/max constraints prevent panels from collapsing
 * 
 * FUTURE: Right panel will contain a calendar component
 * ============================================================================
 */

import { ReactNode, useState, useCallback, useRef, useEffect } from "react"
import "./Workbench.css"

/**
 * Workbench Props Interface
 */
interface WorkbenchProps {
    /** Top bar content (e.g., TopBar component) */
    top?: ReactNode
    /** Left sidebar content (e.g., TreeView for file explorer) */
    left?: ReactNode
    /** Right sidebar content (e.g., Calendar component - future) */
    right?: ReactNode
    /** Bottom bar content (e.g., status bar) */
    bottom?: ReactNode
    /** Main content area (e.g., EditorView) */
    main: ReactNode
    /** Initial width of left panel in pixels */
    leftPanelWidth?: number
    /** Initial width of right panel in pixels */
    rightPanelWidth?: number
    /** Whether right panel is visible */
    showRightPanel?: boolean
}

/**
 * Minimum and maximum panel widths (in pixels)
 */
const PANEL_CONSTRAINTS = {
    left: { min: 150, max: 500, default: 260 },
    right: { min: 200, max: 500, default: 300 },
}

export function Workbench({
    top,
    left,
    right,
    bottom,
    main,
    leftPanelWidth = PANEL_CONSTRAINTS.left.default,
    rightPanelWidth = PANEL_CONSTRAINTS.right.default,
    showRightPanel = false,
}: WorkbenchProps) {
    // Panel width state
    const [leftWidth, setLeftWidth] = useState(leftPanelWidth)
    const [rightWidth, setRightWidth] = useState(rightPanelWidth)

    // Resize state
    const [isResizingLeft, setIsResizingLeft] = useState(false)
    const [isResizingRight, setIsResizingRight] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    /**
     * Handle mouse move during resize
     */
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!containerRef.current) return

        const containerRect = containerRef.current.getBoundingClientRect()

        if (isResizingLeft) {
            const newWidth = e.clientX - containerRect.left
            const clampedWidth = Math.min(
                Math.max(newWidth, PANEL_CONSTRAINTS.left.min),
                PANEL_CONSTRAINTS.left.max
            )
            setLeftWidth(clampedWidth)
        }

        if (isResizingRight) {
            const newWidth = containerRect.right - e.clientX
            const clampedWidth = Math.min(
                Math.max(newWidth, PANEL_CONSTRAINTS.right.min),
                PANEL_CONSTRAINTS.right.max
            )
            setRightWidth(clampedWidth)
        }
    }, [isResizingLeft, isResizingRight])

    /**
     * Handle mouse up to stop resizing
     */
    const handleMouseUp = useCallback(() => {
        setIsResizingLeft(false)
        setIsResizingRight(false)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
    }, [])

    /**
     * Set up and clean up global mouse event listeners
     */
    useEffect(() => {
        if (isResizingLeft || isResizingRight) {
            document.body.style.cursor = "col-resize"
            document.body.style.userSelect = "none"
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp])

    /**
     * Start resizing left panel
     */
    const startResizeLeft = () => {
        setIsResizingLeft(true)
    }

    /**
     * Start resizing right panel
     */
    const startResizeRight = () => {
        setIsResizingRight(true)
    }

    // Compute grid template based on panel visibility
    const gridTemplateColumns = [
        left ? `${leftWidth}px` : "0",
        "1fr",
        showRightPanel && right ? `${rightWidth}px` : "0"
    ].join(" ")

    return (
        <div
            className="workbench"
            ref={containerRef}
            style={{
                "--left-panel-width": `${leftWidth}px`,
                "--right-panel-width": `${rightWidth}px`,
                gridTemplateColumns,
            } as React.CSSProperties}
        >
            {/* TOP BAR */}
            {top && (
                <header className="workbench-top">
                    {top}
                </header>
            )}

            {/* LEFT SIDEBAR */}
            {left && (
                <>
                    <aside className="panel left">
                        {left}
                    </aside>

                    {/* Left resize handle */}
                    <div
                        className={`resize-handle resize-handle-left ${isResizingLeft ? "active" : ""}`}
                        onMouseDown={startResizeLeft}
                        role="separator"
                        aria-label="Resize left panel"
                        aria-orientation="vertical"
                    />
                </>
            )}

            {/* MAIN CONTENT */}
            <main className="panel main">
                {main}
            </main>

            {/* RIGHT SIDEBAR (for future calendar) */}
            {showRightPanel && right && (
                <>
                    {/* Right resize handle */}
                    <div
                        className={`resize-handle resize-handle-right ${isResizingRight ? "active" : ""}`}
                        onMouseDown={startResizeRight}
                        role="separator"
                        aria-label="Resize right panel"
                        aria-orientation="vertical"
                    />

                    <aside className="panel right">
                        {right}
                    </aside>
                </>
            )}

            {/* BOTTOM STATUS BAR */}
            {bottom && (
                <footer className="panel bottom">
                    {bottom}
                </footer>
            )}
        </div>
    )
}

