/**
 * ============================================================================  
 * FileRenderer Component
 * ============================================================================
 * 
 * Renders different file types inside the editor based on file extension.
 * Supports Markdown, PDF, DOCX, and PPTX with Monaco as fallback.
 * 
 * MARKDOWN RENDERING:
 * Markdown files are now rendered INLINE within Monaco via the
 * MarkdownInlineDecorator engine (Obsidian-style live preview).
 * The old split-pane ReactMarkdown preview has been removed.
 * Monaco occupies 100% width for .md files.
 * 
 * This component integrates with the existing data flow using:
 * - buffersRef for file content cache
 * - openFiles for file metadata
 * - fileLoader for unified binary/text reading
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Document, Page, pdfjs } from 'react-pdf'
import mammoth from 'mammoth'
import { loadBinaryFile } from '../../utils/fileLoader'
import { sanitizeDocxHtml } from './docxSanitizer'
import './FileRenderer.css'

// Import react-pdf required styles
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

// ---------------------------------------------------------------------------
// PDF.js Worker Setup — LOCAL, no CDN
// ---------------------------------------------------------------------------
// pdfjs-dist v5 uses .mjs files. Vite's ?url suffix gives us the local asset
// path at build time, avoiding CORS errors from unpkg/cdnjs.
// ---------------------------------------------------------------------------
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * File type detection from file path extension
 * Derives type ONLY from file path as required
 */
function getFileType(path: string): 'markdown' | 'pdf' | 'docx' | 'pptx' | 'monaco' {
  const ext = path.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'md':
      return 'markdown'
    case 'pdf':
      return 'pdf'
    case 'docx':
      return 'docx'
    case 'pptx':
      return 'pptx'
    default:
      return 'monaco'
  }
}

/**
 * Props for FileRenderer component
 * 
 * NOTE: showMarkdownPreview has been replaced by markdownViewMode.
 * Markdown files are always rendered inline via Monaco + MarkdownInlineDecorator.
 * The markdownViewMode ("live-preview" | "source") is handled upstream in
 * EditorView — this component no longer needs to manage the preview pane.
 */
interface FileRendererProps {
  file: { path: string }
  content: string
  children: React.ReactNode
  markdownViewMode?: "live-preview" | "source"
  /** Opens a file in the editor — used to jump to a freshly extracted note. */
  onOpenFile?: (path: string) => void
}

/**
 * Toolbar shown above read-only document viewers (PDF / DOCX).
 *
 * Two jobs: state plainly that the document cannot be edited in place (it is
 * otherwise indistinguishable from an editable file, and users reasonably
 * expect Ctrl+S to work), and offer the supported alternative — extract the
 * text into a Markdown note that *is* editable and gets indexed.
 */
