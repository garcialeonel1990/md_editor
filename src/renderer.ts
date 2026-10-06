import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import type { BlockOverride, DocumentStyle, TextStyle } from './models'

// A visible line break is useful in a layout editor: pressing Enter in the
// Markdown editor moves the following content down in the A4 preview.
const parser = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: true })
const blockTags = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'PRE', 'HR'])

const css = (style: Partial<TextStyle>) => [
  style.fontFamily && `font-family:${style.fontFamily}`,
  style.fontSize && `font-size:${style.fontSize}pt`,
  style.fontWeight && `font-weight:${style.fontWeight}`,
  style.fontStyle && `font-style:${style.fontStyle}`,
  style.textAlign && `text-align:${style.textAlign}`,
  style.marginTop !== undefined && `margin-top:${style.marginTop}pt`,
  style.marginBottom !== undefined && `margin-bottom:${style.marginBottom}pt`,
  style.pageBreakBefore && 'break-before:page',
  style.pageBreakAfter && 'break-after:page',
].filter(Boolean).join(';')

export function renderDocument(markdown: string, style: DocumentStyle, overrides: Record<string, BlockOverride>): string {
  let index = 0
  const segments = markdown.replaceAll('\r\n', '\n').split(/<!--\s*pagebreak\s*-->/i)
  return segments.map((segment) => {
    // Markdown needs one blank line to separate blocks. Further empty lines are
    // layout intent, so preserve them as visible vertical space in the preview.
    return segment.split(/(\n{3,})/).map((part) => {
      if (/^\n{3,}$/.test(part)) {
        const extraLines = part.length - 2
        const height = extraLines * style.body.fontSize * style.body.lineHeight
        return `<div class="manual-spacer" style="height:${height}pt" aria-hidden="true"></div>`
      }
      const source = DOMPurify.sanitize(parser.render(part))
      const document = new DOMParser().parseFromString(source, 'text/html')
      Array.from(document.body.children).forEach((element) => {
        if (!blockTags.has(element.tagName)) return
        const id = `block-${index++}`
        const tag = element.tagName.toLowerCase()
        const base = tag === 'p' ? { marginBottom: style.body.paragraphSpacing } : tag in style.headings ? style.headings[tag as keyof typeof style.headings] : {}
        element.setAttribute('data-block-id', id)
        element.setAttribute('data-block-type', tag)
        element.setAttribute('style', css({ ...base, ...overrides[id] }))
      })
      return document.body.innerHTML
    }).join('')
  }).join('<div class="manual-page-break" aria-hidden="true"></div>')
}
