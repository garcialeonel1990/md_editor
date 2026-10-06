import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import type { CSSProperties } from 'react'
import type { BlockOverride, DocumentStyle, TextStyle } from './models'

const parser = new MarkdownIt({ html: false, linkify: true, typographer: true })
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

export interface RenderedPage { html: string; blockIds: string[] }

export function renderPages(markdown: string, style: DocumentStyle, overrides: Record<string, BlockOverride>): RenderedPage[] {
  let index = 0
  const segments = markdown.split(/<!--\s*pagebreak\s*-->/i)
  return segments.map((segment) => {
    const source = DOMPurify.sanitize(parser.render(segment))
    const document = new DOMParser().parseFromString(source, 'text/html')
    const blockIds: string[] = []
    Array.from(document.body.children).forEach((element) => {
      if (!blockTags.has(element.tagName)) return
      const id = `block-${index++}`
      const tag = element.tagName.toLowerCase()
      const base = tag === 'p' ? { marginBottom: style.body.paragraphSpacing } : tag in style.headings ? style.headings[tag as keyof typeof style.headings] : {}
      element.setAttribute('data-block-id', id)
      element.setAttribute('data-block-type', tag)
      element.setAttribute('style', css({ ...base, ...overrides[id] }))
      blockIds.push(id)
    })
    return { html: document.body.innerHTML, blockIds }
  })
}

export function pageVariables(style: DocumentStyle): CSSProperties {
  return {
    '--page-top': `${style.margins.top}mm`, '--page-right': `${style.margins.right}mm`,
    '--page-bottom': `${style.margins.bottom}mm`, '--page-left': `${style.margins.left}mm`,
    '--body-font': style.body.fontFamily, '--body-size': `${style.body.fontSize}pt`,
    '--body-weight': style.body.fontWeight, '--body-style': style.body.fontStyle,
    '--body-align': style.body.textAlign, '--body-leading': String(style.body.lineHeight),
  } as CSSProperties
}
