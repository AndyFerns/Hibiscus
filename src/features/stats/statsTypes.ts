/**
 * ============================================================================
 * Study Statistics Types
 * ============================================================================
 *
 * Data models for tracking study sessions and computing aggregates.
 * All timestamps use ISO 8601 format; dates use YYYY-MM-DD.
 * ============================================================================
 */

/** A single study session record */
export interface StudySession {
  /** Unique session ID */
  id: string
  /** Date in YYYY-MM-DD format */
  date: string
  /** ISO timestamp when the session started */
  startTime: string
  /** Duration in seconds */
  duration: number
  /** Type of study activity */
  type: "pomodoro" | "focus" | "flashcard"
  /** Whether the full session was completed (vs. early exit) */
  completedFull: boolean
}

/** Aggregated stats for a single day */
export interface DailyAggregate {
  /** Date in YYYY-MM-DD format */
  date: string
  /** Total study time in minutes */
  totalMinutes: number
  /** Number of sessions */
  sessions: number
}

/** The full stats data stored on disk */
export interface StudyStatsData {
  /** All recorded sessions (append-only) */
  sessions: StudySession[]
  /** Last updated ISO timestamp */
  lastUpdated: string
}