function DocumentToolbar({
  file,
  kind,
  onOpenFile,
}: {
  file: { path: string }
  kind: 'PDF' | 'Word document'
  onOpenFile?: (path: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const extract = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const notePath = await invoke<string>('extract_document_to_note', {
        sourcePath: file.path,
      })
      const name = notePath.split(/[/\\]/).pop() || notePath
      setMessage(`Created ${name}`)
      onOpenFile?.(notePath)
    } catch (err) {
      console.error('[Hibiscus] Extraction failed:', err)
      setMessage(typeof err === 'string' ? err : 'Could not extract text')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="doc-toolbar">
      <span className="doc-toolbar-badge" title={`${kind}s are opened read-only`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>Read-only</span>
      </span>

      <span className="doc-toolbar-hint">
        {kind}s can't be edited in place
      </span>

      {message && <span className="doc-toolbar-message">{message}</span>}

      <button
        className="doc-toolbar-action"
        onClick={extract}
        disabled={busy}
        title="Extract the text into an editable Markdown note beside this file"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M12 18v-6M9 15l3 3 3-3" />
        </svg>
        <span>{busy ? 'Extracting…' : 'Extract to note'}</span>
      </button>
    </div>
  )
}

/**
 * PDF Viewer Component
 * Uses react-pdf with local worker and Tauri binary reading.
 * Worker is loaded from node_modules (no CDN/CORS issues).
 */
function PdfViewer({ file }: { file: { path: string } }) {
  const [pdfData, setPdfData] = useState<{ data: Uint8Array } | null>(null)
  const [error, setError] = useState<string>('')
  const [numPages, setNumPages] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      try {
        // Read binary via unified loader
        const arrayBuffer = await loadBinaryFile(file.path)

        if (cancelled) return

        // Pass raw bytes to react-pdf (avoids Blob URL lifecycle issues)
        setPdfData({ data: new Uint8Array(arrayBuffer) })
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load PDF file')
          console.error('[Hibiscus] PDF loading error:', err)
        }
      }
    }

    // Reset state for new file
    setPdfData(null)
    setNumPages(0)
    setError('')
    loadPdf()

    return () => { cancelled = true }
  }, [file.path])

  // Size pages to the actual container, not the window. The editor pane is
  // resizable and can be split, so a window-derived width overflowed or
  // under-filled it and never responded to panel drags.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (width > 0) setContainerWidth(width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [pdfData])

  // Reload when the file changes on disk (the watcher drives this).
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<string[]>('fs-changed', (event) => {
      const changed = event.payload.some(
        (p) => p.replace(/\\/g, '/') === file.path.replace(/\\/g, '/')
      )
      if (changed) {
        loadBinaryFile(file.path)
          .then((buf) => setPdfData({ data: new Uint8Array(buf) }))
          .catch(() => { /* file may be mid-write; the next event will retry */ })
      }
    }).then((fn) => (unlisten = fn))
    return () => { if (unlisten) unlisten() }
  }, [file.path])

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        {error}
      </div>
    )
  }

  if (!pdfData) {
    return (
      <div style={{ 
        padding: '20px', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        Loading PDF…
      </div>
    )
  }

  // Leave room for the scrollbar and a little breathing space around the page.
  const pageWidth = containerWidth > 0 ? Math.max(240, containerWidth - 48) : undefined

  return (
    <div
      ref={containerRef}
      className="pdf-viewer"
      style={{
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <Document
        file={pdfData}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={<div style={{ padding: '20px' }}>Loading PDF…</div>}
        error={<div style={{ padding: '20px', color: 'var(--error)' }}>Failed to load PDF</div>}
      >
        {/* Render every page. Previously only page 1 was shown, so multi-page
            documents appeared truncated with no way to reach the rest. */}
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i + 1} className="pdf-page">
            <Page
              pageNumber={i + 1}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              width={pageWidth}
            />
            <div className="pdf-page-label">
              Page {i + 1} of {numPages}
            </div>
          </div>
        ))}
      </Document>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DOCX HTML Cache — persists across re-renders to avoid re-conversion
// ---------------------------------------------------------------------------
const docxCache = new Map<string, string>()

/**
 * DOCX Viewer Component
 * Uses mammoth to convert DOCX to HTML.
 *
 * CRITICAL FIX: Tauri's read_file_binary returns Vec<u8> serialized as
 * JSON number[]. We use loadBinaryFile() which converts to ArrayBuffer
 * via new Uint8Array(bytes).buffer before passing to mammoth.
 */
function DocxViewer({ file }: { file: { path: string } }) {
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  const convertDocx = useCallback(async (opts?: { bypassCache?: boolean }) => {
    try {
      setLoading(true)
      setError('')

      // Check cache first — avoid re-converting on tab switch
      if (!opts?.bypassCache) {
        const cached = docxCache.get(file.path)
        if (cached !== undefined) {
          setHtmlContent(cached)
          setLoading(false)
          return
        }
      }

      // Read binary via unified loader (returns real ArrayBuffer)
      const arrayBuffer = await loadBinaryFile(file.path)

      // mammoth expects { arrayBuffer: ArrayBuffer }
      const result = await mammoth.convertToHtml({ arrayBuffer })

      // Cache and display (sanitized — see sanitizeDocxHtml)
      const safeHtml = sanitizeDocxHtml(result.value)
      docxCache.set(file.path, safeHtml)
      setHtmlContent(safeHtml)

      if (result.messages.length > 0) {
        console.warn('[Hibiscus] DOCX conversion warnings:', result.messages)
      }
    } catch (err) {
      setError('Failed to load DOCX file. The file may be corrupted.')
      console.error('[Hibiscus] DOCX loading error:', err)
    } finally {
      setLoading(false)
    }
  }, [file.path])

  useEffect(() => {
    convertDocx()
  }, [convertDocx])

  // Invalidate on external change. The cache previously had no invalidation at
  // all, so editing a .docx in Word left the viewer showing stale content for
  // the rest of the session.
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<string[]>('fs-changed', (event) => {
      const changed = event.payload.some(
        (p) => p.replace(/\\/g, '/') === file.path.replace(/\\/g, '/')
      )
      if (changed) {
        docxCache.delete(file.path)
        convertDocx({ bypassCache: true })
      }
    }).then((fn) => (unlisten = fn))
    return () => { if (unlisten) unlisten() }
  }, [file.path, convertDocx])

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        Loading DOCX…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        {error}
      </div>
    )
  }

  return (
    <div className="docx-viewer">
      <div
        className="docx-page"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}

