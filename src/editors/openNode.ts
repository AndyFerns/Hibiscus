import { Node } from "../types/workspace"
import { openMarkdown } from "./markdown"
import { openPlainText } from "./plaintext"
import { openPdf } from "./pdf"

export function openNode(node: Node) {
  if (!node.path) {
    console.warn("Node has no path:", node)
    return
  }

  const ext = getExtension(node.path)

  switch (ext) {
    case "md":
      openMarkdown(node)
      break
    case "txt":
      openPlainText(node)
      break
    case "pdf":
      openPdf(node)
      break
    default:
      openFallback(node)
  }
}

function getExtension(path: string): string | undefined {
  const idx = path.lastIndexOf(".")
  if (idx === -1) return undefined
  return path.slice(idx + 1).toLowerCase()
}

function openFallback(node: Node) {
  console.warn("No editor registered for:", node.path)
}
