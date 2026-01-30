/**
 * ============================================================================
 * Calendar Types
 * ============================================================================
 * 
 * Type definitions for the calendar feature including events, tasks,
 * and calendar data storage.
 * 
 * STORAGE:
 * Calendar data is persisted in `.hibiscus/calendar.json` within the workspace.
 * ============================================================================
 */

/**
 * @brief Event types for categorization and color-coding
 * 
 * - exam: Red - Important test/examination dates
 * - assignment: Orange - Due dates for assignments/homework
 * - study: Blue - Scheduled study sessions
 * - reminder: Purple - General reminders
 * - custom: Gray - User-defined events
 */
export type EventType = 'exam' | 'assignment' | 'study' | 'reminder' | 'custom'

/**
 * @brief Priority levels for events and tasks
 */
export type Priority = 'low' | 'medium' | 'high'

/**
 * @brief Calendar event representing an important date
 * 
 * Events are the primary data structure for tracking important dates
 * like exams, assignments, and study sessions.
 */
export interface CalendarEvent {
    /** Unique identifier (UUID) */
    id: string
    /** Event title/name */
    title: string
    /** Date in ISO format (YYYY-MM-DD) */
    date: string
    /** Optional time in 24h format (HH:MM) */
    time?: string
    /** Event category for color-coding */
    type: EventType
    /** Optional relative path to linked file in workspace */
    linkedFile?: string
    /** Optional detailed description */
    description?: string
    /** Whether the event is marked as completed */
    completed?: boolean
    /** Priority level for sorting/display */
    priority?: Priority
}

/**
 * @brief Daily task for the planner section
 * 
 * Tasks are derived from events or created standalone for the daily planner.
 */
export interface DailyTask {
    /** Unique identifier (UUID) */
    id: string
    /** Task title/description */
    title: string
    /** Scheduled time in 24h format (HH:MM) */
    time?: string
    /** Duration in minutes */
    duration?: number
    /** Whether the task is completed */
    completed: boolean
    /** Optional link to parent calendar event */
    eventId?: string
    /** Date the task is for (YYYY-MM-DD) */
    date: string
}

/**
 * @brief Calendar settings for user preferences
 */
export interface CalendarSettings {
    /** Default view mode */
    defaultView: 'month' | 'week' | 'day'
    /** First day of the week (0 = Sunday, 1 = Monday, etc.) */
    firstDayOfWeek: number
    /** Whether to show completed events */
    showCompleted: boolean
}

/**
 * @brief Root data structure for calendar persistence
 * 
 * This structure is serialized to `.hibiscus/calendar.json`
 */
export interface CalendarData {
    /** Schema version for future migrations */
    schemaVersion: string
    /** All calendar events */
    events: CalendarEvent[]
    /** Standalone tasks (not linked to events) */
    tasks: DailyTask[]
    /** User preferences */
    settings: CalendarSettings
}

/**
 * @brief Default calendar data for new workspaces
 */
export const DEFAULT_CALENDAR_DATA: CalendarData = {
    schemaVersion: '1.0.0',
    events: [],
    tasks: [],
    settings: {
        defaultView: 'month',
        firstDayOfWeek: 0,
        showCompleted: true,
    },
}

/**
 * @brief Event type display configuration
 * 
 * Maps event types to their visual representation.
 */
export const EVENT_TYPE_CONFIG: Record<EventType, { color: string; icon: string; label: string }> = {
    exam: { color: '#f7768e', icon: '📝', label: 'Exam' },
    assignment: { color: '#ff9e64', icon: '📋', label: 'Assignment' },
    study: { color: '#7aa2f7', icon: '📚', label: 'Study Session' },
    reminder: { color: '#bb9af7', icon: '🔔', label: 'Reminder' },
    custom: { color: '#787c99', icon: '📌', label: 'Custom' },
}

/**
 * Formats a local date object to YYYY-MM-DD string
 * avoiding UTC shifts caused by toISOString()
 */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
}