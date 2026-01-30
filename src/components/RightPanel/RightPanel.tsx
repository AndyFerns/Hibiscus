/**
 * ============================================================================
 * RightPanel Component
 * ============================================================================
 * 
 * Split panel container for the right sidebar with two resizable sections:
 * - Top: Calendar view for date tracking
 * - Bottom: Daily planner and upcoming tasks
 * 
 * FEATURES:
 * - Vertical split with draggable resize handle
 * - Collapse/expand buttons for each section (on hover)
 * - Smooth animations for section transitions
 * - Minimum height constraints to prevent over-collapse
 * 
 * LAYOUT:
 * ┌─────────────────────────┐
 * │  📅 Calendar           ▼│
 * │  (CalendarView)         │
 * ├─────────────────────────┤ ← Resize handle
 * │  📋 Planner            ▲│
 * │  (DailyPlanner)         │
 * │  (TaskList)             │
 * └─────────────────────────┘
 * ============================================================================
 */

import { useState, useCallback, useRef, useEffect, ReactNode } from "react"
import "./RightPanel.css"

/**
 * @brief Props for the RightPanel component
 */
interface RightPanelProps {
    /** Calendar section content */
    calendarContent: ReactNode
    /** Planner section content */
    plannerContent: ReactNode
    /** Callback when a linked file should be opened */
    onOpenFile?: (path: string) => void
}

/**
 * @brief Section height constraints in pixels
 */
const SECTION_CONSTRAINTS = {
    minHeight: 100,  // Minimum height for each section
    headerHeight: 36, // Height of section headers
}

/**
 * @brief RightPanel - Split container with Calendar and Planner sections
 * 
 * Provides a vertically split layout with resizable sections.
 * Each section can be collapsed/expanded via hover buttons.
 * 
 * @param props - Component props
 * @returns JSX element
 */
