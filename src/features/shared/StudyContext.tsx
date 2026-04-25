/**
 * ============================================================================
 * StudyContext — Shared Study Tools State Provider
 * ============================================================================
 *
 * Central provider for study tool state that needs to be shared across
 * the application. Manages:
 *
 * 1. FOCUS MODE — A global UI state that hides non-essential panels
 *    to reduce distraction during study sessions. Driven by CSS attribute
 *    [data-focus="true"] on the document element.
 *
 * 2. ACTIVE PANEL — Tracks which study tool is currently displayed in
 *    the right panel. Tools open IN the right panel alongside/instead of
 *    the calendar view, and users can toggle between them.
 *
 * 3. RIGHT PANEL VIEW — Controls whether the right panel shows the
 *    calendar or a study tool, and which study tool is active.
 *
 * ARCHITECTURE:
 * - Each feature (pomodoro, flashcards, etc.) has its OWN hook for
 *   internal state. This context only provides shared cross-cutting state.
 * - Focus mode is CSS-driven: this context sets [data-focus] attribute,
 *   and App.css handles the visual changes.
 * ============================================================================
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"

// =============================================================================
// TYPES
// =============================================================================

/** Study tool panel identifiers */
export type StudyPanel = "pomodoro" | "flashcards" | "notes" | "stats" | "search" | "study"

/** What the right panel currently shows */
export type RightPanelView = "calendar" | StudyPanel

export interface StudyContextType {
  /** Whether focus mode is active (hides non-essential UI) */
  focusMode: boolean
  /** Enable or disable focus mode */
  setFocusMode: (on: boolean) => void
  /** Toggle focus mode on/off */
  toggleFocusMode: () => void

  /** Currently active study panel in the right sidebar (null = none open) */
  activeStudyPanel: StudyPanel | null
  /** Open a study panel in the right sidebar */
  setActiveStudyPanel: (panel: StudyPanel | null) => void

  /** What the right panel is currently showing */
  rightPanelView: RightPanelView
  /** Switch the right panel view */
  setRightPanelView: (view: RightPanelView) => void

  /** Whether the settings modal is open */
  isSettingsOpen: boolean
  /** Open/close the settings modal */
  setSettingsOpen: (open: boolean) => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const StudyContext = createContext<StudyContextType | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

interface StudyProviderProps {
  children: ReactNode
}

export function StudyProvider({ children }: StudyProviderProps) {
  // Focus mode state
  const [focusMode, setFocusModeState] = useState(false)

  // Right panel view: calendar (default) or a study tool
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>("calendar")

  // Active study panel (for when rightPanelView is a study tool)
  const [activeStudyPanel, setActiveStudyPanelState] = useState<StudyPanel | null>(null)

  // Settings modal
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  /**
   * Apply focus mode to the document element.
   * CSS handles the visual changes via [data-focus="true"].
   */
  const setFocusMode = useCallback((on: boolean) => {
    setFocusModeState(on)
  }, [])

  const toggleFocusMode = useCallback(() => {
    setFocusModeState((prev) => !prev)
  }, [])

  /**
   * When a study panel is activated, switch the right panel view to it.
   * When set to null, revert to calendar view.
   */
  const setActiveStudyPanel = useCallback((panel: StudyPanel | null) => {
    setActiveStudyPanelState(panel)
    if (panel) {
      setRightPanelView(panel)
    }
  }, [])

  // Sync the data-focus attribute on the document element
  useEffect(() => {
    if (focusMode) {
      document.documentElement.setAttribute("data-focus", "true")
    } else {
      document.documentElement.removeAttribute("data-focus")
    }
  }, [focusMode])

  const value: StudyContextType = {
    focusMode,
    setFocusMode,
    toggleFocusMode,
    activeStudyPanel,
    setActiveStudyPanel,
    rightPanelView,
    setRightPanelView,
    isSettingsOpen,
    setSettingsOpen,
  }

  return (
    <StudyContext.Provider value={value}>
      {children}
    </StudyContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Access the shared study tools context.
 * Must be used within a <StudyProvider>.
 */
export function useStudy(): StudyContextType {
  const ctx = useContext(StudyContext)
  if (!ctx) {
    throw new Error("useStudy() must be used within a <StudyProvider>")
  }
  return ctx
}
