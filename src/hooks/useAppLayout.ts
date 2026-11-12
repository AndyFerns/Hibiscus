import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import type { CursorPosition } from "../types/workspace"
import { setCursorPosition as publishCursor } from "../state/cursorStore"

export type CenterView = "editor" | "graph"

interface AppLayoutState {
  showLeftPanel: boolean
  showRightPanel: boolean
  showShortcutOverlay: boolean
  centerView: CenterView
  setShowRightPanel: Dispatch<SetStateAction<boolean>>
  setCenterView: Dispatch<SetStateAction<CenterView>>
  /** Writes to the cursor store; only the status bar subscribes to it. */
  setCursorPosition: (position: CursorPosition) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleShortcutOverlay: () => void
  closeShortcutOverlay: () => void
  toggleGraphView: () => void
}

export function useAppLayout(): AppLayoutState {
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false)
  const [centerView, setCenterView] = useState<CenterView>("editor")
  const setCursorPosition = useCallback((position: CursorPosition) => {
    publishCursor(position)
  }, [])

  const toggleLeftPanel = useCallback(() => {
    setShowLeftPanel((visible) => !visible)
  }, [])

  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((visible) => !visible)
  }, [])

  const toggleShortcutOverlay = useCallback(() => {
    setShowShortcutOverlay((visible) => !visible)
  }, [])

  const closeShortcutOverlay = useCallback(() => {
    setShowShortcutOverlay(false)
  }, [])

  const toggleGraphView = useCallback(() => {
    setCenterView((view) => (view === "editor" ? "graph" : "editor"))
  }, [])

  return {
    showLeftPanel,
    showRightPanel,
    showShortcutOverlay,
    centerView,
    setShowRightPanel,
    setCenterView,
    setCursorPosition,
    toggleLeftPanel,
    toggleRightPanel,
    toggleShortcutOverlay,
    closeShortcutOverlay,
    toggleGraphView,
  }
}
