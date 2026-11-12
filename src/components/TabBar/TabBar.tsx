/**
 * ============================================================================
 * TabBar Component
 * ============================================================================
 *
 * Horizontally scrollable tab bar displayed above the editor area.
 * Renders one tab per open file with:
 *   - Active state highlight (and the active tab is scrolled into view)
 *   - Dirty (unsaved) indicator
 *   - Close button per tab, middle-click to close
 *   - Drag to reorder tabs (lift-and-tilt ghost, FLIP settle)
 *   - Mouse wheel horizontal scroll when tabs overflow
 *   - Drop target for files dragged from the explorer (data-drop-open)
 *   - An "open files" dropdown at the right end (Ctrl+Shift+E)
 *
 * PERFORMANCE:
 * - Memoized; all callbacks from the editor controller are stable, so the
 *   tab bar only re-renders when tabs, the active tab or a dirty flag change.
 * ============================================================================
 */

import { memo, useRef, useCallback, useEffect } from "react"
import { OpenFile } from "../../types/editor"
import { useReorderDrag } from "../dnd/useReorderDrag"
import { OpenFilesDropdown } from "./OpenFilesDropdown"
import "./TabBar.css"
import "../dnd/dnd.css"

interface TabBarProps {
  /** Ordered list of currently open files */
  openFiles: OpenFile[]
  /** ID of the active/focused file tab */
  activeFileId: string | null
  /** Workspace root, used to show folder paths in the open-files list */
  workspaceRoot?: string | null
  /** Fired when a tab is clicked to switch to that file */
  onSelectTab: (fileId: string) => void
  /** Fired when the close button on a tab is clicked */
  onCloseTab: (fileId: string) => void
  onCloseTabs?: (fileIds: string[]) => void
  onReorderTabs?: (from: number, to: number) => void
  onRenameFile?: (path: string, newName: string) => Promise<string | null>
  onSaveFile?: (path: string) => void
  onSaveAll?: () => void
}

const CLOSE_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const TabBar = memo(function TabBar({
  openFiles,
  activeFileId,
  workspaceRoot,
  onSelectTab,
  onCloseTab,
  onCloseTabs,
  onReorderTabs,
  onRenameFile,
  onSaveFile,
  onSaveAll,
}: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const noopReorder = useCallback(() => {}, [])
  const reorder = useReorderDrag({
    containerRef: scrollContainerRef,
    axis: "x",
    onReorder: onReorderTabs ?? noopReorder,
    disabled: !onReorderTabs,
    ghostClassName: "dnd-ghost--tab",
  })

  /** Vertical wheel scrolls the strip horizontally. */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollContainerRef.current.scrollLeft += e.deltaY
    }
  }, [])

  // Keep the active tab visible (e.g. after opening from the tree or dropdown).
  useEffect(() => {
    if (!activeFileId) return
    const el = scrollContainerRef.current?.querySelector<HTMLElement>(
      `[data-reorder-key="${CSS.escape(activeFileId)}"]`
    )
    el?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeFileId])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>("[data-reorder-key]")
      if (tab) onSelectTab(tab.dataset.reorderKey!)
    },
    [onSelectTab]
  )

  // Middle-click closes a tab (VS Code behaviour).
  const handleAuxClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1) return
      const tab = (e.target as HTMLElement).closest<HTMLElement>("[data-reorder-key]")
      if (tab) {
        e.preventDefault()
        onCloseTab(tab.dataset.reorderKey!)
      }
    },
    [onCloseTab]
  )

  // An empty strip is still a drop zone for files dragged from the explorer.
  if (openFiles.length === 0) {
    return <div className="tab-bar tab-bar--empty" data-drop-open="" />
  }

  return (
    <div className="tab-bar" data-drop-open="">
      <div
        className="tab-bar-scroll"
        ref={scrollContainerRef}
        role="tablist"
        aria-label="Open files"
        onWheel={handleWheel}
        onPointerDown={reorder.onPointerDown}
        onClickCapture={reorder.onClickCapture}
        onClick={handleClick}
        onAuxClick={handleAuxClick}
      >
        {openFiles.map((file, index) => {
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
              data-reorder-index={index}
              data-reorder-key={file.id}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelectTab(file.id)
                }
              }}
            >
              <span className="tab-bar-tab-name">{file.name}</span>

              {file.isDirty && (
                <span className="tab-bar-tab-dirty" aria-label="Unsaved changes" />
              )}

              <button
                className="tab-bar-tab-close"
                aria-label={`Close ${file.name}`}
                title={`Close ${file.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(file.id)
                }}
              >
                {CLOSE_ICON}
              </button>
            </div>
          )
        })}
      </div>

      <OpenFilesDropdown
        openFiles={openFiles}
        activeFileId={activeFileId}
        workspaceRoot={workspaceRoot ?? null}
        onSelect={onSelectTab}
        onClose={onCloseTab}
        onCloseMany={onCloseTabs}
        onReorder={onReorderTabs}
        onRename={onRenameFile}
        onSave={onSaveFile}
        onSaveAll={onSaveAll}
      />
    </div>
  )
})
