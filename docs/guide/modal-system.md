# Modal System Guide

## Overview

Hibiscus v0.7.0 introduces a production-grade modal system that replaces browser-native dialogs with custom React components designed specifically for desktop applications.

## Design Philosophy

The modal system follows a **hybrid** design approach:

- **Clean & Minimal**: Distraction-free interface with soft shadows and rounded corners
- **Responsive Design**: Adapts to different screen sizes while maintaining usability
- **Theme Integration**: Uses existing CSS variables for consistent theming
- **Accessibility First**: Proper ARIA attributes, keyboard navigation, and focus management

## Components

### NewItemModal

**Location**: `src/components/Modals/NewItemModal.tsx`

The primary modal component for creating new files and folders.

#### Props

```typescript
interface NewItemModalProps {
  open: boolean                    // Whether modal is visible
  mode: "file" | "folder"          // Creation mode
  onClose: () => void             // Close callback
  onCreate: (name: string) => Promise<void>  // Creation callback
  defaultPath?: string            // Optional path hint
  existingNames?: string[]         // Names to prevent duplicates
}
```

#### Features

- **Input Validation**: Prevents invalid characters and duplicate names
- **Keyboard Navigation**: Enter to create, Escape to close
- **Auto-focus**: Automatically focuses input when opened
- **Error Handling**: Inline error messages with clear feedback
- **Loading States**: Disabled buttons during async operations

#### Usage Example

```typescript
const [modal, setModal] = useState({ open: false, mode: "file" as const })

const handleNewFile = () => setModal({ open: true, mode: "file" })
const handleCreate = async (name: string) => await createFile(name)

<NewItemModal
  open={modal.open}
  mode={modal.mode}
  onClose={() => setModal({ open: false, mode: "file" })}
  onCreate={handleCreate}
  existingNames={getExistingNames()}
/>
```

## Styling

### CSS Architecture

**Location**: `src/components/Modals/NewItemModal.css`

The styling follows these principles:

1. **Theme Variables**: Uses `var(--bg)`, `var(--text)`, `var(--accent)` etc.
2. **Responsive Design**: Mobile-friendly breakpoints
3. **Smooth Animations**: Backdrop blur and scale effects
4. **Accessibility**: High contrast and focus indicators

### Key CSS Classes

- `.new-item-modal-backdrop`: Semi-transparent overlay
- `.new-item-modal`: Main modal container
- `.new-item-modal-input`: Text input field
- `.new-item-modal-button`: Action buttons
- `.new-item-modal-error`: Error message display

## Integration

### State Management

Modals use controlled component patterns:

```typescript
const [newItemModal, setNewItemModal] = useState<{
  open: boolean
  mode: NewItemModalMode
}>({
  open: false,
  mode: "file"
})
```

### Keyboard Shortcuts

Global keyboard event listeners:

- **Ctrl+N**: Opens new file modal
- **Ctrl+Shift+N**: Opens new folder modal

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'n' && !e.shiftKey) {
      e.preventDefault()
      handleNewFile()
    }
    // ... handle Ctrl+Shift+N
  }
  
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [handleNewFile, handleNewFolder])
```

## Validation Rules

### Filename Validation

The modal enforces these validation rules:

1. **Empty Names**: Cannot be empty or whitespace only
2. **Invalid Characters**: Prevents `< > : " / \ | ? *`
3. **Duplicate Names**: Checks against existing workspace items
4. **Length Limits**: Reasonable length constraints

### Error Messages

- `"Name cannot be empty"`
- `"Name contains invalid characters"`
- `"File already exists"` / `"Folder already exists"`
- `"Failed to create file: [error]"`

## Best Practices

### When to Use Modals

- **User Input Required**: When you need user input for actions
- **Context Preservation**: When you don't want to navigate away
- **Critical Actions**: For important operations like file creation

### Controller Integration

Keep business logic in controllers:

```typescript
// GOOD: Modal handles UI, controller handles logic
const handleModalCreate = async (name: string) => {
  if (mode === "file") {
    await createFile(name)  // Controller method
  } else {
    await createFolder(name)  // Controller method
  }
}

// BAD: Modal directly manipulating filesystem
const handleModalCreate = async (name: string) => {
  await invoke("create_file", { path: name })  // Don't do this
}
```

### Error Handling

Always handle errors gracefully:

```typescript
try {
  await onCreate(trimmedName)
  onClose()  // Close on success
} catch (err) {
  setError(`Failed to create ${mode}: ${err.message}`)
}
```

## Future Extensions

The modal system is designed for extensibility:

### Additional Modal Types

- **Confirmation Modals**: For destructive actions
- **Settings Modals**: Complex configuration interfaces
- **Import/Export Modals**: File handling interfaces

### Enhanced Features

- **Multi-step Creation**: Wizard-style modals
- **Template Selection**: File template choosers
- **Advanced Validation**: Custom validation rules

## Accessibility

### ARIA Attributes

- `aria-expanded`: For folder expansion state
- `aria-invalid`: For validation errors
- `aria-describedby`: Links error messages to inputs
- `role="dialog"`: Proper semantic role

### Keyboard Navigation

- **Tab**: Navigate between form elements
- **Enter**: Submit form
- **Escape**: Close modal
- **Focus Management**: Auto-focus and restore focus

## Testing

### Unit Tests

Test modal behavior:

```typescript
describe('NewItemModal', () => {
  it('should validate input correctly')
  it('should call onCreate on valid submit')
  it('should show error messages for invalid input')
  it('should close on Escape key')
})
```

### Integration Tests

Test full workflow:

```typescript
describe('File Creation Workflow', () => {
  it('should create file when modal is submitted')
  it('should prevent duplicate file creation')
  it('should handle keyboard shortcuts')
})
```

## Troubleshooting

### Common Issues

1. **Modal Not Opening**: Check state management and event handlers
2. **Validation Not Working**: Ensure `existingNames` prop is updated
3. **Keyboard Shortcuts Not Working**: Check event listener setup
4. **Styling Issues**: Verify CSS variables are available

### Debug Tips

- Use React DevTools to inspect modal state
- Check browser console for validation errors
- Verify theme CSS variables are loaded
- Test keyboard shortcuts in different contexts
