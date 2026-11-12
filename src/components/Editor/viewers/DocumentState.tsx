/**
 * Loading and failure states for the document viewers.
 *
 * A file that fails the integrity check (truncated, wrong type, broken zip)
 * gets a clear explanation instead of a blank pane or a crashed viewer, with
 * options to retry, try rendering anyway, or reveal it in the file manager.
 */

import { revealItemInDir } from "@tauri-apps/plugin-opener"
import type { DocumentReport } from "../../../utils/fileLoader"

export function DocumentLoading({ label = "Loading document…" }: { label?: string }) {
  return (
    <div className="docv-state" role="status" aria-live="polite">
      <div className="docv-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentErrorState({
  path,
  title,
  reason,
  report,
  onRetry,
  onOpenAnyway,
}: {
  path: string
  title: string
  reason: string | null
  report?: DocumentReport | null
  onRetry?: () => void
  onOpenAnyway?: () => void
}) {
  const reveal = () => {
    revealItemInDir(path).catch((e) => console.warn("[Hibiscus] Reveal failed:", e))
  }

  return (
    <div className="docv-state docv-state--error" role="alert">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M12 12v3M12 18h.01" />
      </svg>
      <h3 className="docv-state-title">{title}</h3>
      {reason && <p className="docv-state-reason">{reason}</p>}
      {report && (
        <dl className="docv-state-meta">
          <dt>Size</dt>
          <dd>{formatBytes(report.size)}</dd>
          <dt>Detected</dt>
          <dd>{report.kind}</dd>
          <dt>SHA-256</dt>
          <dd title={report.sha256}>{report.sha256.slice(0, 16)}…</dd>
        </dl>
      )}
      <div className="docv-state-actions">
        {onRetry && (
          <button className="docv-action" onClick={onRetry}>
            Retry
          </button>
        )}
        {onOpenAnyway && (
          <button className="docv-action" onClick={onOpenAnyway} title="Some viewers can recover partially damaged files">
            Try to open anyway
          </button>
        )}
        <button className="docv-action" onClick={reveal}>
          Show in folder
        </button>
      </div>
    </div>
  )
}
