/**
 * ============================================================================
 * useNotesSynthesis — Notes Combination & Structuring Hook
 * ============================================================================
 *
 * Combines multiple text/markdown files into a single structured document.
 *
 * SUPPORTED:
 * - .txt files: Read via backend, included as-is under a heading
 * - .md files: Read via backend, headings extracted and merged
 *
 * STUBBED (pipeline ready):
 * - .pdf: Returns "Format not yet supported" placeholder
 * - .docx: Returns "Format not yet supported" placeholder
 *
 * OUTPUT:
 * A structured markdown file with combined content under a unified heading.
 * ============================================================================
 */

import { useState, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { SynthesisInput, SynthesisOutput, NoteFormat } from "./notesTypes"

// =============================================================================
// HELPERS
// =============================================================================

/** Detect file format from extension */
function detectFormat(name: string): NoteFormat {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "md": return "md"
    case "txt": return "txt"
    case "pdf": return "pdf"
    case "docx": case "doc": return "docx"
    default: return "txt"
  }
}

/** Extract a title from a filename */
function titleFromName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")    // Remove extension
    .replace(/[-_]/g, " ")       // Replace dashes/underscores
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Title case
}

// =============================================================================
// HOOK
// =============================================================================

export function useNotesSynthesis(workspaceRoot: string | null) {
  const [inputs, setInputs] = useState<SynthesisInput[]>([])
  const [output, setOutput] = useState<SynthesisOutput | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Add files to the input list and read their content.
   */
  const addFiles = useCallback(
    async (filePaths: string[]) => {
      const newInputs: SynthesisInput[] = []

      for (const path of filePaths) {
        const name = path.split(/[/\\]/).pop() || path
        const format = detectFormat(name)

        // Only read supported formats
        if (format === "pdf" || format === "docx") {
          newInputs.push({ path, name, format, content: undefined })
          continue
        }

        try {
          const content = await invoke<string>("read_text_file", { path })
          newInputs.push({ path, name, format, content })
        } catch (err) {
          console.warn(`[Notes] Failed to read ${name}:`, err)
          newInputs.push({ path, name, format, content: `[Error reading file: ${name}]` })
        }
      }

      setInputs((prev) => [...prev, ...newInputs])
      setError(null)
    },
    []
  )

  /**
   * Remove a file from the input list.
   */
  const removeFile = useCallback((path: string) => {
    setInputs((prev) => prev.filter((i) => i.path !== path))
  }, [])

  /**
   * Clear all inputs and output.
   */
  const clearAll = useCallback(() => {
    setInputs([])
    setOutput(null)
    setError(null)
  }, [])

  /**
   * Synthesize the input files into a single structured markdown document.
   */
  const synthesize = useCallback(() => {
    if (inputs.length === 0) {
      setError("Add at least one file to synthesize.")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const supportedInputs = inputs.filter((i) => i.content !== undefined)
      const unsupportedInputs = inputs.filter((i) => i.content === undefined)

      if (supportedInputs.length === 0) {
        setError("No supported files to synthesize. Only .txt and .md are currently supported.")
        setIsProcessing(false)
        return
      }

      // Generate the combined title
      const combinedTitle =
        inputs.length === 1
          ? titleFromName(inputs[0].name)
          : "Combined Notes"

      // Build the markdown output
      let md = `# ${combinedTitle}\n\n`
      md += `> Synthesized from ${supportedInputs.length} file(s)\n\n`

      for (const input of supportedInputs) {
        const sectionTitle = titleFromName(input.name)
        md += `## ${sectionTitle}\n\n`

        if (input.content) {
          // For .md files, avoid duplicating top-level headings
          const content = input.content
            .replace(/^# .+$/gm, "")  // Remove H1 headings (we add our own)
            .trim()

          md += `${content}\n\n`
        }

        md += `---\n\n`
      }

      // Add unsupported file notices
      if (unsupportedInputs.length > 0) {
        md += `## Unsupported Files\n\n`
        md += `The following files could not be processed (format not yet supported):\n\n`
        for (const input of unsupportedInputs) {
          md += `- 📄 ${input.name} (${input.format.toUpperCase()})\n`
        }
        md += `\n`
      }

      const result: SynthesisOutput = {
        title: combinedTitle,
        content: md,
        sources: inputs.map((i) => i.name),
      }

      setOutput(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synthesis failed")
    } finally {
      setIsProcessing(false)
    }
  }, [inputs])

  /**
   * Save the synthesis output as a .md file in the workspace.
   */
  const saveOutput = useCallback(
    async (filename?: string) => {
      if (!output || !workspaceRoot) return

      const name = filename || `${output.title.toLowerCase().replace(/\s+/g, "-")}.md`
      const path = `${workspaceRoot}/${name}`

      try {
        await invoke("write_text_file", { path, content: output.content })
        return path
      } catch (err) {
        setError(`Failed to save: ${err}`)
        return null
      }
    },
    [output, workspaceRoot]
  )

  return {
    inputs,
    output,
    isProcessing,
    error,
    addFiles,
    removeFile,
    clearAll,
    synthesize,
    saveOutput,
  }
}
