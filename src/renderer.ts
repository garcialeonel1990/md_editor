import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import type { BlockOverride, DocumentStyle } from './models'

// A visible line break is useful in a layout editor: pressing Enter in the
// Markdown editor moves the following content down in the A4 preview.
const parser = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: true })
const blockTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'PRE', 'HR'])

export function renderDocument(markdown: string): string {
  let index = 0
  const segments = markdown.replaceAll('\r\n', '\n').split(/<!--\s*pagebreak\s*-->/i)
  return segments.map((segment) => {
    // Markdown needs one blank line to separate blocks. Further empty lines are
    // layout intent, so preserve them as visible vertical space in the preview.
    return segment.split(/(\n{3,})/).map((part) => {
      if (/^\n{3,}$/.test(part)) {
        const extraLines = part.length - 2
        return '<div class="manual-spacer" aria-hidden="true"></div>'.repeat(extraLines)
      }
      const source = DOMPurify.sanitize(parser.render(part))
      const document = new DOMParser().parseFromString(source, 'text/html')
      Array.from(document.body.children).forEach((element) => {
        if (!blockTags.has(element.tagName)) return
        const id = `block-${index++}`
        element.setAttribute('data-block-id', id)
        element.setAttribute('data-block-type', element.tagName.toLowerCase())
      })
      return document.body.innerHTML
    }).join('')
  }).join('<div class="manual-page-break" aria-hidden="true"></div>')
}
