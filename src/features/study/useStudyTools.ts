import { useMemo } from "react"
import type { StudyContextType } from "../shared/StudyContext"
import { useFlashcards } from "../flashcards/useFlashcards"
import { useNotesSynthesis } from "../notes/useNotesSynthesis"
import { usePomodoro } from "../pomodoro/usePomodoro"
import { useSettings } from "../settings/useSettings"
import { useStudyStats } from "../stats/useStudyStats"

type SettingsController = ReturnType<typeof useSettings>
type PomodoroController = ReturnType<typeof usePomodoro>
type StudyStatsController = ReturnType<typeof useStudyStats>

interface StudyTools {
  settings: SettingsController["settings"]
  updateSettings: SettingsController["updateSettings"]
  resetToDefaults: SettingsController["resetToDefaults"]
  pomodoroState: PomodoroController[0]
  pomodoroActions: PomodoroController[1]
  flashcards: ReturnType<typeof useFlashcards>
  notes: ReturnType<typeof useNotesSynthesis>
  statsData: {
    totalStudyMinutes: StudyStatsController["totalStudyMinutes"]
    totalSessions: StudyStatsController["totalSessions"]
    currentStreak: StudyStatsController["currentStreak"]
    avgDailyMinutes: StudyStatsController["avgDailyMinutes"]
    weeklyData: ReturnType<StudyStatsController["getDailyAggregates"]>
    recentSessions: StudyStatsController["data"]["sessions"]
  }
}

export function useStudyTools(
  workspaceRoot: string | null,
  setFocusMode: StudyContextType["setFocusMode"],
): StudyTools {
  const { settings, updateSettings, resetToDefaults } = useSettings(workspaceRoot)
  const studyStats = useStudyStats(workspaceRoot)

  const [pomodoroState, pomodoroActions] = usePomodoro({
    settings: settings.pomodoro,
    onFocusMode: setFocusMode,
    onSessionComplete: (durationSeconds) => {
      studyStats.recordSession({
        date: new Date().toISOString().split("T")[0],
        startTime: new Date().toISOString(),
        duration: durationSeconds,
        type: "pomodoro",
        completedFull: true,
      })
    },
  })

  const flashcards = useFlashcards(workspaceRoot)
  const notes = useNotesSynthesis(workspaceRoot)

  // Memoized so the right panel does not re-render (and re-aggregate the
  // week) on every unrelated app render.
  const statsData = useMemo(() => ({
    totalStudyMinutes: studyStats.totalStudyMinutes,
    totalSessions: studyStats.totalSessions,
    currentStreak: studyStats.currentStreak,
    avgDailyMinutes: studyStats.avgDailyMinutes,
    weeklyData: studyStats.getDailyAggregates(7),
    recentSessions: studyStats.data.sessions,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    studyStats.data,
    studyStats.totalStudyMinutes,
    studyStats.totalSessions,
    studyStats.currentStreak,
    studyStats.avgDailyMinutes,
  ])

  return {
    settings,
    updateSettings,
    resetToDefaults,
    pomodoroState,
    pomodoroActions,
    flashcards,
    notes,
    statsData,
  }
}
