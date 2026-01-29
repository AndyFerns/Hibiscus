/**
 * ============================================================================
 * TopBar Component
 * ============================================================================
 * 
 * VSCode-style application header bar containing:
 * - Logo on the far left
 * - Menu sections (File, Edit, Selection, View, Tools, Help)
 * - Centered application title
 * - Workspace info and actions on the right
 * 
 * MENU STRUCTURE:
 * Each menu section has dropdown items defined as stubs for future implementation.
 * ============================================================================
 */

import { useState, useRef, useEffect } from "react"
import "./TopBar.css"

/**
 * Menu item definition for dropdown menus
 */
interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  divider?: boolean
  disabled?: boolean
}

/**
 * Menu section definition (File, Edit, etc.)
 */
interface MenuSection {
  label: string
  items: MenuItem[]
}

/**
 * TopBar Props Interface
 */
interface TopBarProps {
  workspaceRoot: string | null
  onChangeWorkspace: () => void
}

/**
 * Menu sections configuration with stub items
 * TODO: Connect actions to actual functionality
 */
const menuSections: MenuSection[] = [
  {
    label: "File",
    items: [
      { label: "New File", shortcut: "Ctrl+N" },
      { label: "New Folder", shortcut: "Ctrl+Shift+N" },
      { divider: true, label: "" },
      { label: "Open File...", shortcut: "Ctrl+O" },
      { label: "Open Folder...", shortcut: "Ctrl+K Ctrl+O" },
      { label: "Open Recent", shortcut: "→" },
      { divider: true, label: "" },
      { label: "Save", shortcut: "Ctrl+S" },
      { label: "Save As...", shortcut: "Ctrl+Shift+S" },
      { label: "Save All", shortcut: "Ctrl+Alt+S" },
      { divider: true, label: "" },
      { label: "Close File", shortcut: "Ctrl+W" },
      { label: "Close Folder" },
      { divider: true, label: "" },
      { label: "Exit", shortcut: "Alt+F4" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", shortcut: "Ctrl+Z" },
      { label: "Redo", shortcut: "Ctrl+Y" },
      { divider: true, label: "" },
      { label: "Cut", shortcut: "Ctrl+X" },
      { label: "Copy", shortcut: "Ctrl+C" },
      { label: "Paste", shortcut: "Ctrl+V" },
      { divider: true, label: "" },
      { label: "Find", shortcut: "Ctrl+F" },
      { label: "Replace", shortcut: "Ctrl+H" },
      { label: "Find in Files", shortcut: "Ctrl+Shift+F" },
      { divider: true, label: "" },
      { label: "Toggle Comment", shortcut: "Ctrl+/" },
      { label: "Format Document", shortcut: "Shift+Alt+F" },
    ],
  },
  {
    label: "Selection",
    items: [
      { label: "Select All", shortcut: "Ctrl+A" },
      { label: "Expand Selection", shortcut: "Shift+Alt+→" },
      { label: "Shrink Selection", shortcut: "Shift+Alt+←" },
      { divider: true, label: "" },
      { label: "Copy Line Up", shortcut: "Shift+Alt+↑" },
      { label: "Copy Line Down", shortcut: "Shift+Alt+↓" },
      { label: "Move Line Up", shortcut: "Alt+↑" },
      { label: "Move Line Down", shortcut: "Alt+↓" },
      { divider: true, label: "" },
      { label: "Add Cursor Above", shortcut: "Ctrl+Alt+↑" },
      { label: "Add Cursor Below", shortcut: "Ctrl+Alt+↓" },
      { label: "Select All Occurrences", shortcut: "Ctrl+Shift+L" },
    ],
  },
  {
    label: "View",
    items: [
      { label: "Command Palette", shortcut: "Ctrl+Shift+P" },
      { label: "Open View...", shortcut: "Ctrl+Q" },
      { divider: true, label: "" },
      { label: "Explorer", shortcut: "Ctrl+Shift+E" },
      { label: "Search", shortcut: "Ctrl+Shift+F" },
      { label: "Calendar", shortcut: "Ctrl+Shift+C" },
      { divider: true, label: "" },
      { label: "Word Wrap" },
      { label: "Minimap" },
      { label: "Breadcrumbs" },
      { divider: true, label: "" },
      { label: "Zoom In", shortcut: "Ctrl+=" },
      { label: "Zoom Out", shortcut: "Ctrl+-" },
      { label: "Reset Zoom", shortcut: "Ctrl+0" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Pomodoro Timer", shortcut: "Ctrl+Alt+P" },
      { label: "Flashcards", shortcut: "Ctrl+Alt+F" },
      { label: "Notes", shortcut: "Ctrl+Alt+N" },
      { divider: true, label: "" },
      { label: "Study Statistics" },
      { label: "Progress Tracker" },
      { divider: true, label: "" },
      { label: "Settings", shortcut: "Ctrl+," },
      { label: "Keyboard Shortcuts", shortcut: "Ctrl+K Ctrl+S" },
      { label: "Extensions" },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "Welcome" },
      { label: "Documentation" },
      { label: "Keyboard Shortcuts Reference" },
      { divider: true, label: "" },
      { label: "Release Notes" },
      { label: "Report Issue" },
      { divider: true, label: "" },
      { label: "Check for Updates" },
      { label: "About Hibiscus" },
    ],
  },
]

export function TopBar({
  workspaceRoot,
  onChangeWorkspace,
}: TopBarProps) {
  // Track which menu is currently open
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  /**
   * Handle menu item click
   */
  const handleMenuItemClick = (item: MenuItem) => {
    if (item.action && !item.disabled) {
      item.action()
    }
    setActiveMenu(null)
  }

  return (
    <div className="topbar">
      {/* ----------------------------------------------------------------
       * LEFT SECTION: Logo + Menu Items
       * ---------------------------------------------------------------- */}
      <div className="topbar-left" ref={menuRef}>
        {/* Logo */}
        <div className="topbar-logo">
          <span className="topbar-logo-icon">🌺</span>
        </div>

        {/* Menu sections */}
        <nav className="topbar-menu" role="menubar">
          {menuSections.map((section) => (
            <div
              key={section.label}
              className={`topbar-menu-section ${activeMenu === section.label ? "active" : ""}`}
            >
              <button
                className="topbar-menu-trigger"
                onClick={() => setActiveMenu(activeMenu === section.label ? null : section.label)}
                onMouseEnter={() => activeMenu && setActiveMenu(section.label)}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={activeMenu === section.label}
              >
                {section.label}
              </button>

              {/* Dropdown menu */}
              {activeMenu === section.label && (
                <div className="topbar-dropdown" role="menu">
                  {section.items.map((item, index) => (
                    item.divider ? (
                      <div key={index} className="topbar-dropdown-divider" role="separator" />
                    ) : (
                      <button
                        key={index}
                        className={`topbar-dropdown-item ${item.disabled ? "disabled" : ""}`}
                        onClick={() => handleMenuItemClick(item)}
                        disabled={item.disabled}
                        role="menuitem"
                      >
                        <span className="topbar-dropdown-label">{item.label}</span>
                        {item.shortcut && (
                          <span className="topbar-dropdown-shortcut">{item.shortcut}</span>
                        )}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* ----------------------------------------------------------------
       * CENTER SECTION: App Title
       * ---------------------------------------------------------------- */}
      <div className="topbar-center">
        <span className="topbar-title">Hibiscus</span>
        {workspaceRoot && (
          <span className="topbar-subtitle">
            — {workspaceRoot.split(/[/\\]/).pop()}
          </span>
        )}
      </div>

      {/* ----------------------------------------------------------------
       * RIGHT SECTION: Workspace Actions
       * ---------------------------------------------------------------- */}
      <div className="topbar-right">
        {workspaceRoot ? (
          <span className="topbar-workspace-path" title={workspaceRoot}>
            📁 {workspaceRoot.split(/[/\\]/).pop()}
          </span>
        ) : (
          <span className="topbar-workspace-empty">No workspace</span>
        )}

        <button
          className="topbar-button"
          onClick={onChangeWorkspace}
          aria-label="Change workspace directory"
        >
          Open Folder
        </button>
      </div>
    </div>
  )
}


