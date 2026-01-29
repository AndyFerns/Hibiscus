import * as monaco from "monaco-editor"
import { useEffect, useRef } from "react"

/**
 * Function for language detection from path
 */
function getLanguageFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop()
  switch (ext) {
    case "md":
      return "markdown"
    case "txt":
      return "plaintext"
    default:
      return "plaintext"
  }
}


export function EditorView({
  path,
  content,
  onChange,
}: {
  path: string
  content: string
  onChange: (value: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: content,
      language: getLanguageFromPath(path),
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: "on",
    })

    editorRef.current.onDidChangeModelContent(() => {
      onChange(editorRef.current!.getValue())
    })

    return () => {
      editorRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model && model.getValue() !== content) {
      model.setValue(content)
    }
  }, [content])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, getLanguageFromPath(path))
    }
  }, [path])

  return (
    <div 
      ref={containerRef} 
      style={{ 
        flex: 1,        // THIS is the key
        minHeight: 0,   // prevents overflow bugs in flex/grid
      }} 
    />
  )
}
