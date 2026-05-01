/**
 * ============================================================================
 * Settings Modal — Application Preferences UI
 * ============================================================================
 *
 * Tab-based modal dialog for configuring all Hibiscus settings.
 * Follows the same modal pattern as the ThemeEditor.
 *
 * TABS:
 * - General: Default tool, focus mode behavior
 * - Pomodoro: Timer durations, auto-start, exit behavior
 * - Future: AI, Cloud, Sync (disabled with "Coming Soon" badges)
 *
 * FEATURES:
 * - Instant persistence on every change
 * - Number inputs with min/max for durations
 * - Toggle switches for booleans
 * - Select dropdowns for enum options
 * - Close on Escape or click-outside
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react"
import type { AppSettings } from "./settingsTypes"
import "./SettingsModal.css"
// import { IconMenuItem } from "@tauri-apps/api/menu"

// =============================================================================
// TYPES
// =============================================================================

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => void
  onReset: () => void
}

type SettingsTab = "general" | "pomodoro" | "future"

// =============================================================================
// COMPONENT
// =============================================================================

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdate,
  onReset,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ---- Tab definitions ----
  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: "general", label: "General", icon: "⚙️"},
    { id: "pomodoro", label: "Pomodoro", icon: "⏱️" },
    { id: "future", label: "Future", icon: "🔮" },
  ]

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="settings-modal" ref={modalRef}>
        {/* ---- HEADER ---- */}
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* ---- BODY ---- */}
        <div className="settings-body">
          {/* Tab navigation */}
          <div className="settings-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="settings-tab-icon">{tab.icon}</span>
                <span className="settings-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="settings-content">
            {activeTab === "general" && (
              <GeneralSettings settings={settings} onUpdate={onUpdate} />
            )}
            {activeTab === "pomodoro" && (
              <PomodoroSettings settings={settings} onUpdate={onUpdate} />
            )}
            {activeTab === "future" && <FutureSettings />}
          </div>
        </div>

        {/* ---- FOOTER ---- */}
        <div className="settings-footer">
          <button className="settings-btn settings-btn-danger" onClick={onReset}>
            ↺ Reset All
          </button>
          <button className="settings-btn settings-btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// GENERAL TAB
// =============================================================================

function GeneralSettings({
  settings,
  onUpdate,
}: {
  settings: AppSettings
  onUpdate: (p: Partial<AppSettings>) => void
}) {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">General</h3>

      {/* Default study tool */}
      <div className="settings-field">
        <label className="settings-label">Default Study Tool</label>
        <select
          className="settings-select"
          value={settings.general.defaultTool}
          onChange={(e) =>
            onUpdate({
              general: {
                ...settings.general,
                defaultTool: e.target.value as AppSettings["general"]["defaultTool"],
              },
            })
          }
        >
          <option value="pomodoro">Pomodoro Timer</option>
          <option value="flashcards">Flashcards</option>
          <option value="notes">Notes Synthesis</option>
          <option value="stats">Study Statistics</option>
        </select>
      </div>

      {/* Focus mode hides explorer */}
      <div className="settings-field">
        <label className="settings-label">Focus mode hides Explorer</label>
        <ToggleSwitch
          checked={settings.general.focusModeHidesExplorer}
          onChange={(v) =>
            onUpdate({
              general: { ...settings.general, focusModeHidesExplorer: v },
            })
          }
        />
      </div>

      {/* Remember right panel view */}
      <div className="settings-field">
        <label className="settings-label">Remember right panel view</label>
        <ToggleSwitch
          checked={settings.general.rememberRightPanelView}
          onChange={(v) =>
            onUpdate({
              general: { ...settings.general, rememberRightPanelView: v },
            })
          }
        />
      </div>
    </div>
  )
}

// =============================================================================
// POMODORO TAB
// =============================================================================

function PomodoroSettings({
  settings,
  onUpdate,
}: {
  settings: AppSettings
  onUpdate: (p: Partial<AppSettings>) => void
}) {
  const pomo = settings.pomodoro

  const updatePomo = (partial: Partial<AppSettings["pomodoro"]>) => {
    onUpdate({ pomodoro: { ...pomo, ...partial } })
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Pomodoro Timer</h3>

      {/* Duration fields */}
      <div className="settings-field">
        <label className="settings-label">Work Duration (min)</label>
        <input
          type="number"
          className="settings-number"
          value={pomo.workDuration}
          min={1}
          max={120}
          onChange={(e) => updatePomo({ workDuration: Number(e.target.value) })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-label">Break Duration (min)</label>
        <input
          type="number"
          className="settings-number"
          value={pomo.breakDuration}
          min={1}
          max={30}
          onChange={(e) => updatePomo({ breakDuration: Number(e.target.value) })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-label">Long Break Duration (min)</label>
        <input
          type="number"
          className="settings-number"
          value={pomo.longBreakDuration}
          min={1}
          max={60}
          onChange={(e) => updatePomo({ longBreakDuration: Number(e.target.value) })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-label">Sessions before Long Break</label>
        <input
          type="number"
          className="settings-number"
          value={pomo.sessionsBeforeLongBreak}
          min={1}
          max={10}
          onChange={(e) =>
            updatePomo({ sessionsBeforeLongBreak: Number(e.target.value) })
          }
        />
      </div>

      <div className="settings-divider" />

      {/* Behavior toggles */}
      <div className="settings-field">
        <label className="settings-label">Auto-start next session</label>
        <ToggleSwitch
          checked={pomo.autoStartNextSession}
          onChange={(v) => updatePomo({ autoStartNextSession: v })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-label">Auto-enter Focus Mode</label>
        <ToggleSwitch
          checked={pomo.autoEnterFocusMode}
          onChange={(v) => updatePomo({ autoEnterFocusMode: v })}
        />
      </div>

      <div className="settings-field">
        <label className="settings-label">When timer ends</label>
        <select
          className="settings-select"
          value={pomo.onTimerEnd}
          onChange={(e) =>
            updatePomo({
              onTimerEnd: e.target.value as AppSettings["pomodoro"]["onTimerEnd"],
            })
          }
        >
          <option value="exit-focus">Exit Focus Mode</option>
          <option value="stop-timer">Stop Timer</option>
          <option value="both">Both</option>
        </select>
      </div>
    </div>
  )
}

// =============================================================================
// FUTURE TAB (stubs)
// =============================================================================

function FutureSettings() {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Upcoming Features</h3>
      <p className="settings-description">
        These features are planned for future releases and are not yet available.
      </p>

      <div className="settings-field settings-field-disabled">
        <label className="settings-label">
          AI Summarization
          <span className="settings-badge">Coming Soon</span>
        </label>
        <ToggleSwitch checked={false} onChange={() => {}} disabled />
      </div>

      <div className="settings-field settings-field-disabled">
        <label className="settings-label">
          Cloud Sync
          <span className="settings-badge">Coming Soon</span>
        </label>
        <ToggleSwitch checked={false} onChange={() => {}} disabled />
      </div>

      <div className="settings-field settings-field-disabled">
        <label className="settings-label">
          Multi-device Sync
          <span className="settings-badge">Coming Soon</span>
        </label>
        <ToggleSwitch checked={false} onChange={() => {}} disabled />
      </div>
    </div>
  )
}

// =============================================================================
// TOGGLE SWITCH (reusable)
// =============================================================================

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      className={`settings-toggle ${checked ? "on" : ""} ${disabled ? "disabled" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
    >
      <span className="settings-toggle-thumb" />
    </button>
  )
}
