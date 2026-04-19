/**
 * ============================================================================
 * usePomodoro — Pomodoro Timer Core Logic
 * ============================================================================
 *
 * Self-contained timer hook implementing the full Pomodoro technique:
 *
 * LIFECYCLE:
 * idle → work (25 min) → break (5 min) → work → ... → long break (15 min) → idle
 *
 * FEATURES:
 * - Drift-free 1-second ticking via setInterval + useRef
 * - Focus mode integration (auto-enter on work start)
 * - Settings-driven durations and behaviors
 * - Session recording for study statistics
 * - Browser notification when timer ends
 *
 * DESIGN:
 * - Timer state is entirely local to this hook
 * - Focus mode triggers are communicated via callback props
 * - Stats recording is done via a callback prop (decoupled)
 * ============================================================================
 */

import { useState, useRef, useCallback, useEffect } from "react"
import type { AppSettings } from "../settings/settingsTypes"

// =============================================================================
// TYPES
// =============================================================================

export type PomodoroStatus = "idle" | "work" | "break" | "long-break"

export interface PomodoroState {
  /** Current phase of the Pomodoro cycle */
  status: PomodoroStatus
  /** Seconds remaining in the current phase */
  timeRemaining: number
  /** Total work sessions completed in this cycle */
  sessionsCompleted: number
  /** Whether the timer is currently counting down */
  isRunning: boolean
  /** Total seconds for the current phase (for progress calculation) */
  totalDuration: number
}

export interface PomodoroActions {
  /** Start or resume the timer */
  start: () => void
  /** Pause the timer (keeps state) */
  pause: () => void
  /** Reset everything back to idle */
  reset: () => void
  /** Skip the current phase (go to next) */
  skip: () => void
}

// =============================================================================
// HOOK
// =============================================================================

interface UsePomodoroOptions {
  /** Current Pomodoro settings */
  settings: AppSettings["pomodoro"]
  /** Called when focus mode should be enabled/disabled */
  onFocusMode?: (on: boolean) => void
  /** Called when a work session is completed (for stats recording) */
  onSessionComplete?: (durationSeconds: number) => void
}

export function usePomodoro({
  settings,
  onFocusMode,
  onSessionComplete,
}: UsePomodoroOptions): [PomodoroState, PomodoroActions] {
  // ---- State ----
  const [status, setStatus] = useState<PomodoroStatus>("idle")
  const [timeRemaining, setTimeRemaining] = useState(settings.workDuration * 60)
  const [totalDuration, setTotalDuration] = useState(settings.workDuration * 60)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // Ref to track the interval (prevents stale closures)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref to track session start time for stats
  const sessionStartRef = useRef<number>(0)

  /**
   * Get the duration in seconds for a given status.
   */
  const getDuration = useCallback(
    (s: PomodoroStatus): number => {
      switch (s) {
        case "work":
          return settings.workDuration * 60
        case "break":
          return settings.breakDuration * 60
        case "long-break":
          return settings.longBreakDuration * 60
        default:
          return settings.workDuration * 60
      }
    },
    [settings]
  )

  /**
   * Show a browser notification when a phase ends.
   */
  const notify = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "🌺" })
    }
  }, [])

  /**
   * Transition to the next phase after a phase completes.
   */
  const transitionToNext = useCallback(() => {
    if (status === "work") {
      // Record completed work session
      const elapsed = Date.now() - sessionStartRef.current
      onSessionComplete?.(Math.round(elapsed / 1000))

      const newCompleted = sessionsCompleted + 1
      setSessionsCompleted(newCompleted)

      // Determine next phase
      const isLongBreak = newCompleted % settings.sessionsBeforeLongBreak === 0
      const nextStatus: PomodoroStatus = isLongBreak ? "long-break" : "break"
      const nextDuration = getDuration(nextStatus)

      setStatus(nextStatus)
      setTimeRemaining(nextDuration)
      setTotalDuration(nextDuration)

      // Exit focus mode on break (if configured)
      if (settings.onTimerEnd === "exit-focus" || settings.onTimerEnd === "both") {
        onFocusMode?.(false)
      }

      notify(
        isLongBreak ? "Long Break! 🎉" : "Break Time! ☕",
        isLongBreak
          ? `${newCompleted} sessions done! Take a ${settings.longBreakDuration}min break.`
          : `Great work! Take a ${settings.breakDuration}min break.`
      )

      // Auto-start or pause
      if (!settings.autoStartNextSession) {
        setIsRunning(false)
      }
    } else {
      // Break → next work session
      const nextDuration = getDuration("work")
      setStatus("work")
      setTimeRemaining(nextDuration)
      setTotalDuration(nextDuration)
      sessionStartRef.current = Date.now()

      notify("Back to Work! 📚", `Session ${sessionsCompleted + 1} starting.`)

      // Re-enter focus mode for work
      if (settings.autoEnterFocusMode) {
        onFocusMode?.(true)
      }

      if (!settings.autoStartNextSession) {
        setIsRunning(false)
      }
    }
  }, [
    status,
    sessionsCompleted,
    settings,
    getDuration,
    onFocusMode,
    onSessionComplete,
    notify,
  ])

  // ---- Timer tick ----
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Phase complete — transition in the next tick
          setTimeout(() => transitionToNext(), 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, transitionToNext])

  // ---- Actions ----

  const start = useCallback(() => {
    if (status === "idle") {
      // Fresh start
      const duration = getDuration("work")
      setStatus("work")
      setTimeRemaining(duration)
      setTotalDuration(duration)
      sessionStartRef.current = Date.now()

      // Enter focus mode if configured
      if (settings.autoEnterFocusMode) {
        onFocusMode?.(true)
      }

      // Request notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
      }
    }
    setIsRunning(true)
  }, [status, getDuration, settings, onFocusMode])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    setStatus("idle")
    setTimeRemaining(settings.workDuration * 60)
    setTotalDuration(settings.workDuration * 60)
    setSessionsCompleted(0)
    onFocusMode?.(false)
  }, [settings, onFocusMode])

  const skip = useCallback(() => {
    transitionToNext()
  }, [transitionToNext])

  // ---- Return ----

  const state: PomodoroState = {
    status,
    timeRemaining,
    sessionsCompleted,
    isRunning,
    totalDuration,
  }

  const actions: PomodoroActions = { start, pause, reset, skip }

  return [state, actions]
}
