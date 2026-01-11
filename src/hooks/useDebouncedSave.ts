import { useRef } from "react"
import { invoke } from "@tauri-apps/api/core"

export function useDebouncedSave(delay = 500) {
  const timer = useRef<number | null>(null)

  return (path: string, content: string) => {
    if (timer.current) {
      clearTimeout(timer.current)
    }

    timer.current = window.setTimeout(() => {
      invoke("write_text_file", {
        path,
        contents: content
      }).catch(console.error)
    }, delay)
  }
}
