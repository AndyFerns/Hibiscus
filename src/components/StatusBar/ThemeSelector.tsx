/**
 * ============================================================================
 * ThemeSelector — Status Bar Theme Switcher
 * ============================================================================
 *
 * Dropdown selector in the status bar for quick theme switching.
 * Shows both preset and user themes with distinct sections.
 *
 * FEATURES:
 * - Instant theme switching (no delay)
 * - Preset vs. User theme sections
 * - Active theme indicator (checkmark)
 * - "Edit Theme..." action opens the Theme Editor modal
 * - Click-outside closes dropdown
 *
 * CHANGES (v0.5.0):
 * - Now uses ThemeContext instead of hardcoded BUILT_IN_THEMES
 * - Supports user themes with section headers
 * - Added "Edit Theme..." and "Import..." actions
 * ============================================================================
 */

import { useState, useRef, useEffect } from "react"
import { useTheme } from "../../state/ThemeContext"
import { openImportDialog } from "../../state/themeIO"
import "./ThemeSelector.css"

import { Icons } from "../Icons/icons"

export function ThemeSelector() {
  const {
    themes,
    activeThemeName,
    setTheme,
    setThemeEditorOpen,
    saveUserTheme,
  } = useTheme()

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Find the active theme for the swatch color
  const activeTheme = themes.find((t) => t.name === activeThemeName)
  const swatchColor = activeTheme?.tokens["--bg"] || "#0a0d12"
  const displayName = activeThemeName.charAt(0).toUpperCase() + activeThemeName.slice(1)

  // Split themes into categories
  const presetThemes = themes.filter((t) => t.type === "preset")
  const userThemes = themes.filter((t) => t.type === "user")

  /** Handle selecting a theme */
  const handleSelect = (name: string) => {
    setTheme(name)
    setIsOpen(false)
  }

  /** Handle "Edit Theme..." click */
  const handleEdit = () => {
    setIsOpen(false)
    setThemeEditorOpen(true)
  }

  /** Handle import */
  const handleImport = async () => {
    setIsOpen(false)
    const imported = await openImportDialog()
    if (imported) {
      await saveUserTheme(imported)
      setTheme(imported.name)
    }
  }

  return (
    <div className="theme-selector-container" ref={containerRef}>
      <button
        className="theme-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Change Theme"
      >
        <div
          className="theme-swatch"
          style={{
            backgroundColor: swatchColor,
            border:
              activeThemeName === "dawn"
                ? "1px solid #ccc"
                : "1px solid transparent",
          }}
        />
        <span className="theme-name">{displayName}</span>
      </button>

      {isOpen && (
        <div className="theme-dropdown">
          {/* Preset themes section */}
          <div className="theme-dropdown-header">Presets</div>
          {presetThemes.map((t) => (
            <button
              key={t.name}
              className={`theme-option ${activeThemeName === t.name ? "active" : ""}`}
              onClick={() => handleSelect(t.name)}
            >
              <div
                className="theme-swatch"
                style={{
                  backgroundColor: t.tokens["--bg"],
                  border:
                    t.name === "dawn" ? "1px solid #ccc" : "none",
                }}
              />
              <span className="theme-option-name">
                {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
              </span>
              {activeThemeName === t.name && (
                <span className="theme-option-check">✓</span>
              )}
            </button>
          ))}

          {/* User themes section */}
          {userThemes.length > 0 && (
            <>
              <div className="theme-dropdown-header">Custom</div>
              {userThemes.map((t) => (
                <button
                  key={t.name}
                  className={`theme-option ${activeThemeName === t.name ? "active" : ""}`}
                  onClick={() => handleSelect(t.name)}
                >
                  <div
                    className="theme-swatch"
                    style={{ backgroundColor: t.tokens["--bg"] }}
                  />
                  <span className="theme-option-name">{t.name}</span>
                  {activeThemeName === t.name && (
                    <span className="theme-option-check">✓</span>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Actions divider */}
          <div className="theme-dropdown-divider" />

          {/* Action buttons */}
          <button className="theme-option theme-option-action" onClick={handleEdit}>
            <span><Icons.edit size={10} /> Edit Theme</span>
          </button>
          <button className="theme-option theme-option-action" onClick={handleImport}>
            <span><Icons.import size={10}/> Import Theme</span>
          </button>
        </div>
      )}
    </div>
  )
}
