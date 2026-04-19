/**
 * ============================================================================
 * Notes Synthesis Types
 * ============================================================================
 */

/** Supported input file formats */
export type NoteFormat = "txt" | "md" | "pdf" | "docx"

/** A single input note file */
export interface SynthesisInput {
  /** File path on disk */
  path: string
  /** File name for display */
  name: string
  /** Detected format */
  format: NoteFormat
  /** Raw content (only populated for supported formats) */
  content?: string
}

/** Generated synthesis output */
export interface SynthesisOutput {
  /** Generated title for the synthesis */
  title: string
  /** Combined markdown content */
  content: string
  /** Source file names */
  sources: string[]
}
