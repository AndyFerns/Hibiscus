/**
 * ============================================================================
 * TopBar Component
 * ============================================================================
 * 
 * The application header bar containing:
 * - Brand/logo on the left
 * - Workspace path and change button on the right
 * 
 * This component is rendered in the Workbench's top slot.
 * ============================================================================
 */

import "./TopBar.css"

/**
 * TopBar Props Interface
 * @property workspaceRoot - Current workspace directory path (null if none selected)
 * @property onChangeWorkspace - Callback fired when user clicks "Change" button
 */
interface TopBarProps {
  workspaceRoot: string | null
  onChangeWorkspace: () => void
}

export function TopBar({
  workspaceRoot,
  onChangeWorkspace,
}: TopBarProps) {
  return (
    <div className="topbar">
      {/* Left side: Brand/Logo */}
      <div className="topbar-brand">
        <span className="topbar-brand-icon">🌺</span>
        <span className="topbar-brand-text">Hibiscus</span>
      </div>

      {/* Right side: Workspace info and actions */}
      <div className="topbar-workspace">
        {workspaceRoot ? (
          <>
            <span className="topbar-workspace-label">Workspace:</span>
            <span className="topbar-workspace-path" title={workspaceRoot}>
              {workspaceRoot}
            </span>
          </>
        ) : (
          <span className="topbar-workspace-empty">No workspace selected</span>
        )}
        
        {/* Change workspace button */}
        <button 
          className="topbar-button"
          onClick={onChangeWorkspace}
          aria-label="Change workspace directory"
        >
          Change
        </button>
      </div>
    </div>
  )
}

