/**
 * ============================================================================
 * EventModal Component
 * ============================================================================
 * 
 * Dialog for adding or editing calendar events.
 * ============================================================================
 */

import { useState, useEffect } from "react"
import { CalendarEvent, EventType, EVENT_TYPE_CONFIG } from "../../types/calendar"
import "./EventModal.css"

interface EventModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (event: Partial<CalendarEvent>) => void
    initialDate?: Date
    eventToEdit?: CalendarEvent
    onDelete?: (eventId: string) => void
}

export function EventModal({
    isOpen,
    onClose,
    onSave,
    initialDate,
    eventToEdit,
    onDelete
}: EventModalProps) {
    // Form State
    const [title, setTitle] = useState("")
    const [type, setType] = useState<EventType>("study")
    const [date, setDate] = useState("")
    const [time, setTime] = useState("")
    const [linkedFile, setLinkedFile] = useState("")
    const [description, setDescription] = useState("")

    // Reset form when modal opens or event changes
    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                setTitle(eventToEdit.title)
                setType(eventToEdit.type)
                setDate(eventToEdit.date)
                setTime(eventToEdit.time || "")
                setLinkedFile(eventToEdit.linkedFile || "")
                setDescription(eventToEdit.description || "")
            } else {
                // New event default state
                setTitle("")
                setType("study")
                // Format initial date as YYYY-MM-DD
                const d = initialDate || new Date()
                setDate(d.toISOString().split('T')[0])
                setTime("")
                setLinkedFile("")
                setDescription("")
            }
        }
    }, [isOpen, eventToEdit, initialDate])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // Construct event object
        const eventData: Partial<CalendarEvent> = {
            title,
            type,
            date,
            time: time || undefined,
            linkedFile: linkedFile || undefined,
            description: description || undefined
        }

        if (eventToEdit) {
            eventData.id = eventToEdit.id
        }

        onSave(eventData)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="event-modal-overlay" onClick={onClose}>
            <div className="event-modal" onClick={e => e.stopPropagation()}>
                <div className="event-modal-header">
                    <span className="event-modal-title">
                        {eventToEdit ? "Edit Event" : "Add Event"}
                    </span>
                    <button className="event-modal-close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="event-modal-body">

                        {/* Title */}
                        <div className="event-form-group">
                            <label className="event-form-label">Title</label>
                            <input
                                type="text"
                                className="event-form-input"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Physics Exam"
                                required
                                autoFocus
                            />
                        </div>

                        {/* Type & Time Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="event-form-group">
                                <label className="event-form-label">Type</label>
                                <select
                                    className="event-form-select"
                                    value={type}
                                    onChange={e => setType(e.target.value as EventType)}
                                >
                                    {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>
                                            {config.icon} {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="event-form-group">
                                <label className="event-form-label">Time (Optional)</label>
                                <input
                                    type="time"
                                    className="event-form-input"
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Date */}
                        <div className="event-form-group">
                            <label className="event-form-label">Date</label>
                            <input
                                type="date"
                                className="event-form-input"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Linked File */}
                        <div className="event-form-group">
                            <label className="event-form-label">Linked File</label>
                            <input
                                type="text"
                                className="event-form-input"
                                value={linkedFile}
                                onChange={e => setLinkedFile(e.target.value)}
                                placeholder="path/to/notes.md"
                            />
                        </div>

                        {/* Description */}
                        <div className="event-form-group">
                            <label className="event-form-label">Description</label>
                            <textarea
                                className="event-form-textarea"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="event-modal-footer">
                        {eventToEdit && onDelete && (
                            <button
                                type="button"
                                className="event-modal-btn delete"
                                onClick={() => {
                                    if (confirm("Delete this event?")) {
                                        onDelete(eventToEdit.id)
                                        onClose()
                                    }
                                }}
                            >
                                Delete
                            </button>
                        )}

                        <button
                            type="button"
                            className="event-modal-btn cancel"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="event-modal-btn save"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
