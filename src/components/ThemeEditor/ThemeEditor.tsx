/**
 * ============================================================================
 * Theme Editor — In-App Theme Customization Modal
 * ============================================================================
 *
 * A modal-based UI for creating, editing, duplicating, and managing themes.
 * Provides instant live preview via direct CSS variable manipulation.
 *
 * FEATURES:
 * - Native color pickers for all theme tokens
 * - Live preview (instant, no RPC delay)
 * - Duplicate preset themes to create editable copies
 * - Rename, reset, delete user themes
 * - Export/import theme JSON files
 *
 * DESIGN:
 * - Minimal, clean, study-focused aesthetic
 * - Matches existing Hibiscus UI conventions
 * - Non-intrusive modal overlay
 * - Grouped color controls (Core, Editor, Semantic)
 *
 * ARCHITECTURE:
 * - Reads from ThemeContext for current themes + CRUD operations
 * - Live preview applies directly to CSS variables (no backend call)
 * - Save commits to backend via ThemeContext.saveUserTheme()
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { useTheme } from "../../state/ThemeContext"
import type { Theme } from "../../state/themeRegistry"
import { DEFAULT_THEME } from "../../state/themeDefaults"
import { exportThemeAsJSON, openImportDialog } from "../../state/themeIO"
import "./ThemeEditor.css"

// =============================================================================
// COLOR PICKER GROUPS
// Groups organize the tokens into logical sections in the UI
// =============================================================================

interface ColorField {
  /** CSS variable name (e.g. "--bg") */
  token: string
  /** Human-readable label */
  label: string
}

const CORE_COLORS: ColorField[] = [
  { token: "--bg", label: "Background" },
  { token: "--bg-elevated", label: "Elevated BG" },
  { token: "--panel-bg", label: "Panel BG" },
  { token: "--text", label: "Text" },
  { token: "--text-muted", label: "Text Muted" },
  { token: "--accent", label: "Accent" },
  { token: "--accent-hover", label: "Accent Hover" },
  { token: "--border", label: "Border" },
]

const EDITOR_COLORS: ColorField[] = [
  { token: "--editor-bg", label: "Editor BG" },
  { token: "--editor-fg", label: "Editor Text" },
  { token: "--editor-keyword", label: "Keyword" },
  { token: "--editor-string", label: "String" },
  { token: "--editor-comment", label: "Comment" },
  { token: "--editor-cursor", label: "Cursor" },
  { token: "--selection-bg", label: "Selection BG" },
  { token: "--selection-text", label: "Selection Text" },
]

const SEMANTIC_COLORS: ColorField[] = [
  { token: "--success", label: "Success" },
  { token: "--warning", label: "Warning" },
  { token: "--error", label: "Error" },
  { token: "--info", label: "Info" },
]

// =============================================================================
// COMPONENT
// =============================================================================

