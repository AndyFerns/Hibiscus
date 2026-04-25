// ============================================================================
// New Item System -- Type Definitions
// ============================================================================
//
// Shared types for the keyboard-centric file/folder creation system.
// Used by the input engine, suggestion engine, controller hook, and UI.
// ============================================================================

import { Node } from "../../types/workspace"

// ---------------------------------------------------------------------------
// Parsed path (output of the input engine)
// ---------------------------------------------------------------------------

/** Result of parsing a raw user input string into structured path data. */
export interface ParsedPath {
  /** Individual path segments (split on "/"). */
  segments: string[]
  /** True if the input indicates a file (has an extension). */
  isFile: boolean
  /** The resolved parent directory (all segments except the last). */
  parentDir: string
  /** The final segment -- the name of the item to create. */
  name: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  /** True if the current input is valid for creation. */
  valid: boolean
  /** Human-readable error message, empty when valid. */
  message: string
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export interface Suggestion {
  /** Display label for the suggestion. */
  label: string
  /** Whether this suggestion is a file or folder. */
  type: "file" | "folder"
  /** Relevance score (higher = better match). */
  score: number
}

// ---------------------------------------------------------------------------
// Controller state
// ---------------------------------------------------------------------------

export interface NewItemState {
  rawInput: string
  parsedPath: ParsedPath
  suggestions: Suggestion[]
  selectedIndex: number
  validation: ValidationResult
  mode: "file" | "folder"
}

// ---------------------------------------------------------------------------
// Command layer request
// ---------------------------------------------------------------------------

export interface CreateItemRequest {
  /** Absolute path of the item to create. */
  path: string
  /** Whether this is a file or folder. */
  type: "file" | "folder"
  /** If true, the file should be opened in the editor after creation. */
  openAfterCreate: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a Node tree into a list of paths for suggestion matching. */
export function flattenTree(nodes: Node[], parentPath: string = ""): { path: string; type: "file" | "folder" }[] {
  const result: { path: string; type: "file" | "folder" }[] = []

  for (const node of nodes) {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name
    result.push({
      path: fullPath,
      type: node.type === "folder" ? "folder" : "file",
    })
    if (node.children) {
      result.push(...flattenTree(node.children, fullPath))
    }
  }

  return result
}
