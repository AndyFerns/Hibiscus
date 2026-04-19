import { useState, useEffect, useRef } from "react"
import "./NewItemModal.css"

export type NewItemModalMode = "file" | "folder"

export interface NewItemModalProps {
  /** Whether the modal is currently open */
  open: boolean
  /** Current mode - determines title and behavior */
  mode: NewItemModalMode
  /** Callback when modal should close */
  onClose: () => void
  /** Callback when user confirms creation */
  onCreate: (name: string) => Promise<void>
  /** Optional default path to show as hint */
  defaultPath?: string
  /** List of existing names to prevent duplicates */
  existingNames?: string[]
}

export function NewItemModal({
  open,
  mode,
  onClose,
  onCreate,
  defaultPath = "",
  existingNames = []
}: NewItemModalProps) {
  const [inputValue, setInputValue] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setInputValue("")
      setError("")
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    } else if (e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Validate input
  const validateInput = (name: string): string => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      return "Name cannot be empty"
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(trimmedName)) {
      return "Name contains invalid characters"
    }
    
    // Check for duplicate names
    if (existingNames.includes(trimmedName)) {
      return `${mode === "file" ? "File" : "Folder"} already exists`
    }
    
    return ""
  }

  // Handle form submission
  const handleSubmit = async () => {
    const trimmedName = inputValue.trim()
    const validationError = validateInput(trimmedName)
    
    if (validationError) {
      setError(validationError)
      return
    }
    
    setIsCreating(true)
    setError("")
    
    try {
      await onCreate(trimmedName)
      onClose()
    } catch (err) {
      setError(`Failed to create ${mode}: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsCreating(false)
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    
    // Clear error when user starts typing
    if (error) {
      setError("")
    }
  }

  // Get modal title based on mode
  const getTitle = () => {
    return mode === "file" ? "New File" : "New Folder"
  }

  // Get placeholder text
  const getPlaceholder = () => {
    return mode === "file" ? "Enter file name..." : "Enter folder name..."
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="new-item-modal-backdrop" onClick={onClose} />
      
      {/* Modal */}
      <div className="new-item-modal">
        <div className="new-item-modal-content">
          {/* Header */}
          <div className="new-item-modal-header">
            <h2 className="new-item-modal-title">{getTitle()}</h2>
          </div>
          
          {/* Body */}
          <div className="new-item-modal-body">
            <div className="new-item-modal-input-group">
              <label className="new-item-modal-label" htmlFor="new-item-name">
                Name:
              </label>
              <input
                ref={inputRef}
                id="new-item-name"
                type="text"
                className="new-item-modal-input"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                disabled={isCreating}
                aria-invalid={!!error}
                aria-describedby={error ? "new-item-error" : undefined}
              />
              {error && (
                <div id="new-item-error" className="new-item-modal-error">
                  {error}
                </div>
              )}
            </div>
            
            {defaultPath && (
              <div className="new-item-modal-path-hint">
                Will be created in: {defaultPath}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="new-item-modal-footer">
            <button
              className="new-item-modal-button new-item-modal-button--cancel"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              className="new-item-modal-button new-item-modal-button--create"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isCreating || !!validateInput(inputValue.trim())}
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
