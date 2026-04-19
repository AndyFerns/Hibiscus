/**
 * ============================================================================
 * useStudyStats — Study Statistics Management Hook
 * ============================================================================
 *
 * Manages loading, recording, and computing study statistics.
 * Data is persisted to .hibiscus/study/stats.json via the backend.
 *
 * FEATURES:
 * - Record new study sessions (append-only)
 * - Compute daily/weekly/monthly aggregates
 * - Calculate streaks (consecutive study days)
 * - Total study time and session counts
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { StudySession, StudyStatsData, DailyAggregate } from "./statsTypes"

// =============================================================================
// HELPERS
// =============================================================================

/** Generate a unique ID */
function generateId(): string {
  return `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Get today's date as YYYY-MM-DD */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Get date N days ago as YYYY-MM-DD */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// =============================================================================
// HOOK
// =============================================================================

export function useStudyStats(workspaceRoot: string | null) {
  const [data, setData] = useState<StudyStatsData>({
    sessions: [],
    lastUpdated: new Date().toISOString(),
  })
  const [isLoaded, setIsLoaded] = useState(false)

  // ---- Load on mount ----
  useEffect(() => {
    if (!workspaceRoot) {
      setIsLoaded(true)
      return
    }

    invoke<string>("read_study_data", {
      root: workspaceRoot,
      filename: "stats.json",
    })
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as StudyStatsData
            setData(parsed)
          } catch (e) {
            console.warn("[StudyStats] Invalid JSON, using defaults:", e)
          }
        }
      })
      .catch((err) => {
        console.warn("[StudyStats] Failed to load:", err)
      })
      .finally(() => {
        setIsLoaded(true)
      })
  }, [workspaceRoot])

  // ---- Persist helper ----
  const persist = useCallback(
    (updated: StudyStatsData) => {
      if (!workspaceRoot) return
      invoke("save_study_data", {
        root: workspaceRoot,
        filename: "stats.json",
        data: JSON.stringify(updated, null, 2),
      }).catch((err) => {
        console.warn("[StudyStats] Failed to save:", err)
      })
    },
    [workspaceRoot]
  )

  // ---- Record a new session ----
  const recordSession = useCallback(
    (session: Omit<StudySession, "id">) => {
      setData((prev) => {
        const updated: StudyStatsData = {
          sessions: [...prev.sessions, { ...session, id: generateId() }],
          lastUpdated: new Date().toISOString(),
        }
        persist(updated)
        return updated
      })
    },
    [persist]
  )

  // ---- Compute aggregates ----

  /** Get daily aggregates for the last N days */
  const getDailyAggregates = useCallback(
    (days: number): DailyAggregate[] => {
      const result: DailyAggregate[] = []
      for (let i = days - 1; i >= 0; i--) {
        const date = daysAgo(i)
        const daySessions = data.sessions.filter((s) => s.date === date)
        result.push({
          date,
          totalMinutes: Math.round(
            daySessions.reduce((acc, s) => acc + s.duration, 0) / 60
          ),
          sessions: daySessions.length,
        })
      }
      return result
    },
    [data.sessions]
  )

  /** Total study time in minutes */
  const totalStudyMinutes = Math.round(
    data.sessions.reduce((acc, s) => acc + s.duration, 0) / 60
  )

  /** Total completed sessions */
  const totalSessions = data.sessions.length

  /** Current streak (consecutive days with at least 1 session) */
  const currentStreak = (() => {
    let streak = 0
    let checkDate = todayStr()

    // Check if today has sessions
    const todaySessions = data.sessions.filter((s) => s.date === checkDate)
    if (todaySessions.length === 0) {
      // Maybe the streak is from yesterday
      checkDate = daysAgo(1)
    }

    for (let i = 0; i < 365; i++) {
      const date = daysAgo(i + (todaySessions.length === 0 ? 1 : 0))
      const has = data.sessions.some((s) => s.date === date)
      if (has) {
        streak++
      } else {
        break
      }
    }
    return streak
  })()

  /** Average daily study minutes (over last 30 days with activity) */
  const avgDailyMinutes = (() => {
    const last30 = getDailyAggregates(30)
    const activeDays = last30.filter((d) => d.totalMinutes > 0)
    if (activeDays.length === 0) return 0
    const total = activeDays.reduce((acc, d) => acc + d.totalMinutes, 0)
    return Math.round(total / activeDays.length)
  })()

  return {
    data,
    isLoaded,
    recordSession,
    getDailyAggregates,
    totalStudyMinutes,
    totalSessions,
    currentStreak,
    avgDailyMinutes,
  }
}
