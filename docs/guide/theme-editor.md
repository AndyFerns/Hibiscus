# Theme Editor

The **Theme Editor** allows you to create, customize, and manage visual themes for Hibiscus. Create personalized color schemes or tweak existing themes to match your preferences.

---

## Accessing the Theme Editor

**Method 1**: Status Bar → Theme Selector → "+ Custom..."
**Method 2**: Settings → Themes Tab
**Method 3**: Keyboard shortcut `Ctrl+Shift+T` (planned)

---

## Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Theme Editor                                    [×]         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Preset Themes:  [🌙 Midnight] [🌅 Dawn] [🌲 Forest]        │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  Custom Themes:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☀️ My Theme                              [Edit] [🗑] │   │
│  │ 🎨 Ocean                                 [Edit] [🗑] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [+ Create New Theme]                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Creating a New Theme

### Step 1: Start Creation

Click "+ Create New Theme" to open the theme builder:

```
┌─────────────────────────────────────────────────────────────┐
│  New Theme                                                   │
├─────────────────────────────────────────────────────────────┤
│  Name: [My Custom Theme                    ]                │
│                                                              │
│  Base Theme: [🌙 Midnight ▼]                               │
│  • Start from a preset and customize                       │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Colors:                                                    │
│                                                              │
│  Background Primary    [#0F111A ▤]  [🎨]                   │
│  Background Secondary  [#1A1D29 ▤]  [🎨]                   │
│  Text Primary          [#FFFFFF ▤]  [🎨]                   │
│  Text Secondary        [#A0A0A0 ▤]  [🎨]                   │
│  Accent                [#BB86FC ▤]  [🎨]                   │
│  Accent Secondary      [#03DAC6 ▤]  [🎨]                   │
│  Border                [#2D3142 ▤]  [🎨]                   │
│  Error                 [#CF6679 ▤]  [🎨]                   │
│  Warning               [#F4B400 ▤]  [🎨]                   │
│  Success               [#4CAF50 ▤]  [🎨]                   │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Preview:                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [Live preview of theme applied to sample UI]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [Cancel]                                    [Save Theme]   │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Choose a Base

Select a preset theme as your starting point:

| Base | Description |
|------|-------------|
| Midnight | Dark purple/blue theme |
| Dawn | Light warm theme |
| Forest | Dark green earth tones |
| Minimal | Barebones starting point |

### Step 3: Customize Colors

Click any color swatch to open the color picker:

**Color Variables:**

```css
/* Background Layers */
--bg-primary:     /* Main editor background */
--bg-secondary:   /* Sidebar, panels */
--bg-tertiary:    /* Inputs, buttons */

/* Text Colors */
--text-primary:   /* Main text, headings */
--text-secondary: /* Muted text, labels */
--text-muted:     /* Disabled, hints */

/* Accent Colors */
--accent:              /* Primary accent */
--accent-secondary:    /* Secondary accent */
--accent-hover:        /* Hover states */

