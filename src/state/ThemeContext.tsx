/**
 * ============================================================================
 * ThemeContext — Application Theme State Provider
 * ============================================================================
 *
 * Provides centralized theme state management via React Context.
 * Integrates the theme registry (frontend logic) with backend persistence
 * (Tauri file I/O) and the Monaco editor adapter.
 *
 * RESPONSIBILITIES:
 * - Load themes from backend on mount
 * - Provide the active theme + full theme list to all components
 * - Handle theme switching (CSS + Monaco + localStorage)
 * - CRUD operations for user themes (create, save, delete, duplicate)
 * - Control theme editor modal visibility
 *
 * ARCHITECTURE:
 * - Frontend is source of truth for theme logic
 * - Backend (.hibiscus/themes/*.json) is persistence only
 * - Live preview is instant (no RPC delay) — CSS variables are set directly
 * - Monaco is synced via applyEditorThemeFromCSS() after each theme change
 * ============================================================================
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { invoke } from "@tauri-apps/api/core"

import type { Theme } from "./themeRegistry"
import {
  safeApplyTheme,
  getPresetThemes,
  parseThemeJSON,
  serializeTheme,
  mergeWithDefaults,
  validateTheme,
} from "./themeRegistry"
import { DEFAULT_THEME } from "./themeDefaults"

// =============================================================================
// CONTEXT TYPE DEFINITION
// =============================================================================

interface ThemeContextType {
  /** Name of the currently active theme */
  activeThemeName: string
  /** Full list of available themes (preset + user) */
  themes: Theme[]
  /** Switch to a theme by name */
  setTheme: (name: string) => void
  /** Save a user theme (create or update) */
  saveUserTheme: (theme: Theme) => Promise<void>
  /** Delete a user theme by name */
  deleteUserTheme: (name: string) => Promise<void>
  /** Duplicate a theme with a new name */
  duplicateTheme: (sourceName: string, newName: string) => Promise<void>
  /** Whether the theme editor modal is open */
  isThemeEditorOpen: boolean
  /** Toggle theme editor modal */
  setThemeEditorOpen: (open: boolean) => void
  /** Reload themes from backend */
  refreshThemes: () => Promise<void>
  /** Current workspace root (needed for persistence) */
  workspaceRoot: string | null
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface ThemeProviderProps {
  children: ReactNode
  /** Workspace root path — required for backend theme persistence */
  workspaceRoot?: string | null
}

