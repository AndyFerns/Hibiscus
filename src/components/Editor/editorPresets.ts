import * as monaco from "monaco-editor"

/**
 * ============================================================================
 * 🔮 PRESET SYSTEM (future-ready)
 * ============================================================================
 *
 * Editor behavior presets (NOT themes). These control layout options like
 * line numbers and minimap visibility — separate from color theming.
 * ============================================================================
 */

export const editorPresets = {
  study: {
    lineNumbers: "off" as const,
    minimap: { enabled: false },
    renderLineHighlight: "none" as const,
  },
  dev: {
    lineNumbers: "on" as const,
    minimap: { enabled: true },
    renderLineHighlight: "line" as const,
  },
}

export function applyPreset(
  editor: monaco.editor.IStandaloneCodeEditor,
  preset: keyof typeof editorPresets
) {
  editor.updateOptions(editorPresets[preset])
}