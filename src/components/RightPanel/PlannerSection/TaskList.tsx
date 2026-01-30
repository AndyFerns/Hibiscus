/**
 * ============================================================================
 * TaskList Component
 * ============================================================================
 * 
 * Shows upcoming tasks grouped by timeframe (Tomorrow, This Week, Later).
 * ============================================================================
 */

import { DailyTask } from "../../../types/calendar"

interface TaskListProps {
    tasks: DailyTask[]
    onToggleTask: (taskId: string) => void
}

export function TaskList({ tasks, onToggleTask }: TaskListProps) {
    // Simple grouping (mock logic for UI, real logic goes in controller)
    return (
        <div className="planner-section task-list">
            <div className="planner-header">Upcoming Tasks</div>

            {tasks.length === 0 ? (
                <div className="planner-empty">No upcoming tasks</div>
            ) : (
                <div className="planner-list">
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
                                {task.date && <span className="planner-date-badge">{task.date}</span>}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
