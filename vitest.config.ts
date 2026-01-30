import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        // Use jsdom for DOM testing
        environment: 'jsdom',
        // Setup files run before each test file
        setupFiles: ['./tests/setup.ts'],
        // Include test files from tests/ directory
        include: ['tests/**/*.{test,spec}.{js,ts,jsx,tsx}'],
        // Enable globals for describe, it, expect
        globals: true,
    },
})
