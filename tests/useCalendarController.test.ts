/**
 * ============================================================================
 * useCalendarController Hook Tests
 * ============================================================================
 *
 * Tests for calendar state management: CRUD operations, persistence,
 * and auto-save debouncing.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// =============================================================================
// Mock Setup
// =============================================================================

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(() => Promise.resolve(() => { })),
}))

describe('useCalendarController', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()

        // Default mock: return empty calendar data
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'read_calendar_data') {
                return Promise.resolve({ events: [], tasks: [], settings: {} })
            }
            if (cmd === 'save_calendar_data') {
                return Promise.resolve()
            }
            return Promise.resolve()
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should load calendar data on mount when workspace root is provided', async () => {
        const { useCalendarController } = await import('../src/hooks/useCalendarController')

        renderHook(() => useCalendarController('/test-workspace'))

        expect(mockInvoke).toHaveBeenCalledWith('read_calendar_data', { root: '/test-workspace' })
    })

    it('should not load calendar data when workspace root is null', async () => {
        const { useCalendarController } = await import('../src/hooks/useCalendarController')

        renderHook(() => useCalendarController(null))

        expect(mockInvoke).not.toHaveBeenCalled()
    })

    it('should add an event', async () => {
        const { useCalendarController } = await import('../src/hooks/useCalendarController')

        const { result } = renderHook(() => useCalendarController('/test'))

        // Wait for initial load
        await act(async () => {
            await Promise.resolve()
        })

        // Add event
        act(() => {
            result.current.addEvent({
                title: 'Midterm Exam',
                date: '2026-03-20',
                type: 'exam',
            })
        })

        expect(result.current.events).toHaveLength(1)
        expect(result.current.events[0].title).toBe('Midterm Exam')
        expect(result.current.events[0].type).toBe('exam')
    })

    it('should delete an event by ID', async () => {
        // Mock with pre-existing events
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'read_calendar_data') {
                return Promise.resolve({
                    events: [
                        { id: 'e1', title: 'Event A', date: '2026-01-01', type: 'study' },
                        { id: 'e2', title: 'Event B', date: '2026-01-02', type: 'exam' },
                    ],
                    tasks: [],
                    settings: {},
                })
            }
            return Promise.resolve()
        })

        const { useCalendarController } = await import('../src/hooks/useCalendarController')

        const { result } = renderHook(() => useCalendarController('/test'))

        await act(async () => {
            await Promise.resolve()
        })

        expect(result.current.events).toHaveLength(2)

        act(() => {
            result.current.deleteEvent('e1')
        })

        expect(result.current.events).toHaveLength(1)
        expect(result.current.events[0].id).toBe('e2')
    })

    it('should update an existing event', async () => {
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'read_calendar_data') {
                return Promise.resolve({
                    events: [
                        { id: 'e1', title: 'Original', date: '2026-01-01', type: 'study', completed: false },
                    ],
                    tasks: [],
                    settings: {},
                })
            }
            return Promise.resolve()
        })

        const { useCalendarController } = await import('../src/hooks/useCalendarController')
        const { result } = renderHook(() => useCalendarController('/test'))

        await act(async () => { await Promise.resolve() })

        act(() => {
            result.current.updateEvent({
                id: 'e1',
                title: 'Updated Title',
                date: '2026-01-01',
                type: 'exam',
                completed: true,
            })
        })

        expect(result.current.events[0].title).toBe('Updated Title')
        expect(result.current.events[0].type).toBe('exam')
    })

    it('should toggle task completion', async () => {
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'read_calendar_data') {
                return Promise.resolve({
                    events: [],
                    tasks: [
                        { id: 't1', title: 'Study Ch.5', completed: false, date: '2026-01-01' },
                    ],
                    settings: {},
                })
            }
            return Promise.resolve()
        })

        const { useCalendarController } = await import('../src/hooks/useCalendarController')
        const { result } = renderHook(() => useCalendarController('/test'))

        await act(async () => { await Promise.resolve() })

        expect(result.current.tasks[0].completed).toBe(false)

        act(() => {
            result.current.toggleTask('t1')
        })

        expect(result.current.tasks[0].completed).toBe(true)
    })

    it('should auto-save after debounce when events change', async () => {
        const { useCalendarController } = await import('../src/hooks/useCalendarController')
        const { result } = renderHook(() => useCalendarController('/test'))

        await act(async () => { await Promise.resolve() })

        mockInvoke.mockClear()

        act(() => {
            result.current.addEvent({ title: 'New', date: '2026-03-01', type: 'reminder' })
        })

        // Advance timer past debounce (500ms)
        await act(async () => {
            vi.advanceTimersByTime(600)
        })

        expect(mockInvoke).toHaveBeenCalledWith('save_calendar_data', expect.objectContaining({
            root: '/test',
        }))
    })
})
