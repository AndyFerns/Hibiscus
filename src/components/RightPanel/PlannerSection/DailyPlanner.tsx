/**
 * ============================================================================
 * DailyPlanner Component
 * ============================================================================
 * 
 * Shows today's schedule and tasks.
 * - Derived from calendar events for today
 * - Plus specific daily tasks
 * - Checklist style
 * ============================================================================
 */

import { DailyTask, CalendarEvent } from "../../../types/calendar"

interface DailyPlannerProps {
    tasks: DailyTask[]
    todayEvents: CalendarEvent[]
    onToggleTask: (taskId: string) => void
    onOpenFile?: (path: string) => void
}

export function DailyPlanner({
    tasks,
    todayEvents,
    onToggleTask,
    onOpenFile
}: DailyPlannerProps) {
    return (
        <div className="planner-section daily-planner">
            <div className="planner-header">Today's Schedule</div>

            {todayEvents.length === 0 && tasks.length === 0 ? (
                <div className="planner-empty">No tasks scheduled for today</div>
            ) : (
                <div className="planner-list">
                    {/* Calendar Events First */}
                    {todayEvents.map(event => (
                        <div key={event.id} className="planner-item event-item">
                            <div className="planner-time">{event.time || 'All Day'}</div>
                            <div className="planner-content">
                                <span className="planner-title">{event.title}</span>
                                {event.linkedFile && (
                                    <button
                                        className="planner-link-btn"
                                        onClick={() => onOpenFile?.(event.linkedFile!)}
                                        title={`Open ${event.linkedFile}`}
                                    >
                                        📄
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Daily Tasks */}
                    {tasks.map(task => (
                        <div key={task.id} className="planner-item task-item">
                            <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => onToggleTask(task.id)}
                                className="planner-checkbox"
                            />
                            <span className={`planner-task-title ${task.completed ? 'completed' : ''}`}>
                                {task.title}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
