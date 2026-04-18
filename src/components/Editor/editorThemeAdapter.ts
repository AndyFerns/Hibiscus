/**
 * ============================================================================
 * Editor Theme Adapter — CSS Variables → Monaco Bridge
 * ============================================================================
 *
 * This adapter reads CSS custom properties (design tokens) from the document
 * root and translates them into a Monaco editor theme definition. This allows
 * the editor's syntax highlighting and UI colors to stay in perfect sync with
 * the application's active theme — without any hardcoded color values.
 *
 * ARCHITECTURE:
 * - CSS Variables (source of truth) → this adapter → Monaco `defineTheme`
 * - Called once on editor mount AND every time the active theme changes
 * - No color values live here — everything comes from CSS variables
 *
 * TOKEN MAPPING:
 * - --editor-bg         → editor.background
 * - --editor-fg         → editor.foreground, default token
 * - --editor-keyword    → keyword token
 * - --editor-string     → string token
 * - --editor-comment    → comment token (italic)
 * - --editor-selection  → editor.selectionBackground
 * - --editor-cursor     → editorCursor.foreground
 * - --editor-line-highlight → editor.lineHighlightBackground
 * - --editor-muted      → editorLineNumber.foreground
 * ============================================================================
 */

import * as monaco from "monaco-editor"

/**
 * Read a CSS custom property value from the document root element.
 * Returns the trimmed value, or an empty string if not found.
 */
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/**
 * Strip the leading '#' from a hex color string.
 * Monaco token rule `foreground` expects bare hex (e.g. "7aa2f7" not "#7aa2f7").
 */
function stripHash(color: string): string {
  return color.replace("#", "")
}

/**
 * Determine whether the current theme is light or dark by checking
 * the perceived luminance of --editor-bg. Returns "vs" for light themes
 * and "vs-dark" for dark themes.
 *
 * Uses a simple heuristic: parse the hex color's RGB channels and
 * compute relative luminance. Threshold at 0.5.
 */
function detectBaseTheme(): "vs" | "vs-dark" {
  const bg = getCSSVar("--editor-bg") || getCSSVar("--bg")

  // If the value isn't a simple hex color, default to dark
  if (!bg.startsWith("#")) return "vs-dark"

  const hex = bg.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  // Perceived luminance formula (ITU-R BT.709)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? "vs" : "vs-dark"
}

/**
 * Apply the current CSS variable theme to Monaco editor.
 *
 * This function:
 * 1. Reads all --editor-* CSS variables from the document root
 * 2. Builds a Monaco IStandaloneThemeData from those values
 * 3. Defines (or re-defines) the "hibiscus-dynamic" Monaco theme
 * 4. Sets it as the active editor theme
 *
 * Must be called:
 * - Once during editor initialization (EditorView mount)
 * - Every time the application theme changes (via ThemeContext)
 */
export function applyEditorThemeFromCSS(): void {
  const editorBg = getCSSVar("--editor-bg") || getCSSVar("--bg") || "#0a0d12"
  const editorFg = getCSSVar("--editor-fg") || getCSSVar("--text") || "#e6e6eb"
  const keyword = getCSSVar("--editor-keyword") || getCSSVar("--accent") || "#7aa2f7"
  const string = getCSSVar("--editor-string") || getCSSVar("--success") || "#9ece6a"
  const comment = getCSSVar("--editor-comment") || getCSSVar("--text-subtle") || "#5c6370"
  const selection = getCSSVar("--editor-selection") || getCSSVar("--accent-soft") || "rgba(122,162,247,0.15)"
  const cursor = getCSSVar("--editor-cursor") || getCSSVar("--editor-muted") || "#8b92a8"
  const lineHighlight = getCSSVar("--editor-line-highlight") || "rgba(255,255,255,0.03)"
  const muted = getCSSVar("--editor-muted") || getCSSVar("--text-muted") || "#8b92a8"

  const themeData: monaco.editor.IStandaloneThemeData = {
    base: detectBaseTheme(),
    inherit: true,
    rules: [
      { token: "", foreground: stripHash(editorFg) },
      { token: "keyword", foreground: stripHash(keyword) },
      { token: "string", foreground: stripHash(string) },
      { token: "comment", foreground: stripHash(comment), fontStyle: "italic" },
    ],
    colors: {
      "editor.background": editorBg,
      "editor.foreground": editorFg,
      "editorCursor.foreground": cursor,
      "editor.selectionBackground": selection,
      "editor.lineHighlightBackground": lineHighlight,
      "editorLineNumber.foreground": muted,
    },
  }

  monaco.editor.defineTheme("hibiscus-dynamic", themeData)
  monaco.editor.setTheme("hibiscus-dynamic")
}