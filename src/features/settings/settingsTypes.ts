/**
 * ============================================================================
 * Settings Types — Application Preferences Schema
 * ============================================================================
 *
 * Type definitions for all user-configurable settings in Hibiscus.
 * Organized by feature area with sensible defaults.
 *
 * SECTIONS:
 * - General: App-wide preferences
 * - Pomodoro: Timer durations and behavior
 * - Panel: Which tools appear where (right panel preferences)
 * - Future stubs: AI, Cloud, Sync (shown but disabled in UI)
 * ============================================================================
 */

import type { StudyPanel } from "../shared/StudyContext"

// =============================================================================
// SETTINGS INTERFACE
// =============================================================================

export interface AppSettings {
  /** General application preferences */
  general: {
    /** Default study tool to open when clicking "Study Tools" */
    defaultTool: StudyPanel
    /** Whether entering focus mode also closes the left panel */
    focusModeHidesExplorer: boolean
    /** Whether the right panel remembers its last view on restart */
    rememberRightPanelView: boolean
  }

  /** Pomodoro timer configuration */
  pomodoro: {
    /** Work session duration in minutes (1–120) */
    workDuration: number
    /** Short break duration in minutes (1–30) */
    breakDuration: number
    /** Long break duration in minutes (1–60) */
    longBreakDuration: number
    /** Number of work sessions before a long break (1–10) */
    sessionsBeforeLongBreak: number
    /** Whether to automatically start the next session */
    autoStartNextSession: boolean
    /** Whether starting a Pomodoro automatically enters focus mode */
    autoEnterFocusMode: boolean
    /** What happens when the timer ends */
    onTimerEnd: "exit-focus" | "stop-timer" | "both"
  }

  /** Per-feature panel preferences — which section each tool opens in */
  panels: {
    pomodoroLocation: "right"
    flashcardsLocation: "right"
    notesLocation: "right"
    statsLocation: "right"
  }

  /** Future feature stubs (shown but disabled in Settings UI) */
  ai: { enabled: false }
  cloud: { enabled: false }
  sync: { enabled: false }
}

// =============================================================================
// DEFAULTS
// =============================================================================

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    defaultTool: "pomodoro",
    focusModeHidesExplorer: true,
    rememberRightPanelView: true,
  },
  pomodoro: {
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    autoStartNextSession: false,
    autoEnterFocusMode: true,
    onTimerEnd: "both",
  },
  panels: {
    pomodoroLocation: "right",
    flashcardsLocation: "right",
    notesLocation: "right",
    statsLocation: "right",
  },
  ai: { enabled: false },
  cloud: { enabled: false },
  sync: { enabled: false },
}
