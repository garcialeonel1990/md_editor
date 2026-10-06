import { useEffect, useRef } from 'react'
import type { BlockOverride, DocumentStyle, TextStyle } from './models'

interface Props {
  html: string
  style: DocumentStyle
  overrides: Record<string, BlockOverride>
  zoom: number
  onSelect: (event: React.MouseEvent<HTMLElement>) => void
  onInsertLine: (id: string, type: string) => void
  onRemoveLine: (id: string, type: string) => void
  onPageCount: (count: number) => void
  onError: (message: string | null) => void
}

const declarations = (value: Partial<TextStyle>) => [
  value.fontFamily && `font-family:${value.fontFamily}`,
  value.fontSize !== undefined && `font-size:${value.fontSize}pt`,
  value.fontWeight !== undefined && `font-weight:${value.fontWeight}`,
  value.fontStyle && `font-style:${value.fontStyle}`,
  value.textAlign && `text-align:${value.textAlign}`,
  value.marginTop !== undefined && `margin-top:${value.marginTop}pt`,
  value.marginBottom !== undefined && `margin-bottom:${value.marginBottom}pt`,
  value.pageBreakBefore && 'break-before:page',
  value.pageBreakAfter && 'break-after:page',
].filter(Boolean).join(';')

export default function PagedPreview({ html, style, overrides, zoom, onSelect, onInsertLine, onRemoveLine, onPageCount, onError }: Props) {
  const target = useRef<HTMLDivElement>(null)
  const run = useRef(0)
  const activeBlockId = useRef<string | null>(null)
  const viewportAnchor = useRef<{ id: string; top: number; scrollTop: number } | null>(null)

  const captureViewportAnchor = () => {
    const renderTarget = target.current
    const id = activeBlockId.current
    const scrollContainer = renderTarget?.closest<HTMLElement>('.paper-canvas')
    const block = id ? Array.from(renderTarget?.querySelectorAll<HTMLElement>('[data-block-id]') ?? []).find((element) => element.dataset.blockId === id) : null
    if (id && block && scrollContainer) {
      viewportAnchor.current = { id, top: block.getBoundingClientRect().top, scrollTop: scrollContainer.scrollTop }
    }
  }

  useEffect(() => {
    if (!target.current) return
    const currentRun = ++run.current
    const renderTarget = target.current
    // Rebuilding the A4 pages must not make someone lose their place while
    // nudging an element several lines down.
    const scrollContainer = renderTarget.closest<HTMLElement>('.paper-canvas')
    const anchor = viewportAnchor.current
    const previousScrollTop = anchor?.scrollTop ?? scrollContainer?.scrollTop ?? 0
    const blockToRestore = anchor?.id ?? activeBlockId.current
    const previousBlockTop = anchor?.top
    renderTarget.replaceChildren()
    onPageCount(0)
    onError(null)

    const render = async () => {
      try {
        await document.fonts?.ready
        if (run.current !== currentRun) return

        const source = document.createRange().createContextualFragment(html)
        const blocks = Array.from(source.childNodes).filter((node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())
        const overrideCss = Object.entries(overrides).map(([id, block]) => `.visual-page [data-block-id="${id}"]{${declarations(block)}}`).join('\n')
        const styleTag = document.createElement('style')
        styleTag.textContent = `
          .visual-page-content { font-family:${style.body.fontFamily}; font-size:${style.body.fontSize}pt; font-weight:${style.body.fontWeight}; font-style:${style.body.fontStyle}; line-height:${style.body.lineHeight}; text-align:${style.body.textAlign}; color:#1f2937; }
          .visual-page-content p { margin-top:${style.body.marginTop}pt; margin-bottom:${style.body.paragraphSpacing}pt; }
          .visual-page-content h1, .visual-page-content h2, .visual-page-content h3 { line-height:1.18; }
          .visual-page-content h1 { color:#172554; ${declarations(style.headings.h1)} }
          .visual-page-content h2 { color:#3730a3; ${declarations(style.headings.h2)} }
          .visual-page-content h3 { ${declarations(style.headings.h3)} }
          .visual-page-content blockquote { border-left:3px solid #818cf8; padding-left:12px; color:#475569; margin-left:0; }
          .visual-page-content pre { background:#f1f5f9; padding:11px; border-radius:5px; overflow:auto; text-align:left; white-space:pre-wrap; }
          .visual-page-content table { border-collapse:collapse; width:100%; text-align:left; }
          .visual-page-content th, .visual-page-content td { border:1px solid #cbd5e1; padding:5px 7px; }
          .visual-page-content th { background:#f1f5f9; } .visual-page-content img { max-width:100%; max-height:120mm; }
          .manual-spacer { height:${style.body.fontSize * style.body.lineHeight}pt; }
          ${overrideCss}
        `
        renderTarget.append(styleTag)

        let pageCount = 0
        let content: HTMLDivElement | undefined
        const newPage = () => {
          const page = document.createElement('article')
          page.className = 'visual-page'
          page.style.padding = `${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm`
          content = document.createElement('div')
          content.className = 'visual-page-content'
          page.append(content)
          const number = document.createElement('span')
          number.className = 'visual-page-number'
          number.textContent = String(++pageCount)
          page.append(number)
          renderTarget.append(page)
          return content
        }

        for (const block of blocks) {
          if (block instanceof HTMLElement && block.classList.contains('manual-page-break')) {
            content = undefined
            continue
          }
          const destination = content ?? newPage()
          destination.append(block)
          if (destination.scrollHeight > destination.clientHeight + 1 && destination.childElementCount > 1) {
            destination.removeChild(block)
            newPage().append(block)
          }
        }
        if (pageCount === 0) newPage()
        if (run.current === currentRun) {
          onPageCount(pageCount)
          requestAnimationFrame(() => {
            if (run.current !== currentRun) return
            const selectedBlock = blockToRestore
              ? Array.from(renderTarget.querySelectorAll<HTMLElement>('[data-block-id]')).find((block) => block.dataset.blockId === blockToRestore)
              : null
            if (scrollContainer && selectedBlock && previousBlockTop !== undefined) {
              // The empty intermediate render may clamp scrollTop to zero.
              // Re-anchor to the selected block's former on-screen position,
              // which also works when pagination moves it to another page.
              scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + selectedBlock.getBoundingClientRect().top - previousBlockTop)
            } else if (scrollContainer) {
              scrollContainer.scrollTop = previousScrollTop
            }
            if (selectedBlock) {
              // The paginator creates a fresh DOM node on every adjustment.
              // Make that replacement focusable again so Enter can be pressed
              // repeatedly without selecting the block another time.
              selectedBlock.tabIndex = 0
              selectedBlock.focus({ preventScroll: true })
            }
          })
        }
      } catch (error) {
        if (run.current !== currentRun) return
        const detail = error instanceof Error ? error.message : 'Error desconocido'
        onError(`No se pudo paginar el documento: ${detail}`)
      }
    }
    void render()
    return () => {
      captureViewportAnchor()
      run.current += 1
      renderTarget.replaceChildren()
    }
  }, [html, style, overrides, onPageCount, onError])

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    const block = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]')
    if (block) {
      activeBlockId.current = block.dataset.blockId ?? null
      block.tabIndex = 0
      block.focus()
      captureViewportAnchor()
    }
    onSelect(event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Backspace') return
    const block = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]')
    if (!block?.dataset.blockId || !block.dataset.blockType) return
    event.preventDefault()
    captureViewportAnchor()
    if (event.key === 'Enter') onInsertLine(block.dataset.blockId, block.dataset.blockType)
    else onRemoveLine(block.dataset.blockId, block.dataset.blockType)
  }

  return <div className="paged-preview-zoom" style={{ zoom }}><div ref={target} className="paged-preview" onClick={handleClick} onKeyDown={handleKeyDown} /></div>
}
