/**
 * ============================================================================
 * CalendarView Component
 * ============================================================================
 * 
 * Interactive calendar widget for the right panel showing:
 * - Monthly grid view with navigation
 * - Event indicators on dates
 * - Date selection for viewing/adding events
 * 
 * FEATURES:
 * - Navigate between months (prev/next/today)
 * - Visual indicators for dates with events
 * - Click date to select and view events
 * - Color-coded event type badges
 * 
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │  ← January 2026 →     [Today]      │
 * ├───┬───┬───┬───┬───┬───┬───────────┤
 * │ S │ M │ T │ W │ T │ F │ S         │
 * ├───┼───┼───┼───┼───┼───┼───────────┤
 * │   │   │   │ 1•│ 2 │ 3 │ 4         │
 * │ 5 │...                             │
 * └─────────────────────────────────────┘
 * ============================================================================
 */

import { useState, useMemo } from "react"
import { CalendarEvent, EVENT_TYPE_CONFIG, formatLocalDate } from "../../types/calendar"
import "./CalendarView.css"

/**
 * @brief Props for CalendarView component
 */
interface CalendarViewProps {
    /** Events to display on the calendar */
    events?: CalendarEvent[]
    /** Currently selected date */
    selectedDate?: Date
    /** Callback when a date is selected */
    onDateSelect?: (date: Date) => void
    /** Callback when user wants to add an event */
    onAddEvent?: (date: Date) => void
    /** Callback when an event is clicked */
    onEventClick?: (event: CalendarEvent) => void
}

/**
 * @brief Day names for the calendar header
 */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * @brief Get all days to display in a month grid
 * 
 * Returns a 6x7 grid (42 days) including padding days from
 * the previous and next months.
 * 
 * @param year - Year to generate grid for
 * @param month - Month (0-11) to generate grid for
 * @returns Array of Date objects for the grid
 */
function getMonthGrid(year: number, month: number): Date[] {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Start from the Sunday of the week containing the 1st
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days: Date[] = []
    const current = new Date(startDate)

    // Generate 6 weeks (42 days) to ensure full grid
    for (let i = 0; i < 42; i++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
    }

    return days
}

/**
 * @brief Format date as ISO date string (YYYY-MM-DD)
 * Uses formatLocalDate to ensure local timezone logic
 */
function toDateString(date: Date): string {
    return formatLocalDate(date)
}

/**
 * @brief Check if two dates are the same day
 */
function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

/**
 * @brief CalendarView - Interactive monthly calendar grid
 * 
 * @param props - Component props
 * @returns JSX element
 */
