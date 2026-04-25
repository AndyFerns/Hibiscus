import * as monaco from "monaco-editor"

/**
 * ============================================================================
 * ⚙️ BASE EDITOR CONFIG
 * ============================================================================
 *
 * Returns the Monaco editor construction options for study-focused editing.
 * Theme is set to 'hibiscus-dynamic' which is defined by the
 * editorThemeAdapter.ts module from CSS variables.
 *
 * NOTE: registerHibiscusThemes() was removed — the dynamic CSS adapter
 * (applyEditorThemeFromCSS) now handles all theme registration.
 * ============================================================================
 */

export function getEditorConfig(
  content: string,
  language: string
): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    value: content,
    language,

    // Theme is defined dynamically by editorThemeAdapter.ts from CSS variables
    theme: "hibiscus-dynamic",
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
    fontFamily: "var(--font-ui)",
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

    // Disable native search
    find: {
      addExtraSpaceOnTop: false,
      autoFindInSelection: "never",
      seedSearchStringFromSelection: "never",
    },

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