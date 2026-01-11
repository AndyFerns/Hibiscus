export function TopBar({
  workspaceRoot,
  onChangeWorkspace,
}: {
  workspaceRoot: string | null
  onChangeWorkspace: () => void
}) {
  return (
    <div className="topbar">
      <span className="brand">🌿 Hibiscus</span>

      <div className="workspace">
        {workspaceRoot
          ? <>Workspace: <strong>{workspaceRoot}</strong></>
          : <em>No workspace selected</em>}
        <button onClick={onChangeWorkspace}>Change</button>
      </div>
    </div>
  )
}
