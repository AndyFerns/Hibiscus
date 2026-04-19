/**
 * ============================================================================
 * useSettings — Settings Management Hook
 * ============================================================================
 *
 * Manages loading, saving, and resetting application settings.
 *
 * PERSISTENCE STRATEGY:
 * - Primary: localStorage for instant access (no async penalty)
 * - Secondary: Backend JSON file for workspace-level persistence
 *
 * The hook provides:
 * - settings: Current AppSettings object
 * - updateSettings(partial): Deep-merge partial updates
 * - resetToDefaults(): Reset all settings to defaults
 * - isLoaded: Whether settings have been loaded from storage
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { AppSettings } from "./settingsTypes"
import { DEFAULT_SETTINGS } from "./settingsTypes"

const STORAGE_KEY = "hibiscus:settings"

/**
 * Deep merge two objects. Source values override target values.
 * Only merges plain objects — arrays and primitives are replaced.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, any>
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key]
    const targetVal = target[key] as any
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key as string] = deepMerge(
        targetVal,
        sourceVal as Record<string, any>
      )
    } else if (sourceVal !== undefined) {
      result[key as string] = sourceVal
    }
  }
  return result as T
}

export function useSettings(workspaceRoot: string | null) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // ---- Load settings on mount ----
  useEffect(() => {
    // Try localStorage first (instant)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>
        setSettings(deepMerge(DEFAULT_SETTINGS, parsed))
        setIsLoaded(true)
        return
      }
    } catch {
      console.warn("[Settings] Failed to parse localStorage settings")
    }

    // Fallback: try backend
    if (workspaceRoot) {
      invoke<string>("read_study_data", {
        root: workspaceRoot,
        filename: "settings.json",
      })
        .then((raw) => {
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<AppSettings>
            setSettings(deepMerge(DEFAULT_SETTINGS, parsed))
          }
        })
        .catch((err) => {
          console.warn("[Settings] Failed to load from backend:", err)
        })
        .finally(() => {
          setIsLoaded(true)
        })
    } else {
      setIsLoaded(true)
    }
  }, [workspaceRoot])

  // ---- Persist helper ----
  const persist = useCallback(
    (updated: AppSettings) => {
      // Save to localStorage (sync, instant)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        console.warn("[Settings] Failed to save to localStorage")
      }

      // Save to backend (async, best-effort)
      if (workspaceRoot) {
        invoke("save_study_data", {
          root: workspaceRoot,
          filename: "settings.json",
          data: JSON.stringify(updated, null, 2),
        }).catch((err) => {
          console.warn("[Settings] Failed to save to backend:", err)
        })
      }
    },
    [workspaceRoot]
  )

  // ---- Public API ----

  /**
   * Update settings with a partial object (deep merged).
   * Persists immediately to both localStorage and backend.
   */
  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const updated = deepMerge(prev, partial)
        persist(updated)
        return updated
      })
    },
    [persist]
  )

  /**
   * Reset all settings to factory defaults.
   */
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    persist(DEFAULT_SETTINGS)
  }, [persist])

  return { settings, updateSettings, resetToDefaults, isLoaded }
}
