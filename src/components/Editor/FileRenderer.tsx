/**
 * ============================================================================
 * FileRenderer Component
 * ============================================================================
 *
 * Chooses how the active file is shown:
 * - Text files: the Monaco editor passed in as `children`.
 * - PDF / DOCX / PPTX / images: a read-only, paginated viewer.
 *
 * Monaco is ALWAYS kept mounted in the same DOM position (just hidden while a
 * document is shown); unmounting it would destroy the editor instance.
 *
 * Document bytes come from useDocumentSource, which checks integrity first
 * (real file type, truncation, broken zip) and cross-checks the SHA-256 of
 * what arrived against what's on disk. Damaged files get an explanation
 * instead of a blank or crashing viewer.
 *
 * Viewers are code-split with React.lazy, so pdf.js, docx-preview and
 * pptx-preview are only downloaded when such a file is first opened.
 * ============================================================================
 */

import { lazy, Suspense } from "react"
import { useDocumentSource } from "../../hooks/useDocumentSource"
import { isImageFile } from "../../utils/fileLoader"
import { DocumentLoading, DocumentErrorState } from "./viewers/DocumentState"
import "./FileRenderer.css"

const PdfViewer = lazy(() => import("./viewers/PdfViewer"))
const DocxViewer = lazy(() => import("./viewers/DocxViewer"))
const PptxViewer = lazy(() => import("./viewers/PptxViewer"))
const ImageViewer = lazy(() => import("./viewers/ImageViewer"))

export type ViewerKind = "pdf" | "docx" | "pptx" | "image"

/** Which document viewer (if any) handles this path. */
export function getViewerKind(path: string): ViewerKind | null {
  const ext = path.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "pdf"
  if (ext === "docx") return "docx"
  if (ext === "pptx") return "pptx"
  if (isImageFile(path)) return "image"
  return null
}

const VIEWERS = {
  pdf: PdfViewer,
  docx: DocxViewer,
  pptx: PptxViewer,
  image: ImageViewer,
} as const

const LABELS: Record<ViewerKind, string> = {
  pdf: "PDF",
  docx: "document",
  pptx: "presentation",
  image: "image",
}

function DocumentViewer({
  path,
  kind,
  onOpenFile,
}: {
  path: string
  kind: ViewerKind
  onOpenFile?: (path: string) => void
}) {
  const source = useDocumentSource(path)
  const Viewer = VIEWERS[kind]

  if (source.status === "loading" || (source.status === "ready" && !source.bytes)) {
    return (
      <div className="docv docv--bare">
        <DocumentLoading label={`Checking ${LABELS[kind]}…`} />
      </div>
    )
  }

  if (source.status === "corrupt" || source.status === "error") {
    return (
      <div className="docv docv--bare">
        <DocumentErrorState
          path={path}
          title={
            source.status === "corrupt"
              ? `This ${LABELS[kind]} looks damaged`
              : `This ${LABELS[kind]} couldn't be opened`
          }
          reason={source.reason}
          report={source.report}
          onRetry={source.retry}
          onOpenAnyway={source.status === "corrupt" && source.report?.size ? source.openAnyway : undefined}
        />
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="docv docv--bare">
          <DocumentLoading label={`Loading ${LABELS[kind]} viewer…`} />
        </div>
      }
    >
      <Viewer
        key={source.key}
        path={path}
        bytes={source.bytes!}
        docKey={source.key!}
        report={source.report}
        onOpenFile={onOpenFile}
      />
    </Suspense>
  )
}

interface FileRendererProps {
  file: { path: string }
  children: React.ReactNode
  /** Opens a file in the editor — used to jump to a freshly extracted note. */
  onOpenFile?: (path: string) => void
}

const HIDDEN = { display: "none" } as const

export function FileRenderer({ file, children, onOpenFile }: FileRendererProps) {
  const kind = getViewerKind(file.path)

  return (
    <>
      <div className="file-renderer-editor" style={kind ? HIDDEN : undefined}>
        {children}
      </div>
      {kind && <DocumentViewer key={file.path} path={file.path} kind={kind} onOpenFile={onOpenFile} />}
    </>
  )
}
