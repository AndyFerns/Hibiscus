/**
 * ============================================================================
 * Theme Defaults — Preset Theme Definitions
 * ============================================================================
 *
 * Contains the built-in (preset) themes as static JSON objects.
 * These are READ-ONLY — users must duplicate a preset to edit it.
 *
 * ARCHITECTURE:
 * - This module is the single source of truth for preset theme token values
 * - themeRegistry.ts imports these to build the theme list
 * - ThemeContext.tsx uses REQUIRED_TOKENS for validation
 * - Theme names here MUST match the [data-theme="..."] values in theme.css
 *
 * ADDING A NEW TOKEN:
 * 1. Add to ALL_TOKENS array
 * 2. Add default value to each preset theme object
 * 3. If it's mandatory, add to REQUIRED_TOKENS
 * 4. Add matching CSS variable to theme.css
 * ============================================================================
 */

import type { Theme } from "./themeRegistry"

// =============================================================================
// TOKEN DEFINITIONS
// =============================================================================

/**
 * Tokens that MUST be present in every theme for the app to render correctly.
 * If any of these are missing, validation will fail and fallback is triggered.
 */
export const REQUIRED_TOKENS = [
  "--bg",
  "--text",
  "--editor-bg",
  "--editor-fg",
] as const

/**
 * All supported theme tokens. Themes may omit non-required tokens;
 * they will be filled in from the default (midnight) theme via merging.
 */
export const ALL_TOKENS = [
  // Backgrounds
  "--bg",
  "--bg-elevated",
  "--panel-bg",
  "--panel-bg-hover",
  "--editor-bg",

  // Borders
  "--border",
  "--border-hover",
  "--border-focus",
  "--divider",

  // Text
  "--text",
  "--text-muted",
  "--text-subtle",
  "--text-disabled",

  // Accent
  "--accent",
  "--accent-hover",
  "--accent-soft",
  "--accent-glow",
  "--accent-secondary",
  "--accent-secondary-soft",

  // Semantic colors
  "--success",
  "--success-soft",
  "--warning",
  "--warning-soft",
  "--error",
  "--error-soft",
  "--info",
  "--info-soft",

  // Editor-specific
  "--editor-fg",
  "--editor-muted",
  "--editor-keyword",
  "--editor-string",
  "--editor-comment",
  "--editor-selection",
  "--editor-line-highlight",
  "--editor-cursor",

  // Selection colors
  "--selection-bg",
  "--selection-text",
] as const

// =============================================================================
// PRESET THEME DEFINITIONS
// =============================================================================

/**
 * Midnight — Default dark theme (Tokyo Night inspired)
 * This theme's tokens are also used as the fallback/default for merging.
 */
export const MIDNIGHT_THEME: Theme = {
  name: "midnight",
  type: "preset",
  tokens: {
    "--bg": "#0a0d12",
    "--bg-elevated": "#0f1115",
    "--panel-bg": "#131720",
    "--panel-bg-hover": "#1a1f2e",
    "--editor-bg": "#0a0d12",

    "--border": "rgba(255, 255, 255, 0.06)",
    "--border-hover": "rgba(255, 255, 255, 0.12)",
    "--border-focus": "rgba(122, 162, 247, 0.5)",
    "--divider": "rgba(255, 255, 255, 0.04)",

    "--text": "#e6e6eb",
    "--text-muted": "#8b92a8",
    "--text-subtle": "#5c6370",
    "--text-disabled": "#3e4451",

    "--accent": "#7aa2f7",
    "--accent-hover": "#89b4fa",
    "--accent-soft": "rgba(122, 162, 247, 0.15)",
    "--accent-glow": "rgba(122, 162, 247, 0.25)",
    "--accent-secondary": "#bb9af7",
    "--accent-secondary-soft": "rgba(187, 154, 247, 0.15)",

    "--success": "#9ece6a",
    "--success-soft": "rgba(158, 206, 106, 0.15)",
    "--warning": "#e0af68",
    "--warning-soft": "rgba(224, 175, 104, 0.15)",
    "--error": "#f7768e",
    "--error-soft": "rgba(247, 118, 142, 0.15)",
    "--info": "#7dcfff",
    "--info-soft": "rgba(125, 207, 255, 0.15)",

    "--editor-fg": "#e6e6eb",
    "--editor-muted": "#8b92a8",
    "--editor-keyword": "#7aa2f7",
    "--editor-string": "#9ece6a",
    "--editor-comment": "#5c6370",
    "--editor-selection": "rgba(122, 162, 247, 0.15)",
    "--editor-line-highlight": "rgba(255, 255, 255, 0.03)",
    "--editor-cursor": "#8b92a8",

    "--selection-bg": "rgba(122, 162, 247, 0.25)",
    "--selection-text": "#ffffff",
  },
}

