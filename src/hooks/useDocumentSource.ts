/**
 * ============================================================================
 * useDocumentSource
 * ============================================================================
 *
 * Loads the bytes of a binary document (PDF, DOCX, PPTX, image) for a viewer,
 * with an integrity cross-check and a shared cache:
 *
 * 1. `inspect_document` (Rust) hashes the file on disk, sniffs its real type
 *    and checks its structure (truncated PDF, broken zip, missing parts).
 *    A file that fails is reported as `corrupt` with a readable reason
 *    instead of being handed to a viewer that would crash or render blank.
 * 2. The bytes are fetched with `read_file_binary` and re-hashed in the
 *    webview. If the hash differs from the one Rust computed, the transfer
 *    is retried once (the file may have changed in between), then reported.
 * 3. Verified bytes go into an LRU cache keyed by path + SHA-256, so
 *    switching back to a tab is instant and nothing is re-read or re-parsed.
 * 4. On `fs-changed` for this path the file is re-inspected; it is reloaded
 *    only if its hash actually changed.
 *
 * Consumers must treat `bytes` as read-only and give libraries that take
 * ownership of buffers (pdf.js transfers them to its worker) a copy.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import {
  inspectDocument,
  loadBinaryFile,
  sha256Hex,
  type DocumentReport,
} from "../utils/fileLoader"

export type DocumentStatus = "loading" | "ready" | "corrupt" | "error"

export interface DocumentSource {
  status: DocumentStatus
  bytes: ArrayBuffer | null
  report: DocumentReport | null
  /** Why the document can't be shown (corrupt/error states). */
  reason: string | null
  /** Stable identity of the loaded content: `${path}#${sha256}`. */
  key: string | null
  /** Re-run the inspection and load. */
  retry: () => void
  /** Skip the integrity verdict and try to render anyway. */
  openAnyway: () => void
}

// ---------------------------------------------------------------------------
// Shared LRU cache (module level, survives tab switches)
// ---------------------------------------------------------------------------

interface CacheEntry {
  sha256: string
  bytes: ArrayBuffer
  report: DocumentReport
}

const CACHE_BUDGET_BYTES = 200 * 1024 * 1024
const cache = new Map<string, CacheEntry>()
let cacheBytes = 0

function cacheGet(path: string): CacheEntry | undefined {
  const entry = cache.get(path)
  if (entry) {
    // Refresh recency
    cache.delete(path)
    cache.set(path, entry)
  }
  return entry
}

function cachePut(path: string, entry: CacheEntry): void {
  const prev = cache.get(path)
  if (prev) {
    cacheBytes -= prev.bytes.byteLength
    cache.delete(path)
  }
  // Documents bigger than the whole budget are simply not cached.
  if (entry.bytes.byteLength > CACHE_BUDGET_BYTES) return
  cache.set(path, entry)
  cacheBytes += entry.bytes.byteLength
  for (const [key, value] of cache) {
    if (cacheBytes <= CACHE_BUDGET_BYTES) break
    cache.delete(key)
    cacheBytes -= value.bytes.byteLength
  }
}

/** Test helper / memory pressure valve. */
export function clearDocumentCache(): void {
  cache.clear()
  cacheBytes = 0
}

/** Exposed for tests. */
export function documentCacheSize(): number {
  return cache.size
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

type LoadResult =
  | { status: "ready"; entry: CacheEntry }
  | { status: "corrupt"; report: DocumentReport; reason: string }

/**
 * Inspect + fetch + verify one document. Exported for unit tests.
 * `force` skips the structural verdict (but not the transfer check).
 */
export async function loadVerifiedDocument(path: string, force = false): Promise<LoadResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const report = await inspectDocument(path)

    const cached = cacheGet(path)
    if (cached && cached.sha256 === report.sha256) {
      return { status: "ready", entry: { ...cached, report } }
    }

    if (!report.ok && !force) {
      return { status: "corrupt", report, reason: report.reason ?? "The file appears to be damaged." }
    }

    const bytes = await loadBinaryFile(path)
    const received = await sha256Hex(bytes)
    if (received === report.sha256) {
      const entry = { sha256: report.sha256, bytes, report }
      cachePut(path, entry)
      return { status: "ready", entry }
    }
    // Mismatch: the file may have been rewritten between inspect and read.
    // Loop once to re-inspect; a second mismatch is a real transfer fault.
  }

  const report = await inspectDocument(path)
  return {
    status: "corrupt",
    report,
    reason:
      "The file changed or was damaged while it was being read (its checksum didn't match). Try again.",
  }
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, "/") === b.replace(/\\/g, "/")
}

export function useDocumentSource(path: string): DocumentSource {
  const [state, setState] = useState<Omit<DocumentSource, "retry" | "openAnyway">>(() => {
    const cached = cache.get(path)
    return cached
      ? { status: "ready", bytes: cached.bytes, report: cached.report, reason: null, key: `${path}#${cached.sha256}` }
      : { status: "loading", bytes: null, report: null, reason: null, key: null }
  })
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)
  const currentShaRef = useRef<string | null>(cache.get(path)?.sha256 ?? null)

  // Reset synchronously when the path changes so a viewer never renders the
  // previous document's bytes under the new path.
  const pathRef = useRef(path)
  if (pathRef.current !== path) {
    pathRef.current = path
    forceRef.current = false
    const cached = cache.get(path)
    currentShaRef.current = cached?.sha256 ?? null
    const next = cached
      ? { status: "ready" as const, bytes: cached.bytes, report: cached.report, reason: null, key: `${path}#${cached.sha256}` }
      : { status: "loading" as const, bytes: null, report: null, reason: null, key: null }
    // Safe: setState during render for derived state.
    setState(next)
  }

  useEffect(() => {
    let cancelled = false
    const force = forceRef.current

    if (!currentShaRef.current) {
      setState((s) => (s.status === "loading" ? s : { status: "loading", bytes: null, report: null, reason: null, key: null }))
    }

    loadVerifiedDocument(path, force)
      .then((result) => {
        if (cancelled) return
        if (result.status === "ready") {
          const { entry } = result
          if (currentShaRef.current === entry.sha256) {
            // Unchanged content: keep the same buffer identity, no re-render of the document.
            setState((s) => (s.report === entry.report ? s : { ...s, report: entry.report }))
            return
          }
          currentShaRef.current = entry.sha256
          setState({
            status: "ready",
            bytes: entry.bytes,
            report: entry.report,
            reason: null,
            key: `${path}#${entry.sha256}`,
          })
        } else {
          currentShaRef.current = null
          setState({ status: "corrupt", bytes: null, report: result.report, reason: result.reason, key: null })
        }
      })
      .catch((error) => {
        if (cancelled) return
        currentShaRef.current = null
        setState({
          status: "error",
          bytes: null,
          report: null,
          reason: String(error),
          key: null,
        })
      })

    return () => {
      cancelled = true
    }
  }, [path, nonce])

  // Re-verify when this file changes on disk; only reload if its hash moved.
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let disposed = false
    listen<string[]>("fs-changed", (event) => {
      if (event.payload.some((p) => samePath(p, path))) setNonce((n) => n + 1)
    }).then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [path])

  const retry = useCallback(() => {
    forceRef.current = false
    currentShaRef.current = null
    setNonce((n) => n + 1)
  }, [])

  const openAnyway = useCallback(() => {
    forceRef.current = true
    currentShaRef.current = null
    setNonce((n) => n + 1)
  }, [])

  return { ...state, retry, openAnyway }
}