/* Utility Colors */
--border:         /* Dividers, borders */
--error:          /* Error messages */
--warning:        /* Warning indicators */
--success:        /* Success states */
```

### Step 4: Live Preview

Changes apply instantly to:

- Theme preview panel
- Active editor (if "Apply Live" enabled)
- All UI components

### Step 5: Save

Click "Save Theme" to persist:

- Saved to `.hibiscus/themes/<name>.json`
- Appears in theme selector immediately
- Persists across application restarts

---

## Editing Existing Themes

### Built-in Themes

Preset themes (Midnight, Dawn, Forest) can be duplicated but not edited directly:

1. Click "Duplicate" on a preset
2. Edit the copy
3. Save as new theme

### Custom Themes

Your custom themes are fully editable:

1. Click "Edit" on any custom theme
2. Modify colors
3. Save changes

---

## Theme File Format

Custom themes are stored as JSON:

```json
{
  "name": "My Ocean Theme",
  "author": "User Name",
  "version": "1.0.0",
  "base": "midnight",
  "colors": {
    "bg-primary": "#0a192f",
    "bg-secondary": "#112240",
    "bg-tertiary": "#233554",
    "text-primary": "#e6f1ff",
    "text-secondary": "#8892b0",
    "text-muted": "#495670",
    "accent": "#64ffda",
    "accent-secondary": "#00b4d8",
    "accent-hover": "#90e0ef",
    "border": "#233554",
    "error": "#ff6b6b",
    "warning": "#ffd93d",
    "success": "#6bcb77"
  },
  "editor": {
    "font-size": 14,
    "line-height": 1.5,
    "font-family": "'JetBrains Mono', monospace"
  }
}
```

---

## Theme Variables Reference

### Background Variables

| Variable | Usage |
|----------|-------|
| `--bg-primary` | Editor background, main areas |
| `--bg-secondary` | Sidebars, panels, tree view |
| `--bg-tertiary` | Input fields, buttons, cards |
| `--bg-elevated` | Modals, dropdowns, floating elements |

### Text Variables

| Variable | Usage |
|----------|-------|
| `--text-primary` | Main content, headings |
| `--text-secondary` | Labels, metadata |
| `--text-muted` | Hints, disabled text |
| `--text-inverse` | Text on colored backgrounds |

### Accent Variables

| Variable | Usage |
|----------|-------|
| `--accent` | Primary buttons, links, active states |
| `--accent-secondary` | Secondary highlights |
| `--accent-hover` | Hover effects |
| `--accent-muted` | Subtle accent backgrounds |

### Semantic Colors

| Variable | Usage |
|----------|-------|
| `--error` | Error messages, validation |
| `--warning` | Warning states |
| `--success` | Success messages |
| `--info` | Informational highlights |

---

## Color Picker

The built-in color picker provides:

### Formats

- **Hex**: `#RRGGBB` or `#RGB`
- **RGB**: `rgb(r, g, b)`
- **HSL**: `hsl(h, s%, l%)` (planned)

### Features

- **Eyedropper**: Pick color from screen (planned)
- **Color History**: Recently used colors
- **Presets**: Common color palette
- **Contrast Check**: WCAG contrast ratio (planned)

---

## Import/Export

### Export Theme

Share your custom themes:

1. Open Theme Editor
2. Select custom theme
3. Click "Export"
4. Save `.json` file

### Import Theme

Install themes from others:

1. Click "Import Theme"
2. Select `.json` file
3. Theme appears in list
4. Apply immediately

---

## Screenshots

*[PHOTO PLACEHOLDER: Theme Editor Main View]*
*Add screenshot showing the theme editor with preset themes and custom themes list*

*[PHOTO PLACEHOLDER: Theme Creation Interface]*
*Add screenshot showing the new theme creation form with color inputs and preview*

*[PHOTO PLACEHOLDER: Color Picker]*
*Add screenshot showing the color picker interface*

---

## Tips for Good Themes

### Contrast Guidelines

- **Text on BG**: Minimum 4.5:1 ratio
- **Large Text**: Minimum 3:1 ratio
- **UI Components**: Minimum 3:1 ratio

### Color Harmony

- **Analogous**: Colors next to each other on wheel
- **Complementary**: Opposite colors for accents
- **Monochromatic**: Single hue, varying saturation/lightness

### Accessibility

- Don't rely solely on color
- Ensure sufficient contrast
- Test with color blindness simulators
- Consider dark/light variants

---

## Troubleshooting

### Theme Not Applying

1. Check JSON syntax in theme file
2. Verify all required variables present
3. Restart Hibiscus
4. Check browser console for errors

### Colors Look Wrong

- Verify hex format (6 digits, with #)
- Check CSS variable names match exactly
- Ensure base theme loads correctly

### Theme Disappeared

- Check `.hibiscus/themes/` folder exists
- Verify theme JSON files not corrupted
- Check file permissions

---

## Related Documentation

- [Theming System](theming.md) - Built-in themes reference
- [Status Bar](status-bar.md) - Theme selector location
