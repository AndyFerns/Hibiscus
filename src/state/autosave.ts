import { invoke } from "@tauri-apps/api/core"

let saveTimeout: number | null = null

export function scheduleSave(path: string, content: string) {
  if (saveTimeout) clearTimeout(saveTimeout)

  saveTimeout = window.setTimeout(() => {
    invoke("write_text_file", { path, contents: content })
  }, 800)
}
