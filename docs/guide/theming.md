# Theming System

Hibiscus leverages a highly flexible, CSS variable-driven **Hot-Swappable Theme System**. Themes are applied universally without requiring a window reload.

## Available Built-in Themes

You can switch themes seamlessly at runtime using the `ThemeSelector` located in the bottom right **Status Bar**.

1. **Midnight** (Default): A high-contrast, deep purple/blue dark mode tailored for late-night editing.
2. **Dawn**: A soft, warm, low-contrast light mode that's easy on the eyes during daylight.
3. **Forest**: A calming, deep-green and earthy tone variant.

## Architecture

Theming is built upon `[data-theme]` attributes injected directly into `document.documentElement` by the `ThemeContext.tsx` provider.

![Hibiscus Theming](../assets/Hibiscus%20Theme%20Selection.png)

### Core CSS Structure

The base layout defines semantic tokens within the `:root` scope in `src/styles/theme.css`:

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --spacing-md: 16px;
  /* Structural variables */
}
```

### Theme Variants

Color definitions are strictly mapped onto specific theme blocks:

```css
[data-theme="midnight"] {
  --bg-primary: #0f111a;
  --text-primary: #ffffff;
  --accent: #bb86fc;
}

[data-theme="dawn"] {
  --bg-primary: #f8f9fa;
  --text-primary: #212529;
  --accent: #fd7e14;
}
```

### Local Persistence

Your selection is cached seamlessly via `localStorage` directly in `ThemeContext`, retaining your visual layout across reboots.
