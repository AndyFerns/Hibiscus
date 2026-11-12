/**
 * ============================================================================
 * fileLoader — Unified File Loading Abstraction
 * ============================================================================
 *
 * Single source of truth for deciding HOW to read a file from disk.
 * All file reads in the app should go through this module.
 *
 * - Binary files (DOCX, PDF, PPTX, images…) → read_file_binary → Uint8Array
 * - Text files (MD, TXT, TS, JS…)           → read_text_file   → string
 *
 * TAURI SERIALIZATION NOTE:
 * `read_file_binary` returns a `tauri::ipc::Response`, so bytes arrive as a
 * raw ArrayBuffer (no JSON number[] round trip). Older builds and test mocks
 * may still produce number[] / Uint8Array; loadBinaryFile normalizes all of
 * them to an ArrayBuffer.
 * ============================================================================
 */

import { invoke } from "@tauri-apps/api/core"

// Extensions treated as binary (cannot be read as UTF-8 text)
const BINARY_EXTENSIONS = new Set([
  // Documents
  "pdf", "docx", "pptx", "xlsx", "doc", "ppt", "xls",
  // Images
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg", "tiff",
  // Archives
  "zip", "rar", "7z", "tar", "gz",
  // Media
  "mp3", "mp4", "wav", "ogg", "webm", "avi",
])

/** Image formats the image viewer can display. */
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg"])

/** Check if a file path points to a displayable image */
export function isImageFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  return IMAGE_EXTENSIONS.has(ext)
}

/** Check if a file path points to a binary file */
export function isBinaryFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  return BINARY_EXTENSIONS.has(ext)
}

/** Normalize whatever the IPC layer handed back into an ArrayBuffer. */
export function toArrayBuffer(data: ArrayBuffer | ArrayBufferView | number[]): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    return view.slice().buffer
  }
  return new Uint8Array(data).buffer
}

/**
 * Read a binary file from disk via Tauri.
 * Returns an ArrayBuffer suitable for pdf.js, docx-preview, Blob creation, etc.
 */
export async function loadBinaryFile(path: string): Promise<ArrayBuffer> {
  const data = await invoke<ArrayBuffer | ArrayBufferView | number[]>("read_file_binary", { path })
  return toArrayBuffer(data)
}

/** Report produced by the backend `inspect_document` command. */
export interface DocumentReport {
  size: number
  modifiedMs: number
  sha256: string
  kind: string
  expectedKind: string
  ok: boolean
  reason: string | null
}

/** Hash, real type and integrity verdict for a file on disk. */
export function inspectDocument(path: string): Promise<DocumentReport> {
  return invoke<DocumentReport>("inspect_document", { path })
}

/** Lower-case hex SHA-256 of a buffer (Web Crypto, off the JS main loop). */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  const bytes = new Uint8Array(digest)
  let hex = ""
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0")
  return hex
}

/** Read a text file from disk via Tauri. */
export async function loadTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path })
}

/**
 * Unified file loader — automatically picks the right read strategy.
 * Returns ArrayBuffer for binary files, string for text files.
 */
export async function loadFile(path: string): Promise<ArrayBuffer | string> {
  if (isBinaryFile(path)) {
    return loadBinaryFile(path)
  }
  return loadTextFile(path)
}
