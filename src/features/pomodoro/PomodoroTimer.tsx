/**
 * ============================================================================
 * PomodoroTimer — Status Bar Mini Timer Widget
 * ============================================================================
 *
 * A compact, non-intrusive timer that lives in the status bar.
 * Shows a circular progress ring + remaining time when a Pomodoro is running.
 * Clicking it opens the full Pomodoro panel in the right sidebar.
 *
 * HIDDEN when the timer is idle (no visual clutter).
 * ============================================================================
 */

import type { PomodoroState } from "./usePomodoro"
import "./PomodoroTimer.css"

interface PomodoroTimerProps {
  state: PomodoroState
  onClick: () => void
}

/**
 * Format seconds as mm:ss
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export function PomodoroTimer({ state, onClick }: PomodoroTimerProps) {
  // Don't show when idle
  if (state.status === "idle") return null

  // Calculate progress (0 to 1)
  const progress = state.totalDuration > 0
    ? 1 - state.timeRemaining / state.totalDuration
    : 0

  // SVG circle parameters for the progress ring
  const size = 18
  const strokeWidth = 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  // Color based on status
  const ringColor =
    state.status === "work"
      ? "var(--error, #f7768e)"
      : "var(--success, #9ece6a)"

  const statusLabel =
    state.status === "work"
      ? "Focus"
      : state.status === "long-break"
        ? "Long Break"
        : "Break"

  return (
    <button
      className="pomo-mini"
      onClick={onClick}
      title={`${statusLabel} — ${formatTime(state.timeRemaining)} remaining`}
    >
      {/* Progress ring */}
      <svg
        className="pomo-mini-ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
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
          className="pomo-mini-progress"
        />
      </svg>

      {/* Time display */}
      <span className="pomo-mini-time">{formatTime(state.timeRemaining)}</span>
    </button>
  )
}
