/**
 * ============================================================================
 * Theme I/O — Export / Import Utilities
 * ============================================================================
 *
 * Provides file-based export and import of Hibiscus themes.
 *
 * EXPORT: Generates a downloadable .json file from a Theme object
 * IMPORT: Reads a .json file, validates & merges with defaults
 *
 * These utilities work entirely in the browser — no backend calls needed.
 * The imported theme is returned to the caller for saving via ThemeContext.
 * ============================================================================
 */

import {
  type Theme,
  validateTheme,
  mergeWithDefaults,
  serializeTheme,
} from "./themeRegistry"

// =============================================================================
// EXPORT
// =============================================================================

/**
 * Export a theme as a downloadable JSON file.
 *
 * Creates a Blob URL, triggers a browser download via a temporary <a> element,
 * and cleans up automatically.
 *
 * @param theme - The theme to export
 */
export function exportThemeAsJSON(theme: Theme): void {
  const json = serializeTheme(theme)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  // Create a temporary link element to trigger the download
  const link = document.createElement("a")
  link.href = url
  link.download = `${theme.name}.hibiscus-theme.json`
  document.body.appendChild(link)
  link.click()

  // Clean up
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// =============================================================================
// IMPORT
// =============================================================================

/**
 * Import a theme from a JSON file selected by the user.
 *
 * Steps:
 * 1. Read the file as text
 * 2. Parse JSON
 * 3. Validate structure (name + tokens)
 * 4. Merge with defaults to fill any missing tokens
 * 5. Return the fully-formed Theme object
 *
 * @param file - A File object (from <input type="file"> or drag-drop)
 * @returns A validated, merged Theme ready for saving and applying
 * @throws Error if the file is not valid theme JSON
 */
export async function importThemeFromJSON(file: File): Promise<Theme> {
  const text = await file.text()

  let parsed: { name?: string; tokens?: Record<string, string> }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Import failed: file is not valid JSON")
  }

  // Validate structure
  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error("Import failed: theme JSON must have a 'name' field")
  }

  if (!parsed.tokens || typeof parsed.tokens !== "object") {
    throw new Error("Import failed: theme JSON must have a 'tokens' object")
  }

  // Build the theme and merge with defaults
  const theme: Theme = mergeWithDefaults({
    name: parsed.name,
    type: "user",
    tokens: parsed.tokens,
  })

  // Validate the merged result
  validateTheme(theme)

  return theme
}

/**
 * Open a native file picker and import the selected theme file.
 * Returns null if the user cancels the file dialog.
 *
 * @returns The imported Theme, or null if cancelled
 */
export function openImportDialog(): Promise<Theme | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const theme = await importThemeFromJSON(file)
        resolve(theme)
      } catch (error) {
        console.error("[Hibiscus] Theme import failed:", error)
        resolve(null)
      }
    }

    // Handle cancel (no reliable event, but clicking away won't trigger onchange)
    input.click()
  })
}
