/**
 * ============================================================================
 * StatsPanel — Study Statistics Dashboard (Right Panel)
 * ============================================================================
 *
 * Monkeytype-inspired clean statistics dashboard displaying:
 * - Summary cards (Total Time, Sessions, Streak, Avg/Day)
 * - Weekly bar chart (7-day activity)
 * - Recent session log (scrollable list)
 *
 * Renders inside the right panel when the stats tool is selected.
 * ============================================================================
 */

import { StatsChart } from "./StatsChart"
import type { DailyAggregate } from "./statsTypes"
import type { StudySession } from "./statsTypes"
import "./StatsPanel.css"

interface StatsPanelProps {
  totalStudyMinutes: number
  totalSessions: number
  currentStreak: number
  avgDailyMinutes: number
  weeklyData: DailyAggregate[]
  recentSessions: StudySession[]
}

export function StatsPanel({
  totalStudyMinutes,
  totalSessions,
  currentStreak,
  avgDailyMinutes,
  weeklyData,
  recentSessions,
}: StatsPanelProps) {
  /**
   * Format minutes as hours and minutes string.
   */
  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <div className="stats-panel">
      {/* Header */}
      <div className="stats-panel-header">
        <span className="stats-panel-title">Study Statistics</span>
      </div>

      {/* Summary cards */}
      <div className="stats-cards">
        <div className="stats-card">
          <span className="stats-card-value">{formatDuration(totalStudyMinutes)}</span>
          <span className="stats-card-label">Total Time</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">{totalSessions}</span>
          <span className="stats-card-label">Sessions</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">{currentStreak}d</span>
          <span className="stats-card-label">Streak</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-value">{formatDuration(avgDailyMinutes)}</span>
          <span className="stats-card-label">Avg/Day</span>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="stats-chart-section">
        <h3 className="stats-section-title">This Week</h3>
        <StatsChart data={weeklyData} height={140} />
      </div>

      {/* Recent sessions */}
      <div className="stats-sessions-section">
        <h3 className="stats-section-title">Recent Sessions</h3>
        {recentSessions.length === 0 ? (
          <p className="stats-empty">No sessions recorded yet. Start a Pomodoro!</p>
        ) : (
          <div className="stats-session-list">
            {recentSessions.slice(-10).reverse().map((s) => (
              <div key={s.id} className="stats-session-item">
                <span className="stats-session-type">
                  {s.type === "pomodoro" ? "Pomodoro" : s.type === "flashcard" ? "Flashcard" : "Focus"}
                </span>
                <span className="stats-session-date">{s.date}</span>
                <span className="stats-session-duration">
                  {Math.round(s.duration / 60)}m
                </span>
                {s.completedFull && (
                  <span className="stats-session-badge">✓</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