export function ThemeProvider({ children, workspaceRoot = null }: ThemeProviderProps) {
  // ---- Active theme name (persisted in localStorage) ----
  const [activeThemeName, setActiveThemeName] = useState<string>(() => {
    return localStorage.getItem("hibiscus:theme") || "midnight"
  })

  // ---- User themes (loaded from backend) ----
  const [userThemes, setUserThemes] = useState<Theme[]>([])

  // ---- Theme editor modal state ----
  const [isThemeEditorOpen, setThemeEditorOpen] = useState(false)

  // ---- Combine preset + user themes ----
  const themes: Theme[] = [...getPresetThemes(), ...userThemes]

  // ===========================================================================
  // LOAD USER THEMES FROM BACKEND
  // ===========================================================================

  const loadUserThemes = useCallback(async () => {
    if (!workspaceRoot) return

    try {
      const themeJsons = await invoke<string[]>("load_themes", { root: workspaceRoot })
      const loaded: Theme[] = []

      for (const json of themeJsons) {
        try {
          const theme = parseThemeJSON(json)
          loaded.push(theme)
        } catch (err) {
          console.warn("[Hibiscus] Skipping invalid theme file:", err)
        }
      }

      setUserThemes(loaded)
    } catch (err) {
      // Backend may not have the themes command yet, or no workspace open
      console.warn("[Hibiscus] Failed to load user themes:", err)
    }
  }, [workspaceRoot])

  // Load themes when workspace root changes
  useEffect(() => {
    loadUserThemes()
  }, [loadUserThemes])

  // ===========================================================================
  // APPLY THEME ON MOUNT AND WHEN ACTIVE THEME CHANGES
  // ===========================================================================

  useEffect(() => {
    const theme = themes.find((t) => t.name === activeThemeName) || DEFAULT_THEME
    safeApplyTheme(theme)
    localStorage.setItem("hibiscus:theme", activeThemeName)
  }, [activeThemeName, userThemes]) // Re-apply when themes list changes (e.g. after save)

  // ===========================================================================
  // THEME SWITCHING
  // ===========================================================================

  const setTheme = useCallback((name: string) => {
    setActiveThemeName(name)
  }, [])

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  /**
   * Save a user theme to backend persistence and update local state.
   * If a user theme with the same name exists, it is overwritten.
   * Preset themes cannot be overwritten.
   */
  const saveUserTheme = useCallback(async (theme: Theme) => {
    // Ensure the theme is marked as user type
    const userTheme: Theme = { ...theme, type: "user" }

    // Validate before saving
    try {
      validateTheme(userTheme)
    } catch (err) {
      console.error("[Hibiscus] Theme validation failed:", err)
      throw err
    }

    // Merge with defaults to ensure completeness
    const merged = mergeWithDefaults(userTheme)

    // Persist to backend
    if (workspaceRoot) {
      try {
        const json = serializeTheme(merged)
        await invoke("save_theme", {
          root: workspaceRoot,
          name: merged.name,
          themeJson: json,
        })
      } catch (err) {
        console.error("[Hibiscus] Failed to save theme to disk:", err)
        throw err
      }
    }

    // Update local state
    setUserThemes((prev) => {
      const filtered = prev.filter((t) => t.name !== merged.name)
      return [...filtered, merged]
    })

    // If this is the active theme, re-apply it
    if (activeThemeName === merged.name) {
      safeApplyTheme(merged)
    }
  }, [workspaceRoot, activeThemeName])

  /**
   * Delete a user theme. Preset themes cannot be deleted.
   * If the deleted theme was active, switches to the default theme.
   */
  const deleteUserTheme = useCallback(async (name: string) => {
    // Prevent deleting preset themes
    const preset = getPresetThemes().find((t) => t.name === name)
    if (preset) {
      console.warn("[Hibiscus] Cannot delete preset theme:", name)
      return
    }

    // Remove from backend
    if (workspaceRoot) {
      try {
        await invoke("delete_theme", { root: workspaceRoot, name })
      } catch (err) {
        console.error("[Hibiscus] Failed to delete theme from disk:", err)
      }
    }

    // Remove from local state
    setUserThemes((prev) => prev.filter((t) => t.name !== name))

    // If deleted theme was active, switch to default
    if (activeThemeName === name) {
      setActiveThemeName(DEFAULT_THEME.name)
    }
  }, [workspaceRoot, activeThemeName])

  /**
   * Duplicate an existing theme (preset or user) with a new name.
   * The duplicate is always created as a user theme.
   */
  const duplicateTheme = useCallback(async (sourceName: string, newName: string) => {
    const source = themes.find((t) => t.name === sourceName)
    if (!source) {
      console.error("[Hibiscus] Cannot duplicate: theme not found:", sourceName)
      return
    }

    const duplicate: Theme = {
      name: newName,
      type: "user",
      tokens: { ...source.tokens },
    }

    await saveUserTheme(duplicate)
  }, [themes, saveUserTheme])

  /**
   * Refresh themes from backend (useful after external file changes).
   */
  const refreshThemes = useCallback(async () => {
    await loadUserThemes()
  }, [loadUserThemes])

  // ===========================================================================
  // CONTEXT VALUE
  // ===========================================================================

  return (
    <ThemeContext.Provider
      value={{
        activeThemeName,
        themes,
        setTheme,
        saveUserTheme,
        deleteUserTheme,
        duplicateTheme,
        isThemeEditorOpen,
        setThemeEditorOpen,
        refreshThemes,
        workspaceRoot,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Access the theme context.
 * Must be used within a <ThemeProvider>.
 *
 * @returns ThemeContextType with all theme operations
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
