/**
 * ============================================================================
 * Theme Registry — Central Theme Management System
 * ============================================================================
 *
 * The frontend source-of-truth for all theme operations. This module provides:
 *
 * 1. Type definitions for the Theme data model
 * 2. Theme validation (ensures required tokens are present)
 * 3. Theme merging (fills missing tokens from defaults)
 * 4. Theme application (sets CSS variables on document root)
 * 5. Safe application (fallback to default on error)
 *
 * DESIGN PRINCIPLES:
 * - Theme logic lives ONLY in the frontend (no Rust business logic)
 * - Backend is used purely for persistence (save/load/delete JSON files)
 * - Live preview is instant: CSS variables are set directly on documentElement
 * - Monaco is updated via the editorThemeAdapter after each theme change
 *
 * USAGE:
 *   import { applyTheme, safeApplyTheme, validateTheme } from "./themeRegistry"
 *   safeApplyTheme(myTheme) // safe — falls back to default on error
 * ============================================================================
 */

import { applyEditorThemeFromCSS } from "../components/Editor/editorThemeAdapter"
import { DEFAULT_THEME, REQUIRED_TOKENS, PRESET_THEMES } from "./themeDefaults"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * A Hibiscus theme.
 *
 * @property name   - Unique identifier (used as filename and data-theme value)
 * @property type   - "preset" for built-in read-only themes, "user" for custom
 * @property tokens - Map of CSS variable name → value
 *
 * Token keys MUST include the leading "--" prefix (e.g. "--bg", "--text").
 */
export type Theme = {
  name: string
  type: "preset" | "user"
  tokens: Record<string, string>
}

/**
 * Shape of theme JSON files stored in .hibiscus/themes/*.json
 * Intentionally minimal — only name and tokens are persisted.
 * The `type` field is always "user" for persisted themes.
 */
export interface ThemeJSON {
  name: string
  tokens: Record<string, string>
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a theme has all required tokens.
 * Throws descriptive errors listing which tokens are missing.
 *
 * @param theme - The theme to validate
 * @throws Error if any REQUIRED_TOKENS are missing
 */
export function validateTheme(theme: Theme): void {
  if (!theme.name || typeof theme.name !== "string") {
    throw new Error("Theme must have a non-empty 'name' string")
  }

  if (!theme.tokens || typeof theme.tokens !== "object") {
    throw new Error("Theme must have a 'tokens' object")
  }

  const missing = REQUIRED_TOKENS.filter(
    (token) => !theme.tokens[token] || theme.tokens[token].trim() === ""
  )

  if (missing.length > 0) {
    throw new Error(`Theme "${theme.name}" is missing required tokens: ${missing.join(", ")}`)
  }
}

// =============================================================================
// MERGING
// =============================================================================

/**
 * Merge a partial theme with the default theme's tokens.
 * Any tokens present in the input are kept; missing tokens are filled
 * from DEFAULT_THEME (midnight).
 *
 * This ensures that even a minimal user theme (with just --bg and --text)
 * will have all tokens needed for the full UI to render.
 *
 * @param partial - Theme with potentially incomplete tokens
 * @returns A new Theme with all tokens filled in
 */
export function mergeWithDefaults(partial: Theme): Theme {
  return {
    ...partial,
    tokens: {
      ...DEFAULT_THEME.tokens,
      ...partial.tokens,
    },
  }
}

// =============================================================================
// APPLICATION
// =============================================================================

/**
 * Apply a theme to the application.
 *
 * Steps:
 * 1. Set data-theme attribute on <html> (for CSS selector matching)
 * 2. Apply all token values as inline CSS custom properties
 * 3. Re-apply the Monaco editor theme from the new CSS variables
 *
 * For preset themes, the data-theme attribute handles the CSS.
 * The inline style properties ensure user themes work even without
 * a matching [data-theme] CSS block.
 *
 * @param theme - The theme to apply (must have all required tokens)
 * @throws Error if theme fails validation
 */
export function applyTheme(theme: Theme): void {
  validateTheme(theme)

  const root = document.documentElement

  // Clear any previously set inline style properties to avoid stale tokens
  root.style.cssText = ""

  // Set the data-theme attribute for CSS selector matching
  // For preset themes, this activates the [data-theme="..."] CSS block
  // For user themes, this value is the custom theme name (no matching CSS block)
  root.setAttribute("data-theme", theme.name)

  // Apply all tokens as inline CSS custom properties
  // This works for both preset and user themes:
  // - Preset: overrides match the CSS block values (no visual change)
  // - User: provides the actual color values since no CSS block exists
  Object.entries(theme.tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  // Sync Monaco editor colors with the new theme
  // This reads the newly-applied CSS variables and updates Monaco's theme
  // Uses requestAnimationFrame to ensure CSS variables are computed first
  requestAnimationFrame(() => {
    applyEditorThemeFromCSS()
  })
}

/**
 * Safely apply a theme with automatic fallback.
 *
 * If applying the theme fails for ANY reason (missing tokens, invalid values,
 * runtime errors), this function catches the error and applies the default
 * theme instead. This guarantees the UI is NEVER left in a broken state.
 *
 * @param theme - The theme to try applying
 */
export function safeApplyTheme(theme: Theme): void {
  try {
    applyTheme(theme)
  } catch (error) {
    console.error(
      `[Hibiscus] Failed to apply theme "${theme.name}":`,
      error,
      "— falling back to default theme"
    )
    try {
      applyTheme(DEFAULT_THEME)
    } catch (fallbackError) {
      // If even the default theme fails, something is seriously wrong.
      // Clear styles to let CSS defaults take over.
      console.error("[Hibiscus] CRITICAL: Default theme also failed:", fallbackError)
      document.documentElement.style.cssText = ""
      document.documentElement.setAttribute("data-theme", "midnight")
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get all preset themes.
 * Returns a new array to prevent external mutation.
 */
export function getPresetThemes(): Theme[] {
  return [...PRESET_THEMES]
}

/**
 * Get the default token values (from midnight theme).
 * Useful for theme editor "reset" functionality.
 */
export function getDefaultTokens(): Record<string, string> {
  return { ...DEFAULT_THEME.tokens }
}

/**
 * Parse a raw JSON string into a Theme object.
 * Used when loading themes from backend persistence.
 *
 * @param json - Raw JSON string from a .json file
 * @returns A validated, merged Theme of type "user"
 * @throws Error if JSON is malformed or missing required fields
 */
export function parseThemeJSON(json: string): Theme {
  let parsed: ThemeJSON
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error("Invalid theme JSON: failed to parse")
  }

  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Invalid theme JSON: missing 'name' field")
  }

  if (!parsed.tokens || typeof parsed.tokens !== "object") {
    throw new Error("Invalid theme JSON: missing 'tokens' object")
  }

  // Build the Theme object and merge with defaults
  const theme: Theme = {
    name: parsed.name,
    type: "user",
    tokens: parsed.tokens,
  }

  return mergeWithDefaults(theme)
}

/**
 * Serialize a Theme to JSON string for persistence.
 * Only stores name and tokens — type is always "user" when loaded back.
 */
export function serializeTheme(theme: Theme): string {
  const data: ThemeJSON = {
    name: theme.name,
    tokens: theme.tokens,
  }
  return JSON.stringify(data, null, 2)
}
