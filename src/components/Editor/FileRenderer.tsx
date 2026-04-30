/**
 * ============================================================================  
 * FileRenderer Component
 * ============================================================================
 * 
 * Renders different file types inside the editor based on file extension.
 * Supports Markdown, PDF, DOCX, and PPTX with Monaco as fallback.
 * 
 * This component integrates with the existing data flow using:
 * - buffersRef for file content cache
 * - openFiles for file metadata
 * - Tauri for binary file reading
 * ============================================================================
 */

import { useMemo, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Document, Page, pdfjs } from 'react-pdf'
import mammoth from 'mammoth'
import { invoke } from '@tauri-apps/api/core'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

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
 */
interface FileRendererProps {
  file: { path: string }
  content: string
  children: React.ReactNode
  showMarkdownPreview?: boolean
}

/**
 * Markdown Viewer Component
 * Uses react-markdown with memoization to avoid re-parsing
 */
function MarkdownViewer({ content }: { content: string }) {
  const memoizedContent = useMemo(() => {
    return <ReactMarkdown>{content}</ReactMarkdown>
  }, [content])

  return (
    <div style={{ 
      padding: '20px', 
      height: '100%', 
      overflow: 'auto',
      backgroundColor: 'var(--bg)',
      color: 'var(--text)'
    }}>
      {memoizedContent}
    </div>
  )
}

/**
 * PDF Viewer Component
 * Uses react-pdf with Tauri binary reading
 * Renders only the first page as specified
 */
function PdfViewer({ file }: { file: { path: string } }) {
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const loadPdf = async () => {
      try {
        // Use Tauri to read binary file
        const arrayBuffer = await invoke<ArrayBuffer>('read_file_binary', { 
          path: file.path 
        })
        
        // Convert ArrayBuffer to Blob to Object URL
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)

        return () => {
          URL.revokeObjectURL(url)
        }
      } catch (err) {
        setError('Failed to load PDF file')
        console.error('PDF loading error:', err)
      }
    }

    loadPdf()
  }, [file.path])

  const onDocumentLoadSuccess = () => {
    // PDF loaded successfully
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

  if (!pdfUrl) {
    return (
      <div style={{ 
        padding: '20px', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        Loading PDF...
      </div>
    )
  }

  return (
    <div style={{ 
      height: '100%', 
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div style={{ padding: '20px' }}>Loading PDF...</div>}
        error={<div style={{ padding: '20px', color: 'var(--error)' }}>Failed to load PDF</div>}
      >
        <Page 
          pageNumber={1} 
          renderTextLayer={true}
          renderAnnotationLayer={false}
          width={Math.max(600, window.innerWidth * 0.8)}
        />
      </Document>
    </div>
  )
}

/**
 * DOCX Viewer Component
 * Uses mammoth to convert DOCX to HTML with caching
 */
function DocxViewer({ file }: { file: { path: string } }) {
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const convertDocx = async () => {
      try {
        setLoading(true)
        
        // Use Tauri to read binary file
        const arrayBuffer = await invoke<ArrayBuffer>('read_file_binary', { 
          path: file.path 
        })
        
        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer })
        setHtmlContent(result.value)
        
        if (result.messages.length > 0) {
          console.warn('DOCX conversion warnings:', result.messages)
        }
      } catch (err) {
        setError('Failed to load DOCX file')
        console.error('DOCX loading error:', err)
      } finally {
        setLoading(false)
      }
    }

    convertDocx()
  }, [file.path])

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
        Loading DOCX...
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
    <div 
      style={{ 
        padding: '20px', 
        height: '100%', 
        overflow: 'auto',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
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

// /**
//  * Monaco Fallback Component
//  * Returns null to let EditorView handle Monaco rendering
//  */
// function MonacoFallback() {
//   return null
// }

/**
 * Main FileRenderer Component
 * Implements the renderer switch based on file type
 */
export function FileRenderer({ file, content, children, showMarkdownPreview = true }: FileRendererProps) {
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
      */}
      <div style={{ 
        display: isEditable ? 'flex' : 'none', 
        height: '100%', 
        minHeight: 0, 
        overflow: 'hidden',
        flex: 1
      }}>
        {/* Editor pane — always present */}
        <div style={{
          flex: (fileType === 'markdown' && showMarkdownPreview) ? 1 : undefined,
          width: (fileType === 'markdown' && showMarkdownPreview) ? undefined : '100%',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column' as const,
        }}>
          {children} {/* Monaco Editor Container */}
        </div>

        {/* Divider + Markdown Preview — conditionally rendered */}
        {fileType === 'markdown' && showMarkdownPreview && (
          <>
            <div style={{
              width: 1,
              flexShrink: 0,
              background: 'var(--border, rgba(255,255,255,0.06))'
            }} />
            <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
              <MarkdownViewer content={content} />
            </div>
          </>
        )}
      </div>

      {/* Render non-editable viewers alongside the hidden editor */}
      {fileType === 'pdf' && <PdfViewer file={file} />}
      {fileType === 'docx' && <DocxViewer file={file} />}
      {fileType === 'pptx' && <PptxViewer />}
    </>
  )
}