export function RightPanel({
    calendarContent,
    plannerContent,
}: RightPanelProps) {
    // ==========================================================================
    // STATE
    // ==========================================================================

    /** Top section height as percentage (0-100) */
    const [topHeightPercent, setTopHeightPercent] = useState(50)

    /** Whether currently dragging the resize handle */
    const [isResizing, setIsResizing] = useState(false)

    /** Whether top section is collapsed */
    const [topCollapsed, setTopCollapsed] = useState(false)

    /** Whether bottom section is collapsed */
    const [bottomCollapsed, setBottomCollapsed] = useState(false)

    /** Container ref for calculating heights */
    const containerRef = useRef<HTMLDivElement>(null)

    /** Store height before collapse for restoration */
    const heightBeforeCollapseRef = useRef(50)

    // ==========================================================================
    // RESIZE HANDLING
    // ==========================================================================

    /**
     * @brief Handle mouse move during resize drag
     */
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !containerRef.current) return

        const containerRect = containerRef.current.getBoundingClientRect()
        const containerHeight = containerRect.height

        // Calculate relative position within container
        const relativeY = e.clientY - containerRect.top

        // Convert to percentage, clamping to valid range
        // Account for header heights in min/max calculations
        const minPercent = (SECTION_CONSTRAINTS.minHeight / containerHeight) * 100
        const maxPercent = 100 - minPercent

        const newPercent = Math.min(
            Math.max((relativeY / containerHeight) * 100, minPercent),
            maxPercent
        )

        setTopHeightPercent(newPercent)
    }, [isResizing])

    /**
     * @brief Handle mouse up to stop resizing
     */
    const handleMouseUp = useCallback(() => {
        setIsResizing(false)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
    }, [])

    /**
     * @brief Set up global mouse event listeners during resize
     */
    useEffect(() => {
        if (isResizing) {
            document.body.style.cursor = "row-resize"
            document.body.style.userSelect = "none"
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [isResizing, handleMouseMove, handleMouseUp])

    /**
     * @brief Start resize drag operation
     */
    const startResize = () => {
        setIsResizing(true)
    }

    // ==========================================================================
    // COLLAPSE/EXPAND HANDLERS
    // ==========================================================================

    /**
     * @brief Toggle top section collapse state
     */
    const toggleTopCollapse = useCallback(() => {
        if (topCollapsed) {
            // Expanding: restore previous height
            setTopHeightPercent(heightBeforeCollapseRef.current)
            setTopCollapsed(false)
        } else {
            // Collapsing: save current height and minimize
            heightBeforeCollapseRef.current = topHeightPercent
            setTopHeightPercent(8) // Just enough for header
            setTopCollapsed(true)
        }
        // Ensure bottom is expanded when toggling top
        if (bottomCollapsed) setBottomCollapsed(false)
    }, [topCollapsed, topHeightPercent, bottomCollapsed])

    /**
     * @brief Toggle bottom section collapse state
     */
    const toggleBottomCollapse = useCallback(() => {
        if (bottomCollapsed) {
            // Expanding: restore previous height
            setTopHeightPercent(heightBeforeCollapseRef.current)
            setBottomCollapsed(false)
        } else {
            // Collapsing: save current height and maximize top
            heightBeforeCollapseRef.current = topHeightPercent
            setTopHeightPercent(92) // Leave just header for bottom
            setBottomCollapsed(true)
        }
        // Ensure top is expanded when toggling bottom
        if (topCollapsed) setTopCollapsed(false)
    }, [bottomCollapsed, topHeightPercent, topCollapsed])

    // ==========================================================================
    // RENDER
    // ==========================================================================

    return (
        <div
            className="right-panel"
            ref={containerRef}
        >
            {/* ----------------------------------------------------------------
       * TOP SECTION: Calendar
       * ---------------------------------------------------------------- */}
            <section
                className={`right-panel-section right-panel-top ${topCollapsed ? 'collapsed' : ''}`}
                style={{ height: `${topHeightPercent}%` }}
            >
                <header className="right-panel-section-header">
                    <span className="right-panel-section-title">
                        <span className="right-panel-section-icon">📅</span>
                        Calendar
                    </span>
                    <button
                        className="right-panel-collapse-btn"
                        onClick={toggleTopCollapse}
                        title={topCollapsed ? "Expand Calendar" : "Collapse Calendar"}
                        aria-label={topCollapsed ? "Expand Calendar" : "Collapse Calendar"}
                    >
                        {topCollapsed ? '▼' : '▲'}
                    </button>
                </header>

                {!topCollapsed && (
                    <div className="right-panel-section-content">
                        {calendarContent}
                    </div>
                )}
            </section>

            {/* ----------------------------------------------------------------
       * RESIZE HANDLE
       * ---------------------------------------------------------------- */}
            <div
                className={`right-panel-resize-handle ${isResizing ? 'active' : ''}`}
                onMouseDown={startResize}
                role="separator"
                aria-label="Resize calendar and planner sections"
                aria-orientation="horizontal"
            />

            {/* ----------------------------------------------------------------
       * BOTTOM SECTION: Planner
       * ---------------------------------------------------------------- */}
            <section
                className={`right-panel-section right-panel-bottom ${bottomCollapsed ? 'collapsed' : ''}`}
                style={{ height: `${100 - topHeightPercent}%` }}
            >
                <header className="right-panel-section-header">
                    <span className="right-panel-section-title">
                        <span className="right-panel-section-icon">📋</span>
                        Planner
                    </span>
                    <button
                        className="right-panel-collapse-btn"
                        onClick={toggleBottomCollapse}
                        title={bottomCollapsed ? "Expand Planner" : "Collapse Planner"}
                        aria-label={bottomCollapsed ? "Expand Planner" : "Collapse Planner"}
                    >
                        {bottomCollapsed ? '▲' : '▼'}
                    </button>
                </header>

                {!bottomCollapsed && (
                    <div className="right-panel-section-content">
                        {plannerContent}
                    </div>
                )}
            </section>
        </div>
    )
}