/**
 * PPTX Viewer Component
 * Minimal fallback preview as specified
 */
function PptxViewer() {
  return (
    <div style={{ 
      padding: '20px', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: 'var(--text-secondary)'
    }}>
      Preview not supported yet
    </div>
  )
}

/**
 * Main FileRenderer Component
 * 
 * KEY CHANGE: Markdown files no longer have a split-pane layout.
 * The ReactMarkdown preview pane has been removed entirely.
 * Monaco now occupies 100% of the editor width for .md files,
 * with inline live preview handled by MarkdownInlineDecorator
 * (managed in EditorView.tsx).
 */
export function FileRenderer({ file, content: _content, children, markdownViewMode: _markdownViewMode = "live-preview", onOpenFile }: FileRendererProps) {
  const fileType = getFileType(file.path)

  // Is this an editable text file? (Not a binary/document format)
  const isEditable = !['pdf', 'docx', 'pptx'].includes(fileType)

  return (
    <>
      {/* 
        CRITICAL: ALWAYS render the editor children in the exact same DOM tree position.
        Switching between file types (e.g. Markdown -> TS -> PDF) must NEVER unmount
        the `{children}` wrapper, otherwise the Monaco instance is destroyed permanently.
        For non-editable files, we simply hide this wrapper with display: none.

        CHANGE: Markdown files now always get full width — no split pane.
        The old divider + ReactMarkdown preview has been removed.
        Inline live preview is handled by MarkdownInlineDecorator in the Monaco layer.
      */}
      <div style={{ 
        display: isEditable ? 'flex' : 'none', 
        height: '100%', 
        minHeight: 0, 
        overflow: 'hidden',
        flex: 1
      }}>
        {/* Editor pane — always full width now (split pane removed) */}
        <div style={{
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column' as const,
        }}>
          {children} {/* Monaco Editor Container */}
        </div>
      </div>

      {/* Render non-editable viewers alongside the hidden editor.
          Each is wrapped so the read-only toolbar sits above the document. */}
      {fileType === 'pdf' && (
        <div className="doc-viewer-shell">
          <DocumentToolbar file={file} kind="PDF" onOpenFile={onOpenFile} />
          <PdfViewer file={file} />
        </div>
      )}
      {fileType === 'docx' && (
        <div className="doc-viewer-shell">
          <DocumentToolbar file={file} kind="Word document" onOpenFile={onOpenFile} />
          <DocxViewer file={file} />
        </div>
      )}
      {fileType === 'pptx' && <PptxViewer />}
    </>
  )
}
