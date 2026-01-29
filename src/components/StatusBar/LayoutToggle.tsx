/**
 * ============================================================================
 * LayoutToggle Component
 * ============================================================================
 * 
 * A compact button that expands on hover to show panel visibility toggles.
 * Used in the status bar for quick layout adjustments.
 * 
 * DESIGN:
 * - Shows a layout icon by default
 * - Expands on hover to reveal toggle buttons for each panel
 * - Smooth animation for expansion/collapse
 * 
 * PANELS:
 * - Left panel (Explorer/File Tree)
 * - Right panel (Calendar/Study Planning)
 * ============================================================================
 */

import "./LayoutToggle.css"

/**
 * LayoutToggle Props Interface
 */
interface LayoutToggleProps {
    /** Whether left panel is visible */
    showLeftPanel: boolean
    /** Whether right panel is visible */
    showRightPanel: boolean
    /** Callback to toggle left panel */
    onToggleLeftPanel: () => void
    /** Callback to toggle right panel */
    onToggleRightPanel: () => void
}

export function LayoutToggle({
    showLeftPanel,
    showRightPanel,
    onToggleLeftPanel,
    onToggleRightPanel,
}: LayoutToggleProps) {
    return (
        <div className="layout-toggle">
            {/* Main layout icon */}
            <span className="layout-toggle-icon" title="Layout">
                ⊞
            </span>

            {/* Expandable panel with toggle buttons */}
            <div className="layout-toggle-panel">
                {/* Left Panel Toggle */}
                <button
                    className={`layout-toggle-btn ${showLeftPanel ? "active" : ""}`}
                    onClick={onToggleLeftPanel}
                    title={showLeftPanel ? "Hide Explorer" : "Show Explorer"}
                    aria-label={showLeftPanel ? "Hide Explorer" : "Show Explorer"}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                        {/* Left panel icon - sidebar on left */}
                        <rect x="1" y="1" width="4" height="12" fill={showLeftPanel ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />
                        <rect x="6" y="1" width="7" height="12" fill="none" stroke="currentColor" strokeWidth="1" />
                    </svg>
                </button>

                {/* Main Only - Collapse both panels */}
                <button
                    className={`layout-toggle-btn ${!showLeftPanel && !showRightPanel ? "active" : ""}`}
                    onClick={() => {
                        if (showLeftPanel) onToggleLeftPanel()
                        if (showRightPanel) onToggleRightPanel()
                    }}
                    title="Main panel only"
                    aria-label="Show main panel only"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                        {/* Centered main panel icon */}
                        <rect x="2" y="1" width="10" height="12" fill="none" stroke="currentColor" strokeWidth="1" />
                    </svg>
                </button>

                {/* Right Panel Toggle */}
                <button
                    className={`layout-toggle-btn ${showRightPanel ? "active" : ""}`}
                    onClick={onToggleRightPanel}
                    title={showRightPanel ? "Hide Calendar" : "Show Calendar"}
                    aria-label={showRightPanel ? "Hide Calendar" : "Show Calendar"}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14">
                        {/* Right panel icon - sidebar on right */}
                        <rect x="1" y="1" width="7" height="12" fill="none" stroke="currentColor" strokeWidth="1" />
                        <rect x="9" y="1" width="4" height="12" fill={showRightPanel ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
