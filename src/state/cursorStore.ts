/**
 * Cursor position store.
 *
 * The editor cursor moves on every keystroke. Holding it in React state at the
 * app root used to re-render the whole workbench per keystroke. This tiny
 * external store lets only the status-bar readout subscribe to it.
 */

import { useSyncExternalStore } from "react"
import type { CursorPosition } from "../types/workspace"

let current: CursorPosition = { line: 1, column: 1 }
const listeners = new Set<() => void>()

export function getCursorPosition(): CursorPosition {
  return current
}

export function setCursorPosition(next: CursorPosition): void {
  if (next.line === current.line && next.column === current.column) return
  current = next
  listeners.forEach((l) => l())
}

export function subscribeCursor(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** React hook: re-renders the caller only when the cursor moves. */
export function useCursorPosition(): CursorPosition {
  return useSyncExternalStore(subscribeCursor, getCursorPosition, getCursorPosition)
}
