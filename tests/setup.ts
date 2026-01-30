/**
 * ============================================================================
 * Vitest Test Setup
 * ============================================================================
 * 
 * Global setup for all tests. Runs before each test file.
 * - Configures jsdom matchers
 * - Sets up Tauri mocks for testing
 * ============================================================================
 */

import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock Tauri API for tests
// These mocks simulate Tauri's invoke and listen functions
const mockInvoke = vi.fn()
const mockListen = vi.fn(() => Promise.resolve(() => { }))

vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
    listen: mockListen,
}))

// Export mocks for use in tests
export { mockInvoke, mockListen }
