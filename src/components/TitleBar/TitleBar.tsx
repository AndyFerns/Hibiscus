/**
 * ============================================================================
 * TitleBar Component
 * ============================================================================
 * 
 * Application menu bar with VSCode-style dropdown menus.
 * Sits below the native OS window titlebar for reliable cross-platform support.
 * 
 * LAYOUT:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 🌺 │ File  Edit  Selection  View  Tools  Help │    Hibiscus — Workspace │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * FEATURES:
 * - VSCode-style dropdown menu system
 * - Menu sections: File, Edit, Selection, View, Tools, Help
 * - Centered app title with workspace name
 * - Connected actions for Open Folder, panel toggles, etc.
 * 
 * NOTE: Window controls (minimize, maximize, close) are handled by the
 * native OS window decorations for maximum reliability and cross-platform
 * compatibility.
 * ============================================================================
 */

import { useState, useRef, useEffect } from "react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { WindowControls } from "./WindowControls"
import { useTheme } from "../../state/ThemeContext"
import "./TitleBar.css"

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
 * TitleBar Props Interface
 */
interface TitleBarProps {
    /** Current workspace root path */
    workspaceRoot: string | null
    /** Callback to open a folder */
    onOpenFolder: () => void
    /** Callback to toggle left panel visibility */
    onToggleLeftPanel?: () => void
    /** Callback to toggle right panel visibility */
    onToggleRightPanel?: () => void
    /** Whether left panel is visible */
    showLeftPanel?: boolean
    /** Whether right panel is visible */
    showRightPanel?: boolean
    /** Callback to save current file */
    onSave?: () => void
    /** Callback to open a study tool panel */
    onOpenStudyTool?: (tool: "pomodoro" | "flashcards" | "notes" | "stats") => void
    /** Callback to toggle focus mode */
    onToggleFocusMode?: () => void
    /** Whether focus mode is active */
    focusMode?: boolean
    /** Callback to open settings */
    onOpenSettings?: () => void
}

export function TitleBar({
    workspaceRoot,
    onOpenFolder,
    onToggleLeftPanel,
    onToggleRightPanel,
    showLeftPanel = true,
    showRightPanel = false,
    onSave,
    onOpenStudyTool,
    onToggleFocusMode,
    focusMode = false,
    onOpenSettings,
}: TitleBarProps) {
    // Track which menu is currently open
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const { setThemeEditorOpen } = useTheme()

    /**
     * Menu sections configuration
     * Actions are connected to props callbacks where applicable
     */
    const menuSections: MenuSection[] = [
        {
            label: "File",
            items: [
                { label: "New File", shortcut: "Ctrl+N" },
                { label: "New Folder", shortcut: "Ctrl+Shift+N" },
                { divider: true, label: "" },
                { label: "Open File...", shortcut: "Ctrl+O" },
                {
                    label: "Open Folder...",
                    shortcut: "Ctrl+K Ctrl+O",
                    action: onOpenFolder,
                },
                { label: "Open Recent", shortcut: "→" },
                { divider: true, label: "" },
                { label: "Save", shortcut: "Ctrl+S", action: onSave },
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
                {
                    label: showLeftPanel ? "Hide Explorer" : "Show Explorer",
                    shortcut: "Ctrl+B",
                    action: onToggleLeftPanel,
                },
                {
                    label: showRightPanel ? "Hide Calendar" : "Show Calendar",
                    shortcut: "Ctrl+Shift+C",
                    action: onToggleRightPanel,
                },
                { divider: true, label: "" },
                { label: "Word Wrap" },
                { label: "Minimap" },
                { label: "Breadcrumbs" },
                { divider: true, label: "" },
                { label: "Zoom In", shortcut: "Ctrl+=" },
                { label: "Zoom Out", shortcut: "Ctrl+-" },
                { label: "Reset Zoom", shortcut: "Ctrl+0" },
                { divider: true, label: "" },
                {
                    label: "Theme...",
                    action: () => setThemeEditorOpen(true),
                },
            ],
        },
        {
            label: "Tools",
            items: [
                { label: "Pomodoro Timer", shortcut: "Ctrl+Alt+P", action: () => onOpenStudyTool?.("pomodoro") },
                { label: "Flashcards", shortcut: "Ctrl+Alt+F", action: () => onOpenStudyTool?.("flashcards") },
                { label: "Notes Synthesis", shortcut: "Ctrl+Alt+N", action: () => onOpenStudyTool?.("notes") },
                { label: "Study Statistics", action: () => onOpenStudyTool?.("stats") },
                { divider: true, label: "" },
                { label: focusMode ? "Exit Focus Mode" : "Focus Mode", shortcut: "Ctrl+Shift+F", action: onToggleFocusMode },
                { divider: true, label: "" },
                { label: "Settings", shortcut: "Ctrl+,", action: onOpenSettings },
                { label: "Keyboard Shortcuts", shortcut: "Ctrl+K Ctrl+S" },
            ],
        },
        {
            label: "Help",
            items: [
                { label: "Welcome" },
                { label: "Documentation", action: () => openUrl("https://andyferns.github.io/Hibiscus/") },
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

    /**
     * Extract workspace folder name from path
     */
    const workspaceName = workspaceRoot
        ? workspaceRoot.split(/[/\\]/).pop()
        : null

    return (
        <div className="titlebar">
            {/* ----------------------------------------------------------------
       * LEFT SECTION: Logo + Menu Items
       * ---------------------------------------------------------------- */}
            <div className="titlebar-left" ref={menuRef}>
                {/* Logo */}
                <div className="titlebar-logo">
                    <span className="titlebar-logo-icon">🌺</span>
                </div>

                {/* Menu sections */}
                <nav className="titlebar-menu" role="menubar">
                    {menuSections.map((section) => (
                        <div
                            key={section.label}
                            className={`titlebar-menu-section ${activeMenu === section.label ? "active" : ""}`}
                        >
                            <button
                                className="titlebar-menu-trigger"
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
                                <div className="titlebar-dropdown" role="menu">
                                    {section.items.map((item, index) => (
                                        item.divider ? (
                                            <div key={index} className="titlebar-dropdown-divider" role="separator" />
                                        ) : (
                                            <button
                                                key={index}
                                                className={`titlebar-dropdown-item ${item.disabled ? "disabled" : ""}`}
                                                onClick={() => handleMenuItemClick(item)}
                                                disabled={item.disabled}
                                                role="menuitem"
                                            >
                                                <span className="titlebar-dropdown-label">{item.label}</span>
                                                {item.shortcut && (
                                                    <span className="titlebar-dropdown-shortcut">{item.shortcut}</span>
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
       * CENTER SECTION: App Title (Inherits drag from parent)
       * ---------------------------------------------------------------- */}
            <div className="titlebar-center">
                <span className="titlebar-title">Hibiscus</span>
                {workspaceName && (
                    <span className="titlebar-subtitle">
                        — {workspaceName}
                    </span>
                )}
            </div>

            {/* ----------------------------------------------------------------
       * RIGHT SECTION: Window Controls
       * ---------------------------------------------------------------- */}
            <div className="titlebar-right">
                <WindowControls />
            </div>
        </div>
    )
}
