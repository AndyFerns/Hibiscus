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
 * Rust's Vec<u8> is serialized as a JSON number[] over the Tauri IPC bridge,
 * NOT as an ArrayBuffer. Consumers must convert via new Uint8Array(data).buffer
 * before passing to libraries like mammoth or creating Blobs.
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

/** Check if a file path points to a binary file */
export function isBinaryFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  return BINARY_EXTENSIONS.has(ext)
}

/**
 * Read a binary file from disk via Tauri.
 * Returns an ArrayBuffer suitable for mammoth, Blob creation, etc.
 *
 * IMPORTANT: Tauri serializes Vec<u8> as number[]. We convert to
 * Uint8Array then extract the underlying ArrayBuffer.
 */
export async function loadBinaryFile(path: string): Promise<ArrayBuffer> {
  const bytes = await invoke<number[]>("read_file_binary", { path })
  return new Uint8Array(bytes).buffer
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
