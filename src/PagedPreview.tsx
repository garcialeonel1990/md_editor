import { useEffect, useRef } from 'react'
import { Previewer } from 'pagedjs'
import type { DocumentStyle } from './models'

interface Props {
  html: string
  style: DocumentStyle
  zoom: number
  onSelect: (event: React.MouseEvent<HTMLElement>) => void
  onPageCount: (count: number) => void
  onError: (message: string | null) => void
}

export default function PagedPreview({ html, style, zoom, onSelect, onPageCount, onError }: Props) {
  const target = useRef<HTMLDivElement>(null)
  const run = useRef(0)

  useEffect(() => {
    if (!target.current) return
    const currentRun = ++run.current
    const renderTarget = target.current
    renderTarget.replaceChildren()
    onPageCount(0)
    onError(null)

    const source = document.createElement('article')
    source.className = 'print-source'
    source.innerHTML = html

    const pageCss = `
      @page { size: A4 portrait; margin: ${style.margins.top}mm ${style.margins.right}mm ${style.margins.bottom}mm ${style.margins.left}mm;
        @bottom-center { content: counter(page); color: #94a3b8; font-family: Inter, Arial, sans-serif; font-size: 8pt; }
      }
      .print-source { font-family: ${style.body.fontFamily}; font-size: ${style.body.fontSize}pt; font-weight: ${style.body.fontWeight}; font-style: ${style.body.fontStyle}; line-height: ${style.body.lineHeight}; text-align: ${style.body.textAlign}; color: #1f2937; }
      .print-source h1, .print-source h2, .print-source h3 { line-height: 1.18; }
      .print-source h1 { color: #172554; } .print-source h2 { color: #3730a3; }
      .print-source blockquote { border-left: 3px solid #818cf8; padding-left: 12px; color: #475569; margin-left: 0; }
      .print-source pre { background: #f1f5f9; padding: 11px; border-radius: 5px; overflow: auto; text-align: left; white-space: pre-wrap; }
      .print-source table { border-collapse: collapse; width: 100%; text-align: left; break-inside: avoid; }
      .print-source th, .print-source td { border: 1px solid #cbd5e1; padding: 5px 7px; }
      .print-source th { background: #f1f5f9; } .print-source img { max-width: 100%; max-height: 120mm; }
      .print-source [data-block-id] { break-inside: avoid; }
      .manual-spacer { break-inside: avoid; }
      .manual-page-break { break-after: page; page-break-after: always; height: 0; }
    `
    const previewer = new Previewer()

    // Supplying the stylesheet in-memory avoids a second network request. This
    // matters on static hosts such as GitHub Pages and keeps pagination local.
    previewer.preview(source, [{ [window.location.href]: pageCss }], renderTarget).then(() => {
      if (run.current !== currentRun) return
      onPageCount(renderTarget.querySelectorAll('.pagedjs_page').length)
    }).catch((error: unknown) => {
      if (run.current !== currentRun) return
      const detail = error instanceof Error ? error.message : 'Error desconocido'
      onError(`No se pudo paginar el documento: ${detail}`)
    })

    return () => {
      run.current += 1
      renderTarget.replaceChildren()
    }
  }, [html, style, onPageCount, onError])

  return <div className="paged-preview-zoom" style={{ zoom }}><div ref={target} className="paged-preview" onClick={onSelect} /></div>
}