/**
 * Dawn — Light theme (clean, paper-like aesthetics)
 */
export const DAWN_THEME: Theme = {
  name: "dawn",
  type: "preset",
  tokens: {
    "--bg": "#f9fafb",
    "--bg-elevated": "#ffffff",
    "--panel-bg": "#f3f4f6",
    "--panel-bg-hover": "#e5e7eb",
    "--editor-bg": "#f9fafb",

    "--border": "rgba(0, 0, 0, 0.1)",
    "--border-hover": "rgba(0, 0, 0, 0.2)",
    "--border-focus": "rgba(59, 130, 246, 0.5)",
    "--divider": "rgba(0, 0, 0, 0.08)",

    "--text": "#111827",
    "--text-muted": "#4b5563",
    "--text-subtle": "#9ca3af",
    "--text-disabled": "#d1d5db",

    "--accent": "#3b82f6",
    "--accent-hover": "#2563eb",
    "--accent-soft": "rgba(59, 130, 246, 0.15)",
    "--accent-glow": "rgba(59, 130, 246, 0.25)",
    "--accent-secondary": "#8b5cf6",
    "--accent-secondary-soft": "rgba(139, 92, 246, 0.15)",

    "--success": "#10b981",
    "--success-soft": "rgba(16, 185, 129, 0.15)",
    "--warning": "#f59e0b",
    "--warning-soft": "rgba(245, 158, 11, 0.15)",
    "--error": "#ef4444",
    "--error-soft": "rgba(239, 68, 68, 0.15)",
    "--info": "#0ea5e9",
    "--info-soft": "rgba(14, 165, 233, 0.15)",

    "--editor-fg": "#111827",
    "--editor-muted": "#4b5563",
    "--editor-keyword": "#3b82f6",
    "--editor-string": "#10b981",
    "--editor-comment": "#9ca3af",
    "--editor-selection": "rgba(59, 130, 246, 0.2)",
    "--editor-line-highlight": "rgba(0, 0, 0, 0.03)",
    "--editor-cursor": "#4b5563",

    "--selection-bg": "rgba(59, 130, 246, 0.3)",
    "--selection-text": "#ffffff",
  },
}

/**
 * Forest — Dark green theme (nature-inspired, calming aesthetics)
 */
export const FOREST_THEME: Theme = {
  name: "forest",
  type: "preset",
  tokens: {
    "--bg": "#09120c",
    "--bg-elevated": "#0f1c13",
    "--panel-bg": "#122117",
    "--panel-bg-hover": "#1a2f21",
    "--editor-bg": "#09120c",

    "--border": "rgba(167, 243, 208, 0.1)",
    "--border-hover": "rgba(167, 243, 208, 0.2)",
    "--border-focus": "rgba(52, 211, 153, 0.5)",
    "--divider": "rgba(167, 243, 208, 0.05)",

    "--text": "#ecfdf5",
    "--text-muted": "#a7f3d0",
    "--text-subtle": "#6ee7b7",
    "--text-disabled": "#065f46",

    "--accent": "#34d399",
    "--accent-hover": "#10b981",
    "--accent-soft": "rgba(52, 211, 153, 0.15)",
    "--accent-glow": "rgba(52, 211, 153, 0.25)",
    "--accent-secondary": "#818cf8",
    "--accent-secondary-soft": "rgba(129, 140, 248, 0.15)",

    "--success": "#6ee7b7",
    "--success-soft": "rgba(110, 231, 183, 0.15)",
    "--warning": "#fbbf24",
    "--warning-soft": "rgba(251, 191, 36, 0.15)",
    "--error": "#f87171",
    "--error-soft": "rgba(248, 113, 113, 0.15)",
    "--info": "#38bdf8",
    "--info-soft": "rgba(56, 189, 248, 0.15)",

    "--editor-fg": "#ecfdf5",
    "--editor-muted": "#a7f3d0",
    "--editor-keyword": "#34d399",
    "--editor-string": "#6ee7b7",
    "--editor-comment": "#6ee7b7",
    "--editor-selection": "rgba(52, 211, 153, 0.2)",
    "--editor-line-highlight": "rgba(167, 243, 208, 0.03)",
    "--editor-cursor": "#a7f3d0",

    "--selection-bg": "rgba(52, 211, 153, 0.3)",
    "--selection-text": "#ffffff",
  },
}

/**
 * All preset themes in display order.
 * Order determines rendering in the theme selector dropdown.
 */
export const PRESET_THEMES: Theme[] = [
  MIDNIGHT_THEME,
  DAWN_THEME,
  FOREST_THEME,
]

/**
 * The default fallback theme used when:
 * - A user theme fails validation
 * - A theme token is missing and needs a default value
 * - The app first launches with no saved preference
 */
export const DEFAULT_THEME = MIDNIGHT_THEME
