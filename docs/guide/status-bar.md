# Status Bar

The **Status Bar** at the bottom of the Hibiscus window provides essential information and quick controls for workspace management, theming, and layout toggles.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 📁 workspace-name     🔍 Focus     Ln 12, Col 34   file.md   ⏱️ 24:32   🎨   ⚙️  │
│                                                                                 │
│ [Left Info]                    [Center Info]              [Right Controls]       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Left Section

### Workspace Indicator

```
📁 my-project
```

- Shows current workspace folder name
- Truncated path for long names
- Click to reveal full path in tooltip

### Focus Mode Indicator

```
🔍 Focus
```

- Appears only when Focus Mode is active
- Accent color to draw attention
- Reminds user they're in distraction-free mode

---

## Center Section

### Cursor Position

```
Ln 42, Col 7
```

- Updates in real-time as you type
- Line and column numbers (1-indexed)
- Only visible when editor has focus

### Current File

```
note.md
```

- Name of active file
- Gray/muted styling
- Updates on tab switch

---

## Right Section

### Pomodoro Mini Timer

```
⭕ 24:32
```

- Compact circular progress indicator
- Shows remaining time
- Click to open Pomodoro panel
- Only visible when timer is running

### Theme Selector

```
🎨 [Dropdown]
```

- Quick theme switching without opening Settings
- Lists all installed themes:
  - Midnight
  - Dawn
  - Forest
  - Custom themes...
- Instant application (no restart)
- Persists across sessions

**Dropdown Interface:**
```
┌─────────────┐
│ 🌙 Midnight │
│ 🌅 Dawn     │
│ 🌲 Forest   │
│ ─────────── │
│ + Custom... │
└─────────────┘
```

### Layout Toggle

```
[Explorer] [Right Panel]
```

- Two toggle buttons for panel visibility
- Pressed state = panel visible
- Unpressed state = panel hidden
- Tooltips on hover

**Explorer Toggle:**
- Shows/hides left file tree panel
- Syncs with `Ctrl+B` shortcut

**Right Panel Toggle:**
- Shows/hides right sidebar
- Syncs with `Ctrl+J` shortcut

### Version Info

```
Hibiscus v0.3.7
```

- Current application version
- Subtle/gray styling
- Click for about dialog (planned)

---

## Layout Toggle Component

The **LayoutToggle** provides visual control over panel visibility:

### Features

- **Icon-based**: Clean SVG icons for each panel
- **State Indication**: Active panels highlighted
- **Hover Effects**: Subtle background change
- **Click Action**: Toggle panel visibility

### Implementation

```typescript
interface LayoutToggleProps {
  showLeftPanel: boolean
  showRightPanel: boolean
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
}
```

---

## Theme Selector Component

The **ThemeSelector** dropdown allows instant theme switching:

### Features

- **Dropdown Interface**: Clean select dropdown
- **Theme List**: All available themes
- **Preview**: Colors shown in dropdown items
- **Persistence**: Saves to localStorage and backend

### Custom Themes

Access the **Theme Editor**:

1. Select "+ Custom..." from dropdown
2. Or open via Settings → Themes

See [Theming System](theming.md) for theme creation details.

---

## Shortcut Overlay Trigger

The status bar can trigger the keyboard shortcuts help:

**Access:** Click the `?` icon or press `Ctrl+?`

---

## Screenshots

*[PHOTO PLACEHOLDER: Status Bar Full View]*
*Add screenshot showing the complete status bar with all elements visible*

*[PHOTO PLACEHOLDER: Theme Selector Dropdown]*
*Add screenshot showing the theme selector dropdown open with theme options*

*[PHOTO PLACEHOLDER: Pomodoro Timer in Status Bar]*
*Add screenshot showing the mini pomodoro timer active in the status bar*

---

## Troubleshooting

### Status Bar Not Visible

- Check if window is maximized (might be off-screen)
- Restart Hibiscus
- Check CSS for `.status-bar` display property

### Theme Selector Not Working

- Verify theme files exist
- Check localStorage permissions
- Try manual theme change in Settings

### Pomodoro Timer Missing

- Timer only shows when running
- Start a Pomodoro session to see it
- Check if mini-timer is enabled in settings

### Version Not Showing

- Check `version.json` exists
- Verify build process included version
- May be hidden on very small windows

---

## Related Documentation

- [Theming System](theming.md) - Theme customization
- [Study Tools](study-tools.md) - Pomodoro timer details
- [Keyboard Shortcuts](shortcuts.md) - Shortcut overlay
