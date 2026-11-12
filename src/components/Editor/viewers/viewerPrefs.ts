/**
 * Per-file viewer state (last page, zoom, fit mode, thumbnails open).
 * Kept in memory for the session and mirrored to localStorage so reopening a
 * long PDF lands where you left off.
 */

export type FitMode = "width" | "page" | "custom"

export interface ViewerPrefs {
  page: number
  zoom: number
  fit: FitMode
  thumbs: boolean
}

const DEFAULTS: ViewerPrefs = { page: 1, zoom: 1, fit: "width", thumbs: false }
const STORAGE_KEY = "hibiscus:viewerPrefs"
const MAX_ENTRIES = 200

let loaded = false
const prefs = new Map<string, ViewerPrefs>()

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, ViewerPrefs>
    for (const [k, v] of Object.entries(parsed)) prefs.set(k, { ...DEFAULTS, ...v })
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
}

let saveTimer: number | null = null
function persist() {
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveTimer = null
    try {
      const entries = Array.from(prefs.entries()).slice(-MAX_ENTRIES)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
    } catch {
      // Storage full or blocked: prefs stay in memory only.
    }
  }, 400)
}

export function getViewerPrefs(path: string): ViewerPrefs {
  load()
  return prefs.get(path) ?? DEFAULTS
}

export function setViewerPrefs(path: string, patch: Partial<ViewerPrefs>): void {
  load()
  const next = { ...getViewerPrefs(path), ...patch }
  prefs.delete(path) // keep most-recent last for trimming
  prefs.set(path, next)
  persist()
}

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
