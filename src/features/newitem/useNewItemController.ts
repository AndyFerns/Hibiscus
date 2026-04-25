// ============================================================================
// useNewItemController -- Core Controller Hook
// ============================================================================
//
// Responsibilities:
// 1. Parse input (via inputEngine)
// 2. Generate suggestions (via suggestionEngine)
// 3. Validate path (via inputEngine)
// 4. Dispatch creation command (via createItemCommand)
//
// This hook is used by BOTH the global modal and the inline explorer input.
// It owns no UI state -- it only computes derived state from the raw input
// and dispatches side effects (creation command).
//
// DEBOUNCING: Input parsing and suggestion generation are debounced at
// 80ms to avoid unnecessary work during fast typing.
// ============================================================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { NewItemState, ParsedPath, flattenTree } from "./types"
import { parseInput, validatePath } from "./inputEngine"
import { generateSuggestions, invalidateSuggestionCache } from "./suggestionEngine"
import { createItemCommand, CreateItemResult } from "./createItemCommand"
import { Node } from "../../types/workspace"

/** Debounce delay for input processing (ms). */
const DEBOUNCE_MS = 80

interface UseNewItemControllerOptions {
  /** Workspace root directory (absolute path). */
  workspaceRoot: string | null
  /** Current workspace tree for suggestion generation. */
  tree: Node[]
  /** Recently accessed file paths for suggestion boosting. */
  recentItems?: string[]
  /** Callback invoked after successful creation. */
  onCreated?: (absolutePath: string, isFile: boolean) => void
}

interface UseNewItemControllerReturn {
  /** Current controller state. */
  state: NewItemState
  /** Set the raw input value. Triggers debounced parsing + suggestions. */
  setInput: (value: string) => void
  /** Override the creation mode (file or folder). */
  setMode: (mode: "file" | "folder") => void
  /** Move selection up in the suggestions list. */
  selectPrev: () => void
  /** Move selection down in the suggestions list. */
  selectNext: () => void
  /** Apply the currently selected suggestion (Tab autocomplete). */
  applySuggestion: () => void
  /** Submit the current input for creation. */
  submit: (openAfterCreate?: boolean) => Promise<CreateItemResult>
  /** Reset the controller to initial state. */
  reset: () => void
  /** Whether a creation is currently in-flight. */
  isCreating: boolean
}

const EMPTY_PARSED: ParsedPath = { segments: [], isFile: false, parentDir: "", name: "" }

const INITIAL_STATE: NewItemState = {
  rawInput: "",
  parsedPath: EMPTY_PARSED,
  suggestions: [],
  selectedIndex: -1,
  validation: { valid: false, message: "Enter a file or folder name" },
  mode: "file",
}

export function useNewItemController(
  options: UseNewItemControllerOptions
): UseNewItemControllerReturn {
  const { workspaceRoot, tree, recentItems = [], onCreated } = options

  const [state, setState] = useState<NewItemState>(INITIAL_STATE)
  const [isCreating, setIsCreating] = useState(false)

  // Monotonic version counter for the tree. Incremented on every tree change
  // to invalidate the suggestion cache.
  const treeVersionRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const modeRef = useRef(state.mode)

  // Flatten the tree into a lookup list. Recomputed when tree changes.
  const flatEntries = useMemo(() => {
    treeVersionRef.current++
    invalidateSuggestionCache()
    return flattenTree(tree)
  }, [tree])

  // Build a set of existing paths for duplicate detection.
  const existingPaths = useMemo(() => {
    return new Set(flatEntries.map(e => e.path))
  }, [flatEntries])

  useEffect(() => { modeRef.current = state.mode }, [state.mode])

  // ---- Core processing function (called after debounce) ----
  const processInput = useCallback((raw: string, currentMode: "file" | "folder") => {
    const parsed = parseInput(raw)

    // Auto-detect mode from input, but allow manual override.
    const effectiveMode = raw.endsWith("/") ? "folder" : parsed.isFile ? "file" : currentMode

    const validation = validatePath(parsed, existingPaths)
    const suggestions = generateSuggestions(
      parsed,
      flatEntries,
      recentItems,
      treeVersionRef.current
    )

    setState(({
      rawInput: raw,
      parsedPath: parsed,
      suggestions,
      selectedIndex: -1,
      validation,
      mode: effectiveMode,
    }))
  }, [existingPaths, flatEntries, recentItems])

  // ---- Public API ----

  const setInput = useCallback((value: string) => {
    // Immediately update rawInput for responsive typing.
    setState(prev => ({ ...prev, rawInput: value }))

    // Debounce the heavy processing.
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      processInput(value, modeRef.current)
    }, DEBOUNCE_MS)
  }, [processInput])

  const setMode = useCallback((mode: "file" | "folder") => {
    setState(prev => {
      const validation = validatePath(prev.parsedPath, existingPaths)
      return { ...prev, mode, validation }
    })
  }, [existingPaths])

  const selectPrev = useCallback(() => {
    setState(prev => {
      if (prev.suggestions.length === 0) return prev
      const next = prev.selectedIndex <= 0
        ? prev.suggestions.length - 1
        : prev.selectedIndex - 1
      return { ...prev, selectedIndex: next }
    })
  }, [])

  const selectNext = useCallback(() => {
    setState(prev => {
      if (prev.suggestions.length === 0) return prev
      const next = prev.selectedIndex >= prev.suggestions.length - 1
        ? 0
        : prev.selectedIndex + 1
      return { ...prev, selectedIndex: next }
    })
  }, [])

  const applySuggestion = useCallback(() => {
    setState(prev => {
      if (prev.selectedIndex < 0 || prev.selectedIndex >= prev.suggestions.length) {
        return prev
      }

      const suggestion = prev.suggestions[prev.selectedIndex]
      const newInput = suggestion.label
      const parsed = parseInput(newInput)
      const effectiveMode = parsed.isFile ? "file" : "folder"
      const validation = validatePath(parsed, existingPaths)

      return {
        ...prev,
        rawInput: newInput,
        parsedPath: parsed,
        mode: effectiveMode,
        validation,
        suggestions: [],
        selectedIndex: -1,
      }
    })
  }, [existingPaths])

  const submit = useCallback(async (openAfterCreate: boolean = false): Promise<CreateItemResult> => {
    if (!workspaceRoot) {
      return { success: false, error: "No workspace open" }
    }

    // Re-validate before submitting.
    const parsed = parseInput(state.rawInput)
    const validation = validatePath(parsed, existingPaths)
    if (!validation.valid) {
      setState(prev => ({ ...prev, validation }))
      return { success: false, error: validation.message }
    }

    setIsCreating(true)
    try {
      const relativePath = parsed.segments.join("/")
      const result = await createItemCommand(workspaceRoot, {
        path: relativePath,
        type: state.mode,
        openAfterCreate,
      })

      if (result.success && result.path) {
        onCreated?.(result.path, state.mode === "file")
      }

      return result
    } finally {
      setIsCreating(false)
    }
  }, [workspaceRoot, state.rawInput, state.mode, existingPaths, onCreated])

  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setState(INITIAL_STATE)
  }, [])

  // Cleanup debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    state,
    setInput,
    setMode,
    selectPrev,
    selectNext,
    applySuggestion,
    submit,
    reset,
    isCreating,
  }
}
