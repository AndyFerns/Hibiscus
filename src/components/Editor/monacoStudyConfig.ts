import * as monaco from "monaco-editor"

/**
 * ============================================================================
 * 🎨 THEME SETUP
 * ============================================================================
 */

export function registerHibiscusThemes() {
  monaco.editor.defineTheme("hibiscus-soft", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", foreground: "444444" },
      { token: "keyword", foreground: "7A8BA3" },
      { token: "string", foreground: "A3BE8C" },
      { token: "comment", foreground: "B0B0B0", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#FAFAF8",
      "editor.lineHighlightBackground": "#00000000",
      "editorCursor.foreground": "#888888",
    },
  })
}

/**
 * ============================================================================
 * ⚙️ BASE STUDY CONFIG
 * ============================================================================
 */

export function getStudyEditorOptions(
  content: string,
  language: string
): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    value: content,
    language,

    theme: "hibiscus-soft",
    automaticLayout: true,

    // Strip IDE feel
    minimap: { enabled: false },
    glyphMargin: false,
    folding: false,
    lineNumbers: "off",
    lineDecorationsWidth: 0,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,

    // Clean visuals
    scrollBeyondLastLine: false,
    renderLineHighlight: "none",
    occurrencesHighlight: "off",
    selectionHighlight: false,

    // Typography
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Inter, system-ui, sans-serif",
    fontLigatures: false,

    // Cursor feel
    cursorBlinking: "smooth",
    cursorStyle: "line",
    cursorWidth: 2,

    // Disable coding assist
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    parameterHints: { enabled: false },
    formatOnType: false,
    formatOnPaste: false,
    autoClosingBrackets: "never",
    autoClosingQuotes: "never",

    // UX
    contextmenu: false,
    links: false,
    wordWrap: "on",

    // Breathing room
    padding: { top: 20, bottom: 20 },
  }
}

/**
 * ============================================================================
 * 🌿 FOCUS MODE
 * ============================================================================
 */

export function setFocusMode(
  editor: monaco.editor.IStandaloneCodeEditor,
  enabled: boolean
) {
  editor.updateOptions({
    lineNumbers: enabled ? "off" : "on",
    minimap: { enabled: !enabled },
    renderLineHighlight: enabled ? "none" : "line",
  })
}

/**
 * ============================================================================
 * 🔮 PRESET SYSTEM (future-ready)
 * ============================================================================
 */

export const editorPresets = {
  study: {
    lineNumbers: "off",
    minimap: { enabled: false },
    renderLineHighlight: "none",
  },
  dev: {
    lineNumbers: "on",
    minimap: { enabled: true },
    renderLineHighlight: "line",
  },
}

export function applyPreset(
  editor: monaco.editor.IStandaloneCodeEditor,
  preset: keyof typeof editorPresets
) {
  editor.updateOptions(editorPresets[preset])
}