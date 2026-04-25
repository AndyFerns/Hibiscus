// ============================================================================
// New Item Feature -- Public API
// ============================================================================

export { useNewItemController } from "./useNewItemController"
export { createItemCommand } from "./createItemCommand"
export { parseInput, validatePath } from "./inputEngine"
export { generateSuggestions, invalidateSuggestionCache } from "./suggestionEngine"

export type {
  NewItemState,
  ParsedPath,
  Suggestion,
  ValidationResult,
  CreateItemRequest,
} from "./types"
export { flattenTree } from "./types"
