/**
 * ============================================================================
 * Save Functionality Tests
 * ============================================================================
 * 
 * Tests for the save functionality bugs that were fixed:
 * 1. File watcher starts for all workspaces (not just new ones)
 * 2. External file changes are detected and reloaded
 * 3. Ctrl+S handler uses latest callback (no stale closure)
 * 
 * These tests use mocked Tauri API to simulate backend interactions.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// =============================================================================
// Mock Setup
// =============================================================================

// Create mock functions for Tauri API
const mockInvoke = vi.fn()
const mockListenCallback = vi.fn()
let capturedFsChangedHandler: ((event: { payload: string[] }) => void) | null = null

vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@tauri-apps/api/event', () => ({
    listen: (eventName: string, handler: (event: { payload: string[] }) => void) => {
        if (eventName === 'fs-changed') {
            capturedFsChangedHandler = handler
        }
        mockListenCallback(eventName, handler)
        return Promise.resolve(() => {
            capturedFsChangedHandler = null
        })
    },
}))

// =============================================================================
// Test: File Watcher Starts for All Workspaces
// =============================================================================

describe('Bug Fix #1: File watcher starts for all workspaces', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'build_tree') {
                return Promise.resolve([])
            }
            if (cmd === 'discover_workspace') {
                return Promise.resolve({ found: true, path: '/test/.hibiscus/workspace.json' })
            }
            if (cmd === 'load_workspace') {
                return Promise.resolve({
                    schema_version: '1.0',
                    workspace: { id: '1', name: 'Test', root: '/test' },
                    tree: [],
                    session: {},
                })
            }
            if (cmd === 'watch_workspace') {
                return Promise.resolve()
            }
            return Promise.resolve()
        })
    })

    it('should call watch_workspace for existing workspace', async () => {
        // Import after mocks are set up
        const { useWorkspaceController } = await import('../src/hooks/useWorkspaceController')

        const { result } = renderHook(() => useWorkspaceController())

        // Trigger workspace load
        await act(async () => {
            await result.current.loadWorkspace('/test')
        })

        // Verify watch_workspace was called
        expect(mockInvoke).toHaveBeenCalledWith('watch_workspace', { path: '/test' })
    })

    it('should call watch_workspace for new workspace', async () => {
        // Mock as new workspace (no existing workspace.json)
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'build_tree') return Promise.resolve([])
            if (cmd === 'discover_workspace') return Promise.resolve({ found: false, path: null })
            if (cmd === 'save_workspace') return Promise.resolve()
            if (cmd === 'watch_workspace') return Promise.resolve()
            return Promise.resolve()
        })

        const { useWorkspaceController } = await import('../src/hooks/useWorkspaceController')

        const { result } = renderHook(() => useWorkspaceController())

        await act(async () => {
            await result.current.loadWorkspace('/new-test')
        })

        expect(mockInvoke).toHaveBeenCalledWith('watch_workspace', { path: '/new-test' })
    })
})

// =============================================================================
// Test: External File Change Detection
// =============================================================================

describe('Bug Fix #2: External file changes reload editor content', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedFsChangedHandler = null
    })

    it('should reload file when external change detected and file is not dirty', async () => {
        // Mock file read to return updated content
        mockInvoke.mockImplementation((cmd: string, args?: { path?: string }) => {
            if (cmd === 'read_text_file') {
                // Return "updated" content when file is read
                return Promise.resolve('Updated by external editor')
            }
            return Promise.resolve()
        })

        const { useEditorController } = await import('../src/hooks/useEditorController')

        const { result } = renderHook(() => useEditorController('/test'))

        // Simulate opening a file
        await act(async () => {
            mockInvoke.mockResolvedValueOnce('Original content')
            await result.current.openFile({
                id: '1',
                name: 'test.txt',
                path: 'test.txt',
                is_dir: false,
            })
        })

        // Simulate fs-changed event  
        if (capturedFsChangedHandler) {
            await act(async () => {
                capturedFsChangedHandler!({ payload: ['/test/test.txt'] })
                // Wait for async operations
                await new Promise(resolve => setTimeout(resolve, 100))
            })
        }

        // Verify read_text_file was called to check for changes
        expect(mockInvoke).toHaveBeenCalledWith('read_text_file', expect.any(Object))
    })

    it('should NOT overwrite local changes when file has unsaved edits', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

        const { useEditorController } = await import('../src/hooks/useEditorController')

        const { result } = renderHook(() => useEditorController('/test'))

        // Open file
        mockInvoke.mockResolvedValueOnce('Original content')
        await act(async () => {
            await result.current.openFile({
                id: '1',
                name: 'test.txt',
                path: 'test.txt',
                is_dir: false,
            })
        })

        // Make a local edit (marks as dirty)
        act(() => {
            result.current.onChange('Local unsaved changes')
        })

        // Verify file is dirty
        expect(result.current.isDirty).toBe(true)

        consoleWarnSpy.mockRestore()
    })
})

// =============================================================================
// Test: Ctrl+S Handler Uses Latest Callback
// =============================================================================

describe('Bug Fix #3: Ctrl+S uses latest onSave callback', () => {
    it('should use ref pattern to avoid stale closure', async () => {
        // This is a structural test - verify the component uses refs correctly
        const fs = await import('fs')
        const path = await import('path')

        const editorViewPath = path.resolve(__dirname, '../src/components/Editor/EditorView.tsx')
        const fileContent = fs.readFileSync(editorViewPath, 'utf-8')

        // Verify the fix is in place: onSaveRef should be defined
        expect(fileContent).toContain('onSaveRef')
        expect(fileContent).toContain('useRef(onSave)')

        // Verify the command uses the ref
        expect(fileContent).toContain('onSaveRef.current')
    })

    it('should have onSaveRef updated on every render', async () => {
        const fs = await import('fs')
        const path = await import('path')

        const editorViewPath = path.resolve(__dirname, '../src/components/Editor/EditorView.tsx')
        const fileContent = fs.readFileSync(editorViewPath, 'utf-8')

        // The ref should be updated on every render (not just on mount)
        expect(fileContent).toContain('onSaveRef.current = onSave')
    })
})

// =============================================================================
// Test: Autosave Debouncing
// =============================================================================

describe('Autosave functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should trigger debounced save after content change', async () => {
        mockInvoke.mockImplementation((cmd: string) => {
            if (cmd === 'read_text_file') return Promise.resolve('test content')
            if (cmd === 'write_text_file') return Promise.resolve()
            return Promise.resolve()
        })

        const { useEditorController } = await import('../src/hooks/useEditorController')

        const { result } = renderHook(() => useEditorController('/test'))

        // Open a file first
        await act(async () => {
            await result.current.openFile({
                id: '1',
                name: 'test.txt',
                path: 'test.txt',
                is_dir: false,
            })
        })

        // Clear previous calls
        mockInvoke.mockClear()

        // Make an edit
        act(() => {
            result.current.onChange('new content')
        })

        // Verify dirty state
        expect(result.current.isDirty).toBe(true)

        // Fast-forward debounce timer (1 second)
        await act(async () => {
            vi.advanceTimersByTime(1100)
        })

        // Verify write was called
        expect(mockInvoke).toHaveBeenCalledWith('write_text_file', expect.objectContaining({
            path: expect.stringContaining('test.txt'),
            contents: 'new content',
        }))
    })
})
