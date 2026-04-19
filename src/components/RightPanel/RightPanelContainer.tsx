/**
 * ============================================================================
 * RightPanelContainer Component
 * ============================================================================
 *
 * Smart container that integrates the right panel with two view modes:
 *
 * 1. CALENDAR VIEW (default): Calendar + Daily Planner (original behavior)
 * 2. STUDY TOOLS VIEW: Pomodoro, Flashcards, Notes, or Stats
 *
 * The view is controlled by StudyContext.rightPanelView, and the user
 * can toggle between Calendar and Study Tools via a tab bar at the top.
 *
 * ARCHITECTURE:
 * - Composition layer that keeps App.tsx clean
 * - Receives hook instances as props (Pomodoro, Flashcards, etc.)
 * - Routes to the correct view based on context state
 * ============================================================================
 */

import { useState, useMemo } from "react"
import { RightPanel } from "./RightPanel"
import { CalendarView } from "./CalendarView"
import { DailyPlanner } from "./PlannerSection/DailyPlanner"
import { TaskList } from "./PlannerSection/TaskList"
import { EventModal } from "./EventModal"
import { useCalendarController } from "../../hooks/useCalendarController"
import { CalendarEvent, formatLocalDate } from "../../types/calendar"
import { useStudy, type RightPanelView } from "../../features/shared/StudyContext"
import { PomodoroPanel } from "../../features/pomodoro/PomodoroPanel"
import { FlashcardPanel } from "../../features/flashcards/FlashcardPanel"
import { NotesSynthesizer } from "../../features/notes/NotesSynthesizer"
import { StatsPanel } from "../../features/stats/StatsPanel"
import type { PomodoroState, PomodoroActions } from "../../features/pomodoro/usePomodoro"
import type { useFlashcards } from "../../features/flashcards/useFlashcards"
import type { useNotesSynthesis } from "../../features/notes/useNotesSynthesis"
import type { DailyAggregate, StudySession } from "../../features/stats/statsTypes"
import "./PlannerSection/Planner.css"

interface RightPanelContainerProps {
    workspaceRoot: string | null
    onOpenFile: (path: string) => void
    /** Pomodoro state + actions from the hook */
    pomodoroState: PomodoroState
    pomodoroActions: PomodoroActions
    /** Flashcards hook instance */
    flashcards: ReturnType<typeof useFlashcards>
    /** Notes hook instance */
    notes: ReturnType<typeof useNotesSynthesis>
    /** Stats data */
    statsData: {
        totalStudyMinutes: number
        totalSessions: number
        currentStreak: number
        avgDailyMinutes: number
        weeklyData: DailyAggregate[]
        recentSessions: StudySession[]
    }
}

/**
 * Tab definitions for the right panel view switcher.
 */
const VIEW_TABS: { id: RightPanelView; label: string; icon: string }[] = [
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "pomodoro", label: "Pomodoro", icon: "⏱️" },
    { id: "flashcards", label: "Cards", icon: "🃏" },
    { id: "notes", label: "Notes", icon: "📝" },
    { id: "stats", label: "Stats", icon: "📊" },
]

export function RightPanelContainer({
    workspaceRoot,
    onOpenFile,
    pomodoroState,
    pomodoroActions,
    flashcards,
    notes,
    statsData,
}: RightPanelContainerProps) {
    const { events, tasks, toggleTask, addEvent, updateEvent, deleteEvent } = useCalendarController(workspaceRoot)
    const { rightPanelView, setRightPanelView } = useStudy()

    // UI State for calendar
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedDateValue, setSelectedDateValue] = useState<Date>(new Date())
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined)

    // Derived state: Today's date string
    const todayStr = formatLocalDate(new Date())

    // Filter events for today
    const todayEvents = useMemo(() =>
        events.filter(e => e.date === todayStr)
        , [events, todayStr])

    // Filter tasks: separate today from upcoming
    const { dailyTasks, upcomingTasks } = useMemo(() => {
        const daily: typeof tasks = []
        const upcoming: typeof tasks = []

        tasks.forEach(t => {
            if (t.date === todayStr || !t.date) daily.push(t)
            else upcoming.push(t)
        })

        return { dailyTasks: daily, upcomingTasks: upcoming }
    }, [tasks, todayStr])

    // Calendar Handlers
    const handleDateSelect = (date: Date) => {
        setSelectedDateValue(date)
    }

    const handleAddEvent = (date: Date) => {
        setSelectedDateValue(date)
        setEditingEvent(undefined)
        setModalOpen(true)
    }

    const handleEventClick = (event: CalendarEvent) => {
        setEditingEvent(event)
        setModalOpen(true)
    }

    const handleSaveEvent = (eventData: Partial<CalendarEvent>) => {
        if (editingEvent) {
            updateEvent({ ...editingEvent, ...eventData } as CalendarEvent)
        } else {
            addEvent(eventData)
        }
        setModalOpen(false)
    }

    // =========================================================================
    // RENDER STUDY TOOL CONTENT
    // =========================================================================

    function renderStudyTool() {
        switch (rightPanelView) {
            case "pomodoro":
                return (
                    <PomodoroPanel
                        state={pomodoroState}
                        actions={pomodoroActions}
                    />
                )
            case "flashcards":
                return <FlashcardPanel flashcards={flashcards} />
            case "notes":
                return <NotesSynthesizer notes={notes} />
            case "stats":
                return (
                    <StatsPanel
                        totalStudyMinutes={statsData.totalStudyMinutes}
                        totalSessions={statsData.totalSessions}
                        currentStreak={statsData.currentStreak}
                        avgDailyMinutes={statsData.avgDailyMinutes}
                        weeklyData={statsData.weeklyData}
                        recentSessions={statsData.recentSessions}
                    />
                )
            default:
                return null
        }
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    return (
        <>
            {/* View switcher tab bar */}
            <div className="right-panel-tabs">
                {VIEW_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`right-panel-tab ${rightPanelView === tab.id ? "active" : ""}`}
                        onClick={() => setRightPanelView(tab.id)}
                        title={tab.label}
                    >
                        <span className="right-panel-tab-icon">{tab.icon}</span>
                        <span className="right-panel-tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content based on current view */}
            {rightPanelView === "calendar" ? (
                /* Calendar view (original layout) */
                <RightPanel
                    onOpenFile={onOpenFile}
                    calendarContent={
                        <CalendarView
                            events={events}
                            selectedDate={selectedDateValue}
                            onDateSelect={handleDateSelect}
                            onAddEvent={handleAddEvent}
                            onEventClick={handleEventClick}
                        />
                    }
                    plannerContent={
                        <>
                            <DailyPlanner
                                tasks={dailyTasks}
                                todayEvents={todayEvents}
                                onToggleTask={toggleTask}
                                onOpenFile={onOpenFile}
                            />
                            <TaskList
                                tasks={upcomingTasks}
                                onToggleTask={toggleTask}
                            />
                        </>
                    }
                />
            ) : (
                /* Study tool view */
                <div className="right-panel-study-content">
                    {renderStudyTool()}
                </div>
            )}

            <EventModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSaveEvent}
                initialDate={selectedDateValue}
                eventToEdit={editingEvent}
                onDelete={deleteEvent}
            />
        </>
    )
}
