import Editor from "@monaco-editor/react"

/**
 * Function for language detection from path
 */
function getLanguageFromPath(path: string): string {
  const extension = path.toLowerCase().split(".").pop()
  switch (extension) {
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
  onChange
}: {
  path: string
  content: string
  onChange: (value: string) => void
}) {
  return (
    <Editor
      height="100%"
      language={getLanguageFromPath(path)}
      value={content}
      theme="vs-dark"
      options={{
        wordWrap: "on",
        minimap: { enabled: false },
        fontSize: 14
      }}
      onChange={(v) => onChange(v ?? "")}
    />
  )
}