export function ThemeEditor() {
  const {
    themes,
    activeThemeName,
    setTheme,
    saveUserTheme,
    deleteUserTheme,
    duplicateTheme,
    isThemeEditorOpen,
    setThemeEditorOpen,
  } = useTheme()

  // ---- Editing state ----
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [editName, setEditName] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Ref for the modal content (click-outside detection)
  const modalRef = useRef<HTMLDivElement>(null)

  // ---- Initialize editing state when modal opens ----
  useEffect(() => {
    if (isThemeEditorOpen) {
      const current = themes.find((t) => t.name === activeThemeName)
      if (current) {
        // Deep clone to avoid mutating the original
        setEditingTheme({
          ...current,
          tokens: { ...current.tokens },
        })
        setEditName(current.name)
      }
      setHasUnsavedChanges(false)
      setError(null)
    }
  }, [isThemeEditorOpen]) // intentionally not depending on themes/activeThemeName

  // ---- Close on Escape key ----
  useEffect(() => {
    if (!isThemeEditorOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isThemeEditorOpen, hasUnsavedChanges])

  // ---- Close on click outside ----
  useEffect(() => {
    if (!isThemeEditorOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isThemeEditorOpen, hasUnsavedChanges])

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  /** Close the editor, reverting unsaved live-preview changes */
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      // Revert by re-applying the original active theme
      setTheme(activeThemeName)
    }
    setThemeEditorOpen(false)
  }, [hasUnsavedChanges, activeThemeName, setTheme, setThemeEditorOpen])

  /**
   * Handle color change from a picker.
   * Applies instantly to CSS variables for live preview.
   */
  const handleColorChange = useCallback(
    (token: string, value: string) => {
      if (!editingTheme) return

      setEditingTheme((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          tokens: { ...prev.tokens, [token]: value },
        }

        // Live preview: apply the token directly to the document
        document.documentElement.style.setProperty(token, value)

        return updated
      })

      setHasUnsavedChanges(true)
      setError(null)
    },
    [editingTheme]
  )

  /** Save the current edits */
  const handleSave = useCallback(async () => {
    if (!editingTheme) return

    // Preset themes are read-only
    if (editingTheme.type === "preset") {
      setError("Preset themes are read-only. Duplicate first to edit.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const themeToSave: Theme = {
        ...editingTheme,
        name: editName.trim() || editingTheme.name,
        type: "user",
      }

      await saveUserTheme(themeToSave)
      setTheme(themeToSave.name)
      setHasUnsavedChanges(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save theme")
    } finally {
      setSaving(false)
    }
  }, [editingTheme, editName, saveUserTheme, setTheme])

  /** Duplicate the current theme */
  const handleDuplicate = useCallback(async () => {
    if (!editingTheme) return

    const newName = `${editingTheme.name}-copy`
    await duplicateTheme(editingTheme.name, newName)

    // Switch to editing the duplicate
    const duplicated: Theme = {
      name: newName,
      type: "user",
      tokens: { ...editingTheme.tokens },
    }
    setEditingTheme(duplicated)
    setEditName(newName)
    setTheme(newName)
    setHasUnsavedChanges(false)
  }, [editingTheme, duplicateTheme, setTheme])

  /** Delete the current user theme */
  const handleDelete = useCallback(async () => {
    if (!editingTheme || editingTheme.type === "preset") return

    await deleteUserTheme(editingTheme.name)
    setThemeEditorOpen(false)
  }, [editingTheme, deleteUserTheme, setThemeEditorOpen])

  /** Reset to default values */
  const handleReset = useCallback(() => {
    if (!editingTheme) return

    const defaults = DEFAULT_THEME.tokens
    setEditingTheme({
      ...editingTheme,
      tokens: { ...defaults },
    })

    // Apply defaults as live preview
    Object.entries(defaults).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })

    setHasUnsavedChanges(true)
  }, [editingTheme])

  /** Export current theme */
  const handleExport = useCallback(() => {
    if (!editingTheme) return
    exportThemeAsJSON(editingTheme)
  }, [editingTheme])

  /** Import a theme from file */
  const handleImport = useCallback(async () => {
    const imported = await openImportDialog()
    if (imported) {
      await saveUserTheme(imported)
      setEditingTheme({ ...imported, tokens: { ...imported.tokens } })
      setEditName(imported.name)
      setTheme(imported.name)
      setHasUnsavedChanges(false)
    }
  }, [saveUserTheme, setTheme])

  /** Switch to editing a different theme */
  const handleThemeSelect = useCallback(
    (themeName: string) => {
      const selected = themes.find((t) => t.name === themeName)
      if (selected) {
        setEditingTheme({
          ...selected,
          tokens: { ...selected.tokens },
        })
        setEditName(selected.name)
        setTheme(selected.name)
        setHasUnsavedChanges(false)
        setError(null)
      }
    },
    [themes, setTheme]
  )

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  /**
   * Convert any CSS color value to a hex string for <input type="color">.
   * Native color inputs only accept #RRGGBB format.
   *
   * For rgba() values, returns a simplified hex (ignoring alpha).
   */
  function toHex(value: string): string {
    if (!value) return "#000000"
    // Already hex
    if (value.startsWith("#")) {
      // Pad short hex (e.g. #abc → #aabbcc)
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      }
      return value.substring(0, 7)
    }
    // rgba(r, g, b, a) → extract RGB
    const rgbaMatch = value.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
    )
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0")
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0")
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0")
      return `#${r}${g}${b}`
    }
    return "#000000"
  }

  /** Render a group of color picker rows */
  function renderColorGroup(title: string, fields: ColorField[]) {
    if (!editingTheme) return null

    return (
      <div className="theme-editor-group">
        <h3 className="theme-editor-group-title">{title}</h3>
        <div className="theme-editor-fields">
          {fields.map((field) => (
            <div key={field.token} className="theme-editor-field">
              <label className="theme-editor-label" htmlFor={`color-${field.token}`}>
                {field.label}
              </label>
              <div className="theme-editor-color-row">
                <input
                  type="color"
                  id={`color-${field.token}`}
                  value={toHex(editingTheme.tokens[field.token] || "")}
                  onChange={(e) => handleColorChange(field.token, e.target.value)}
                  disabled={editingTheme.type === "preset"}
                  className="theme-editor-color-input"
                />
                <input
                  type="text"
                  value={editingTheme.tokens[field.token] || ""}
                  onChange={(e) => handleColorChange(field.token, e.target.value)}
                  disabled={editingTheme.type === "preset"}
                  className="theme-editor-text-input"
                  spellCheck={false}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (!isThemeEditorOpen || !editingTheme) return null

  const isPreset = editingTheme.type === "preset"

  return (
    <div className="theme-editor-overlay" role="dialog" aria-modal="true" aria-label="Theme Editor">
      <div className="theme-editor-modal" ref={modalRef}>
        {/* ---- HEADER ---- */}
        <div className="theme-editor-header">
          <h2 className="theme-editor-title">Theme Editor</h2>
          <button
            className="theme-editor-close"
            onClick={handleClose}
            aria-label="Close theme editor"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* ---- BODY ---- */}
        <div className="theme-editor-body">
          {/* LEFT: Theme list + controls */}
          <div className="theme-editor-sidebar">
            {/* Theme selector list */}
            <div className="theme-editor-theme-list">
              <div className="theme-editor-list-section">
                <span className="theme-editor-list-header">Presets</span>
                {themes
                  .filter((t) => t.type === "preset")
                  .map((t) => (
                    <button
                      key={t.name}
                      className={`theme-editor-list-item ${
                        editingTheme.name === t.name ? "active" : ""
                      }`}
                      onClick={() => handleThemeSelect(t.name)}
                    >
                      <span
                        className="theme-editor-list-swatch"
                        style={{ backgroundColor: t.tokens["--bg"] }}
                      />
                      <span className="theme-editor-list-name">{t.name}</span>
                      <span className="theme-editor-list-badge">preset</span>
                    </button>
                  ))}
              </div>

              {themes.some((t) => t.type === "user") && (
                <div className="theme-editor-list-section">
                  <span className="theme-editor-list-header">Custom</span>
                  {themes
                    .filter((t) => t.type === "user")
                    .map((t) => (
                      <button
                        key={t.name}
                        className={`theme-editor-list-item ${
                          editingTheme.name === t.name ? "active" : ""
                        }`}
                        onClick={() => handleThemeSelect(t.name)}
                      >
                        <span
                          className="theme-editor-list-swatch"
                          style={{ backgroundColor: t.tokens["--bg"] }}
                        />
                        <span className="theme-editor-list-name">{t.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="theme-editor-sidebar-actions">
              <button
                className="theme-editor-btn theme-editor-btn-secondary"
                onClick={handleImport}
                title="Import theme from JSON file"
              >
                📂 Import
              </button>
            </div>
          </div>

          {/* RIGHT: Color editors */}
          <div className="theme-editor-content">
            {/* Theme name input */}
            <div className="theme-editor-name-row">
              <label className="theme-editor-label" htmlFor="theme-name">
                Theme Name
              </label>
              <input
                id="theme-name"
                type="text"
                className="theme-editor-name-input"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                disabled={isPreset}
                placeholder="Enter theme name"
                spellCheck={false}
              />
              {isPreset && (
                <span className="theme-editor-readonly-badge">
                  Read-only — Duplicate to edit
                </span>
              )}
            </div>

            {/* Color picker groups */}
            <div className="theme-editor-groups-scroll">
              {renderColorGroup("Core Colors", CORE_COLORS)}
              {renderColorGroup("Editor Colors", EDITOR_COLORS)}
              {renderColorGroup("Semantic Colors", SEMANTIC_COLORS)}
            </div>

            {/* Error message */}
            {error && (
              <div className="theme-editor-error">{error}</div>
            )}
          </div>
        </div>

        {/* ---- FOOTER ---- */}
        <div className="theme-editor-footer">
          <div className="theme-editor-footer-left">
            <button
              className="theme-editor-btn theme-editor-btn-secondary"
              onClick={handleDuplicate}
              title="Create a copy of this theme"
            >
              📋 Duplicate
            </button>
            {!isPreset && (
              <>
                <button
                  className="theme-editor-btn theme-editor-btn-secondary"
                  onClick={handleReset}
                  title="Reset all colors to defaults"
                >
                  ↺ Reset
                </button>
                <button
                  className="theme-editor-btn theme-editor-btn-secondary"
                  onClick={handleExport}
                  title="Export theme as JSON file"
                >
                  💾 Export
                </button>
                <button
                  className="theme-editor-btn theme-editor-btn-danger"
                  onClick={handleDelete}
                  title="Delete this theme"
                >
                  🗑 Delete
                </button>
              </>
            )}
          </div>

          <div className="theme-editor-footer-right">
            <button
              className="theme-editor-btn theme-editor-btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            {!isPreset && (
              <button
                className="theme-editor-btn theme-editor-btn-primary"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
              >
                {saving ? "Saving..." : "Save Theme"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
