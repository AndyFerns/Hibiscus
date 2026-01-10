import Editor from "@monaco-editor/react"

export function EditorView({
  path,
  content,
  onChange
}: {
  path: string
  content: string
  onChange: (value: string) => void
}) {
  const extension = path.split(".").pop()

  const language =
    extension === "md" ? "markdown" :
    extension === "txt" ? "plaintext" : "plaintext"

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      options={{
        wordWrap: "on",
        minimap: { enabled: false },
        fontSize: 14
      }}
      onChange={(v) => v && onChange(v)}
    />
  )
}
