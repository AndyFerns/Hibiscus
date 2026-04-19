/**
 * ============================================================================
 * PomodoroPanel — Full Pomodoro Timer View (Right Panel)
 * ============================================================================
 *
 * Displays inside the right panel when the Pomodoro tool is selected.
 * Provides the full timer interface with:
 *
 * - Large circular SVG timer arc
 * - Current status indicator (Work / Break / Long Break)
 * - Start / Pause / Reset / Skip controls
 * - Session counter
 * - Visual pulse animation during active timer
 *
 * ARCHITECTURE:
 * - Receives state and actions from usePomodoro hook (props)
 * - Pure presentational component — no business logic
 * ============================================================================
 */

import type { PomodoroState, PomodoroActions } from "./usePomodoro"
import "./PomodoroPanel.css"

interface PomodoroPanelProps {
  state: PomodoroState
  actions: PomodoroActions
}

/**
 * Format seconds as mm:ss
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

/**
 * Human-readable status label
 */
function statusLabel(status: PomodoroState["status"]): string {
  switch (status) {
    case "work": return "Focus Time"
    case "break": return "Short Break"
    case "long-break": return "Long Break"
    default: return "Ready"
  }
}

/**
 * Status emoji
 */
function statusEmoji(status: PomodoroState["status"]): string {
  switch (status) {
    case "work": return "🔥"
    case "break": return "☕"
    case "long-break": return "🌴"
    default: return "⏱️"
  }
}

export function PomodoroPanel({ state, actions }: PomodoroPanelProps) {
  // SVG arc parameters
  const size = 180
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const progress = state.totalDuration > 0
    ? 1 - state.timeRemaining / state.totalDuration
    : 0
  const dashOffset = circumference * (1 - progress)

  // Ring color based on phase
  const ringColor =
    state.status === "work"
      ? "var(--error, #f7768e)"
      : state.status === "long-break"
        ? "var(--accent-secondary, #bb9af7)"
        : "var(--success, #9ece6a)"

  return (
    <div className="pomo-panel">
      {/* Header */}
      <div className="pomo-panel-header">
        <span className="pomo-panel-emoji">{statusEmoji(state.status)}</span>
        <span className="pomo-panel-status">{statusLabel(state.status)}</span>
      </div>

      {/* Timer circle */}
      <div className={`pomo-panel-timer ${state.isRunning ? "pomo-panel-timer--active" : ""}`}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="pomo-panel-svg"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="pomo-panel-arc"
          />
        </svg>

        {/* Time text overlay */}
        <div className="pomo-panel-time-overlay">
          <span className="pomo-panel-time">{formatTime(state.timeRemaining)}</span>
          {state.status !== "idle" && (
            <span className="pomo-panel-phase">{statusLabel(state.status)}</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="pomo-panel-controls">
        {state.status === "idle" ? (
          <button className="pomo-btn pomo-btn-primary" onClick={actions.start}>
            ▶ Start
          </button>
        ) : (
          <>
            {state.isRunning ? (
              <button className="pomo-btn pomo-btn-secondary" onClick={actions.pause}>
                ⏸ Pause
              </button>
            ) : (
              <button className="pomo-btn pomo-btn-primary" onClick={actions.start}>
                ▶ Resume
              </button>
            )}
            <button className="pomo-btn pomo-btn-secondary" onClick={actions.skip}>
              ⏭ Skip
            </button>
            <button className="pomo-btn pomo-btn-danger" onClick={actions.reset}>
              ⏹ Reset
            </button>
          </>
        )}
      </div>

      {/* Session counter */}
      <div className="pomo-panel-sessions">
        <span className="pomo-panel-sessions-label">Sessions completed</span>
        <span className="pomo-panel-sessions-count">{state.sessionsCompleted}</span>
      </div>
    </div>
  )
}
