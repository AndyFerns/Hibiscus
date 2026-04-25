/**
 * ============================================================================
 * TabBar Component
 * ============================================================================
 *
 * Horizontally scrollable tab bar displayed above the editor area.
 * Renders one tab per open file with:
 *   - Active state highlight
 *   - Dirty (unsaved) indicator
 *   - Close button per tab
 *   - Mouse wheel horizontal scroll when tabs overflow
 *
 * PERFORMANCE:
 * - The component is memoized to prevent re-renders from unrelated App state.
 * - Individual tabs use stable callbacks via useCallback.
 * - The scrollable container uses native overflow-x for GPU-accelerated scroll.
 *
 * ICONS:
 * - Close button uses an SVG "X" icon to avoid emoji usage.
 * ============================================================================
 */

import { memo, useRef, useCallback } from "react"
import { OpenFile } from "../../types/editor"
import "./TabBar.css"

interface TabBarProps {
  /** Ordered list of currently open files */
  openFiles: OpenFile[]
  /** ID of the active/focused file tab */
  activeFileId: string | null
  /** Fired when a tab is clicked to switch to that file */
  onSelectTab: (fileId: string) => void
  /** Fired when the close button on a tab is clicked */
  onCloseTab: (fileId: string) => void
}

export const TabBar = memo(function TabBar({
  openFiles,
  activeFileId,
  onSelectTab,
  onCloseTab,
}: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  /**
   * Enable horizontal scrolling via mouse wheel on the tab strip.
   * This provides a natural scroll experience when many tabs overflow.
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      // Convert vertical scroll delta to horizontal movement
      scrollContainerRef.current.scrollLeft += e.deltaY
    }
  }, [])

  // Hide the tab bar entirely when no files are open
  if (openFiles.length === 0) {
    return null
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="Open files">
      <div
        className="tab-bar-scroll"
        ref={scrollContainerRef}
        onWheel={handleWheel}
      >
        {openFiles.map((file) => {
          const isActive = file.id === activeFileId
          const tabClasses = [
            "tab-bar-tab",
            isActive ? "tab-bar-tab--active" : "",
            file.isDirty ? "tab-bar-tab--dirty" : "",
          ]
            .filter(Boolean)
            .join(" ")

          return (
            <div
              key={file.id}
              className={tabClasses}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              title={file.path}
              onClick={() => onSelectTab(file.id)}
            >
              {/* File name label */}
              <span className="tab-bar-tab-name">{file.name}</span>

              {/* Dirty indicator dot -- only visible for unsaved files */}
              {file.isDirty && (
                <span className="tab-bar-tab-dirty" aria-label="Unsaved changes" />
              )}

              {/* Close button -- stops propagation so clicking X does not also switch tab */}
              <button
                className="tab-bar-tab-close"
                aria-label={`Close ${file.name}`}
                title={`Close ${file.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(file.id)
                }}
              >
                {/* SVG X icon instead of emoji */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
})