export function CalendarView({
    events = [],
    selectedDate,
    onDateSelect,
    onAddEvent,
    onEventClick,
}: CalendarViewProps) {
    // Current view date (month/year being displayed)
    const [viewDate, setViewDate] = useState(new Date())

    // Selected date defaults to today
    const selected = selectedDate || new Date()

    // Today's date for highlighting
    const today = new Date()

    // ==========================================================================
    // COMPUTED VALUES
    // ==========================================================================

    /**
     * Generate the month grid for current view
     */
    const monthGrid = useMemo(() => {
        return getMonthGrid(viewDate.getFullYear(), viewDate.getMonth())
    }, [viewDate])

    /**
     * Group events by date for quick lookup
     */
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>()
        events.forEach(event => {
            const existing = map.get(event.date) || []
            existing.push(event)
            map.set(event.date, existing)
        })
        return map
    }, [events])

    /**
     * Format current month/year for display
     */
    const monthYearLabel = viewDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    })

    // ==========================================================================
    // NAVIGATION
    // ==========================================================================

    /**
     * @brief Navigate to previous month
     */
    const goToPrevMonth = () => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    }

    /**
     * @brief Navigate to next month
     */
    const goToNextMonth = () => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    }

    /**
     * @brief Navigate to current month (today)
     */
    const goToToday = () => {
        setViewDate(new Date())
        onDateSelect?.(new Date())
    }

    // ==========================================================================
    // EVENT HANDLERS
    // ==========================================================================

    /**
     * @brief Handle date cell click
     */
    const handleDateClick = (date: Date) => {
        onDateSelect?.(date)
    }

    /**
     * @brief Handle double-click to add event
     */
    const handleDateDoubleClick = (date: Date) => {
        onAddEvent?.(date)
    }

    // ==========================================================================
    // RENDER
    // ==========================================================================

    return (
        <div className="calendar-view">
            {/* ----------------------------------------------------------------
       * NAVIGATION HEADER
       * Month/year display with navigation controls
       * ---------------------------------------------------------------- */}
            <div className="calendar-view-nav">
                <button
                    className="calendar-view-nav-btn"
                    onClick={goToPrevMonth}
                    title="Previous month"
                    aria-label="Previous month"
                >
                    ←
                </button>

                <span className="calendar-view-month-label">
                    {monthYearLabel}
                </span>

                <button
                    className="calendar-view-nav-btn"
                    onClick={goToNextMonth}
                    title="Next month"
                    aria-label="Next month"
                >
                    →
                </button>

                <button
                    className="calendar-view-today-btn"
                    onClick={goToToday}
                    title="Go to today"
                >
                    Today
                </button>
            </div>

            {/* ----------------------------------------------------------------
       * DAY NAMES HEADER
       * ---------------------------------------------------------------- */}
            <div className="calendar-view-weekdays">
                {DAY_NAMES.map(day => (
                    <div key={day} className="calendar-view-weekday">
                        {day}
                    </div>
                ))}
            </div>

            {/* ----------------------------------------------------------------
       * MONTH GRID
       * 6x7 grid of day cells
       * ---------------------------------------------------------------- */}
            <div className="calendar-view-grid">
                {monthGrid.map((date, index) => {
                    const dateStr = toDateString(date)
                    const dateEvents = eventsByDate.get(dateStr) || []
                    const isCurrentMonth = date.getMonth() === viewDate.getMonth()
                    const isToday = isSameDay(date, today)
                    const isSelected = isSameDay(date, selected)

                    return (
                        <div
                            key={index}
                            className={`calendar-view-day ${!isCurrentMonth ? 'other-month' : ''
                                } ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleDateClick(date)}
                            onDoubleClick={() => handleDateDoubleClick(date)}
                            role="button"
                            tabIndex={0}
                            aria-label={date.toLocaleDateString()}
                        >
                            <span className="calendar-view-day-number">
                                {date.getDate()}
                            </span>

                            {/* Event indicators */}
                            {dateEvents.length > 0 && (
                                <div className="calendar-view-day-events">
                                    {dateEvents.slice(0, 3).map((event, i) => (
                                        <span
                                            key={event.id}
                                            className="calendar-view-event-dot"
                                            style={{
                                                backgroundColor: EVENT_TYPE_CONFIG[event.type].color
                                            }}
                                            title={event.title}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onEventClick?.(event)
                                            }}
                                        />
                                    ))}
                                    {dateEvents.length > 3 && (
                                        <span className="calendar-view-event-more">
                                            +{dateEvents.length - 3}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* ----------------------------------------------------------------
       * SELECTED DATE EVENTS
       * Quick view of events for selected date
       * ---------------------------------------------------------------- */}
            {selectedDate && (
                <div className="calendar-view-selected-events">
                    <div className="calendar-view-selected-header">
                        {selectedDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </div>

                    {eventsByDate.get(toDateString(selectedDate))?.length ? (
                        <div className="calendar-view-event-list">
                            {eventsByDate.get(toDateString(selectedDate))?.map(event => (
                                <div
                                    key={event.id}
                                    className="calendar-view-event-item"
                                    onClick={() => onEventClick?.(event)}
                                >
                                    <span
                                        className="calendar-view-event-type-icon"
                                        style={{ color: EVENT_TYPE_CONFIG[event.type].color }}
                                    >
                                        {EVENT_TYPE_CONFIG[event.type].icon}
                                    </span>
                                    <span className="calendar-view-event-title">
                                        {event.title}
                                    </span>
                                    {event.time && (
                                        <span className="calendar-view-event-time">
                                            {event.time}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="calendar-view-no-events">
                            No events for this date
                        </div>
                    )}

                    <button
                        className="calendar-view-add-btn"
                        onClick={() => onAddEvent?.(selectedDate)}
                    >
                        + Add Event
                    </button>
                </div>
            )}
        </div>
    )
}
