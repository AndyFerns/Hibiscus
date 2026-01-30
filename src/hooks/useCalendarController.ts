/**
 * ============================================================================
 * useCalendarController Hook
 * ============================================================================
 * 
 * Manages calendar data state and CRUD operations.
 * Handles persistence to .hibiscus/calendar.json.
 * ============================================================================
 */

import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { CalendarEvent, DailyTask, CalendarData, formatLocalDate } from "../types/calendar"

export function useCalendarController(workspaceRoot: string | null) {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [tasks, setTasks] = useState<DailyTask[]>([])
    const [loading, setLoading] = useState(false)

    // Load data on workspace change
    useEffect(() => {
        if (!workspaceRoot) {
            setEvents([])
            setTasks([])
            return
        }

        setLoading(true)
        invoke<CalendarData>("read_calendar_data", { root: workspaceRoot })
            .then((data) => {
                setEvents(data.events || [])
                setTasks(data.tasks || [])
            })
            .catch((err) => {
                console.error("Failed to load calendar data:", err)
            })
            .finally(() => setLoading(false))
    }, [workspaceRoot])

    // Auto-save on changes (debounced)
    useEffect(() => {
        if (!workspaceRoot || loading) return

        const timer = setTimeout(() => {
            invoke("save_calendar_data", {
                root: workspaceRoot,
                data: { events, tasks, settings: {} }
            }).catch(err => console.error("Failed to save calendar data:", err))
        }, 500)

        return () => clearTimeout(timer)
    }, [events, tasks, workspaceRoot, loading])

    /**
     * Add a new event
     */
    const addEvent = (event: Partial<CalendarEvent>) => {
        const newEvent: CalendarEvent = {
            id: crypto.randomUUID(),
            title: event.title || "New Event",
            date: event.date || formatLocalDate(new Date()),
            type: event.type || "study",
            completed: false,
            ...event
        } as CalendarEvent
        setEvents(prev => [...prev, newEvent])
    }

    /**
     * Update an existing event
     */
    const updateEvent = (updatedEvent: CalendarEvent) => {
        setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e))
    }

    /**
     * Delete an event by ID
     */
    const deleteEvent = (eventId: string) => {
        setEvents(prev => prev.filter(e => e.id !== eventId))
    }

    /**
     * Toggle task completion status
     */
    const toggleTask = (taskId: string) => {
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
        ))
    }

    return {
        events,
        tasks,
        loading,
        addEvent,
        updateEvent,
        deleteEvent,
        toggleTask
    }
}
