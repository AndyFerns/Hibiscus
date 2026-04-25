// ============================================================================
// Input Engine
// ============================================================================
//
// Converts a raw user input string into a ParsedPath structure.
//
// RULES:
// - "/" is the path separator (normalized from "\" on input).
// - A trailing "/" forces folder mode.
// - Presence of an extension (e.g., ".ts") forces file mode.
// - Invalid characters are detected and reported via validation.
// - Empty input produces an invalid ParsedPath with empty segments.
//
// This module is PURE -- no side effects, no IO, no async.
// ============================================================================

import { ParsedPath, ValidationResult } from "./types"

// Characters forbidden in file/folder names across Windows, macOS, and Linux.
const INVALID_CHARS = /[<>:"|?*]/
// Control characters (ASCII 0-31).
const CONTROL_CHARS = /[\x00-\x1f]/

/**
 * Parse a raw input string into structured path data.
 *
 * The input is normalized: backslashes become forward slashes, leading/
 * trailing whitespace is trimmed, and consecutive separators are collapsed.
 */
export function parseInput(raw: string): ParsedPath {
  // Normalize separators and trim.
  const normalized = raw.replace(/\\/g, "/").trim()

  // Handle empty input.
  if (!normalized) {
    return { segments: [], isFile: false, parentDir: "", name: "" }
  }

  // Detect trailing slash (forces folder mode) before splitting.
  const endsWithSlash = normalized.endsWith("/")

  // Split into segments, filtering out empty strings from consecutive "/".
  const segments = normalized.split("/").filter(Boolean)

  if (segments.length === 0) {
    return { segments: [], isFile: false, parentDir: "", name: "" }
  }

  const name = segments[segments.length - 1]
  const parentDir = segments.length > 1 ? segments.slice(0, -1).join("/") : ""

  // Determine if this is a file: has an extension AND does NOT end with "/".
  const hasExtension = name.includes(".") && !name.startsWith(".") && name.lastIndexOf(".") < name.length - 1
  const isFile = hasExtension && !endsWithSlash

  return { segments, isFile, parentDir, name }
}

/**
 * Validate a parsed path for creation.
 *
 * Checks:
 * - Non-empty input
 * - No invalid characters in any segment
 * - No control characters
 * - Segment names are not reserved (CON, PRN, etc. on Windows)
 * - Reasonable path depth (< 20 segments)
 */
export function validatePath(
  parsed: ParsedPath,
  existingPaths: Set<string>
): ValidationResult {
  // Empty input.
  if (parsed.segments.length === 0 || !parsed.name) {
    return { valid: false, message: "Enter a file or folder name" }
  }

  // Check each segment for invalid characters.
  for (const segment of parsed.segments) {
    if (INVALID_CHARS.test(segment)) {
      return { valid: false, message: `"${segment}" contains invalid characters` }
    }
    if (CONTROL_CHARS.test(segment)) {
      return { valid: false, message: `"${segment}" contains control characters` }
    }
    // Windows reserved names.
    const upper = segment.toUpperCase().replace(/\.[^.]*$/, "")
    if (WINDOWS_RESERVED.has(upper)) {
      return { valid: false, message: `"${segment}" is a reserved name` }
    }
    // Segments must not be empty or whitespace-only.
    if (!segment.trim()) {
      return { valid: false, message: "Path segments cannot be empty" }
    }
  }

  // Depth limit (matches backend MAX_PATH_DEPTH of 50, but we cap at 20
  // for UX -- deeply nested creation is almost always a mistake).
  if (parsed.segments.length > 20) {
    return { valid: false, message: "Path is too deeply nested" }
  }

  // Duplicate detection: check if this exact relative path already exists.
  const fullRelative = parsed.segments.join("/")
  if (existingPaths.has(fullRelative)) {
    const kind = parsed.isFile ? "File" : "Folder"
    return { valid: false, message: `${kind} already exists` }
  }

  return { valid: true, message: "" }
}

const WINDOWS_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
])
