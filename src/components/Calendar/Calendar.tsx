/**
 * ============================================================================
 * Calendar Component (Placeholder)
 * ============================================================================
 * 
 * Right panel calendar widget for study planning.
 * 
 * TODO: Implement full calendar functionality:
 * - Monthly/weekly/daily views
 * - Study session scheduling
 * - Integration with tasks/goals
 * - Event reminders
 * ============================================================================
 */

import "./Calendar.css"

/**
 * Calendar Props Interface
 */
interface CalendarProps {
    /** Currently selected date */
    selectedDate?: Date
    /** Callback when date is selected */
    onDateSelect?: (date: Date) => void
}

export function Calendar({
    selectedDate = new Date(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onDateSelect: _onDateSelect,
}: CalendarProps) {
    const currentMonth = selectedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    })

    const currentDay = selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
    })

    return (
        <div className="calendar">
            {/* Header */}
            <div className="calendar-header">
                <span className="calendar-title">📅 Calendar</span>
            </div>

            {/* Current Month Display */}
            <div className="calendar-month">
                <button className="calendar-nav-btn">←</button>
                <span className="calendar-month-label">{currentMonth}</span>
                <button className="calendar-nav-btn">→</button>
            </div>

            {/* Calendar Grid Placeholder */}
            <div className="calendar-grid-placeholder">
                <p className="calendar-placeholder-text">
                    Calendar grid coming soon...
                </p>
                <p className="calendar-current-date">
                    Today: {currentDay}
                </p>
            </div>

            {/* Upcoming Events Placeholder */}
            <div className="calendar-events">
                <div className="calendar-events-header">
                    <span>Upcoming Study Sessions</span>
                </div>
                <div className="calendar-events-list">
                    <div className="calendar-event-item">
                        <span className="calendar-event-time">No events scheduled</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="calendar-actions">
                <button className="calendar-action-btn">
                    + Add Study Session
                </button>
            </div>
        </div>
    )
}
