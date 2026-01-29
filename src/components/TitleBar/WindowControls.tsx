/**
 * ============================================================================
 * WindowControls Component
 * ============================================================================
 * 
 * Cross-platform window control buttons for custom titlebar.
 * Provides minimize, maximize/restore, and close functionality.
 * 
 * CROSS-PLATFORM:
 * - Uses Tauri's window API which works on Windows, macOS, and Linux
 * - Styling matches the native platform conventions
 * 
 * PERFORMANCE:
 * - Uses direct Tauri API calls for instant response
 * - No intermediate state management for button actions
 * ============================================================================
 */

import { getCurrentWindow } from "@tauri-apps/api/window"
import { useState, useEffect } from "react"
import "./WindowControls.css"

/**
 * Get the current Tauri window instance
 * This is cached and reused for all window operations
 */
const appWindow = getCurrentWindow()

/**
 * WindowControls Props Interface
 */
interface WindowControlsProps {
    /** Optional class name for additional styling */
    className?: string
}

export function WindowControls({ className = "" }: WindowControlsProps) {
    // Track maximized state for icon toggle
    const [isMaximized, setIsMaximized] = useState(false)

    // Listen for window state changes to update maximize button icon
    useEffect(() => {
        // Check initial state
        appWindow.isMaximized().then(setIsMaximized)

        // Subscribe to resize events to track maximize state
        const unlisten = appWindow.onResized(() => {
            appWindow.isMaximized().then(setIsMaximized)
        })

        return () => {
            unlisten.then((fn) => fn())
        }
    }, [])

    /**
     * Minimize the window
     */
    const handleMinimize = () => {
        appWindow.minimize()
    }

    /**
     * Toggle maximize/restore state
     */
    const handleMaximize = () => {
        appWindow.toggleMaximize()
    }

    /**
     * Close the application
     */
    const handleClose = () => {
        appWindow.close()
    }

    return (
        <div className={`window-controls ${className}`}>
            {/* Minimize Button */}
            <button
                className="window-control-btn window-control-minimize"
                onClick={handleMinimize}
                aria-label="Minimize window"
                title="Minimize"
            >
                <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M0 5h10" stroke="currentColor" strokeWidth="1" fill="none" />
                </svg>
            </button>

            {/* Maximize/Restore Button */}
            <button
                className="window-control-btn window-control-maximize"
                onClick={handleMaximize}
                aria-label={isMaximized ? "Restore window" : "Maximize window"}
                title={isMaximized ? "Restore" : "Maximize"}
            >
                {isMaximized ? (
                    // Restore icon (two overlapping rectangles)
                    <svg width="10" height="10" viewBox="0 0 10 10">
                        <path
                            d="M2 3v5h5V3H2zm1-1h5v5h-1V3H3V2z"
                            fill="currentColor"
                        />
                    </svg>
                ) : (
                    // Maximize icon (single rectangle)
                    <svg width="10" height="10" viewBox="0 0 10 10">
                        <rect
                            x="1"
                            y="1"
                            width="8"
                            height="8"
                            stroke="currentColor"
                            strokeWidth="1"
                            fill="none"
                        />
                    </svg>
                )}
            </button>

            {/* Close Button */}
            <button
                className="window-control-btn window-control-close"
                onClick={handleClose}
                aria-label="Close window"
                title="Close"
            >
                <svg width="10" height="10" viewBox="0 0 10 10">
                    <path
                        d="M1 1l8 8M9 1l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        fill="none"
                    />
                </svg>
            </button>
        </div>
    )
}
