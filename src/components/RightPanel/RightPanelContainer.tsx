/**
 * ============================================================================
 * RightPanelContainer Component
 * ============================================================================
 * 
 * Smart container that integrates:
 * - Layout: RightPanel (split view)
 * - Data: useCalendarController (events/tasks)
 * - Components: CalendarView, DailyPlanner, TaskList, EventModal
 * 
 * Acts as the composition layer to keep App.tsx clean.
 * ============================================================================
 */

import { useState, useMemo } from "react"
import { RightPanel } from "./RightPanel"
import { CalendarView } from "./CalendarView"
import { DailyPlanner } from "./PlannerSection/DailyPlanner"
import { TaskList } from "./PlannerSection/TaskList"
import { EventModal } from "./EventModal"
import { useCalendarController } from "../../hooks/useCalendarController"
import { CalendarEvent } from "../../types/calendar"
import "./PlannerSection/Planner.css"

interface RightPanelContainerProps {
    workspaceRoot: string | null
    onOpenFile: (path: string) => void
}

export function RightPanelContainer({ workspaceRoot, onOpenFile }: RightPanelContainerProps) {
    const { events, tasks, toggleTask, addEvent, updateEvent, deleteEvent } = useCalendarController(workspaceRoot)

    // UI State
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedDateValue, setSelectedDateValue] = useState<Date>(new Date())
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined)

    // Derived state: Today's date string
    const todayStr = new Date().toISOString().split('T')[0]

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

    // Handlers
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

    return (
        <>
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
