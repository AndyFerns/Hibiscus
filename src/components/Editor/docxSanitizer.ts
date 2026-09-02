// Tags mammoth legitimately emits. Anything outside this set is unwrapped.
const DOCX_ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUP', 'SUB',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
  'A', 'IMG', 'SPAN', 'DIV', 'HR',
])

/**
 * Sanitize mammoth's HTML before injecting it.
 *
 * The output is derived from a file the user opened, which is not the same as
 * content the user authored — a hostile .docx can carry embedded markup. This
 * strips scripting vectors (script/iframe/object, on* handlers, javascript:
 * URLs) while keeping the document's structure intact. Done with DOMParser so
 * no sanitizer dependency is needed.
 */
export function sanitizeDocxHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const container = doc.createElement('div')
  container.innerHTML = html

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child)

      if (!DOCX_ALLOWED_TAGS.has(child.tagName)) {
        // Unwrap unknown elements rather than dropping their text.
        child.replaceWith(...Array.from(child.childNodes))
        continue
      }

      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase()
        const value = attr.value.trim().toLowerCase()

        const isUnsafeUrl =
          (name === 'href' || name === 'src') &&
          (value.startsWith('javascript:') || value.startsWith('data:text/html'))

        if (name.startsWith('on') || isUnsafeUrl) {
          child.removeAttribute(attr.name)
        }
      }
    }
  }

  walk(container)
  return container.innerHTML
}
