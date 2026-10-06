import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import type { BlockOverride, DocumentProject, DocumentStyle, TextStyle } from './models'
import { initialProject, presets } from './models'
import { renderDocument } from './renderer'
import { loadLocal, saveLocal } from './storage'
import PagedPreview from './PagedPreview'

const fonts = ['Inter, Arial, sans-serif', 'Arial, sans-serif', 'Helvetica, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'Roboto, sans-serif', 'Open Sans, sans-serif', 'Source Serif 4, serif']

type Selection = { id: string; type: string; text: string } | null

const download = (name: string, value: string, type: string) => {
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob([value], { type }))
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

function Field({ label, value, onChange, min = 0, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; step?: number }) {
  return <label className="field"><span>{label}</span><input type="number" min={min} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function App() {
  const [project, setProject] = useState<DocumentProject>(initialProject)
  const [selected, setSelected] = useState<Selection>(null)
  const [zoom, setZoom] = useState(0.72)
  const [pageCount, setPageCount] = useState(0)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [notice, setNotice] = useState('Listo para diseñar')
  const fileInput = useRef<HTMLInputElement>(null)
  const projectInput = useRef<HTMLInputElement>(null)

  useEffect(() => { loadLocal().then((saved) => { if (saved) { setProject(saved); setNotice('Proyecto local restaurado') } }).catch(() => undefined) }, [])
  const renderedDocument = useMemo(() => renderDocument(project.markdown), [project.markdown])
  const selectedOverride = selected ? project.overrides[selected.id] ?? { id: selected.id } : null
  const selectedBase: Partial<TextStyle> = selected?.type && ['h1', 'h2', 'h3'].includes(selected.type)
    ? project.style.headings[selected.type as 'h1' | 'h2' | 'h3'] : { ...project.style.body, marginBottom: project.style.body.paragraphSpacing }

  const changeStyle = (path: 'body' | 'h1' | 'h2' | 'h3', patch: Partial<DocumentStyle['body']>) => setProject((current) => ({
    ...current,
    style: path === 'body' ? { ...current.style, body: { ...current.style.body, ...patch } } : {
      ...current.style, headings: { ...current.style.headings, [path]: { ...current.style.headings[path], ...patch } },
    },
  }))

  const changeOverride = (patch: Partial<BlockOverride>) => {
    if (!selected) return
    setProject((current) => ({ ...current, overrides: { ...current.overrides, [selected.id]: { ...current.overrides[selected.id], id: selected.id, ...patch } } }))
  }

  const addLineBefore = (id: string, type: string) => setProject((current) => {
    const heading = type === 'h1' || type === 'h2' || type === 'h3' ? current.style.headings[type] : undefined
    const currentMargin = current.overrides[id]?.marginTop ?? heading?.marginTop ?? current.style.body.marginTop
    const line = current.style.body.fontSize * current.style.body.lineHeight
    return { ...current, overrides: { ...current.overrides, [id]: { ...current.overrides[id], id, marginTop: currentMargin + line } } }
  })

  const removeLineBefore = (id: string, type: string) => setProject((current) => {
    const heading = type === 'h1' || type === 'h2' || type === 'h3' ? current.style.headings[type] : undefined
    const baseMargin = heading?.marginTop ?? current.style.body.marginTop
    const currentMargin = current.overrides[id]?.marginTop ?? baseMargin
    const line = current.style.body.fontSize * current.style.body.lineHeight
    const marginTop = Math.max(baseMargin, currentMargin - line)
    return { ...current, overrides: { ...current.overrides, [id]: { ...current.overrides[id], id, marginTop } } }
  })

  const openMarkdown = async (file: File) => {
    const markdown = await file.text()
    setProject((current) => ({ ...current, name: file.name.replace(/\.md$/i, ''), markdown, overrides: {} }))
    setSelected(null); setNotice(`Abierto: ${file.name}`)
  }

  const importProject = async (file: File) => {
    try {
      const imported = JSON.parse(await file.text()) as DocumentProject
      if (imported.version !== 1 || !imported.style || typeof imported.markdown !== 'string') throw new Error('invalid')
      setProject(imported); setSelected(null); setNotice(`Proyecto importado: ${file.name}`)
    } catch { setNotice('El archivo .mdprint no es válido') }
  }

  const selectBlock = (event: React.MouseEvent<HTMLElement>) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]')
    if (!element) return
    setSelected({ id: element.dataset.blockId!, type: element.dataset.blockType!, text: element.textContent?.slice(0, 80) ?? '' })
  }

  const save = async () => { await saveLocal(project); setNotice('Proyecto guardado en este navegador') }
  const activeStyle = selectedOverride ? { ...selectedBase, ...selectedOverride } : null

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">M↓P</span><div><strong>Markdown to PDF</strong><small>Designer</small></div></div>
      <label className="document-name">Documento <input value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value })} /></label>
      <span className="page-count" aria-live="polite">{pageCount ? `${pageCount} hoja${pageCount === 1 ? '' : 's'}` : 'Paginando…'}</span>
      <div className="toolbar-actions">
        <button onClick={() => fileInput.current?.click()}>Abrir .md</button>
        <button onClick={() => setShowMarkdown((visible) => !visible)}>{showMarkdown ? 'Ocultar Markdown' : 'Ver Markdown'}</button>
        <button className={project.style.monochrome ? 'toggle-active' : ''} onClick={() => setProject((current) => ({ ...current, style: { ...current.style, monochrome: !current.style.monochrome } }))}>B/N</button>
        <button onClick={save}>Guardar</button>
        <button onClick={() => download(`${project.name || 'documento'}.mdprint`, JSON.stringify(project, null, 2), 'application/json')}>Exportar proyecto</button>
        <button className="primary" onClick={() => window.print()}>Exportar PDF</button>
      </div>
      <input ref={fileInput} className="visually-hidden" type="file" accept=".md,text/markdown,text/plain" onChange={(event) => event.target.files?.[0] && openMarkdown(event.target.files[0])} />
      <input ref={projectInput} className="visually-hidden" type="file" accept=".mdprint,application/json" onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} />
    </header>

    <section className={`workspace ${showMarkdown ? '' : 'preview-only'}`}>
      <aside className="editor-panel">
        <div className="panel-title"><span>MARKDOWN</span><button className="text-button" onClick={() => setProject({ ...project, markdown: `${project.markdown}\n\n<!-- pagebreak -->\n\n` })}>+ Salto de página</button></div>
        <CodeMirror value={project.markdown} height="calc(100vh - 168px)" extensions={[markdown()]} onChange={(markdown) => { setProject({ ...project, markdown }); setSelected(null) }} theme="light" basicSetup={{ lineNumbers: true, foldGutter: false }} />
        <div className="editor-footer"><button className="text-button" onClick={() => projectInput.current?.click()}>Importar .mdprint</button><span>Enter extra = espacio · {notice}</span></div>
      </aside>

      <section className="preview-panel">
        <div className="panel-title"><span>PREVIEW A4</span><label className="zoom">Zoom <input type="range" min="0.45" max="1" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /> {Math.round(zoom * 100)}%</label></div>
        <div className="paper-canvas">
          <PagedPreview html={renderedDocument} style={project.style} overrides={project.overrides} zoom={zoom} onSelect={selectBlock} onInsertLine={addLineBefore} onRemoveLine={removeLineBefore} onPageCount={setPageCount} onError={setPreviewError} />
        </div>
        <footer className="preview-footer">{previewError ? <span className="preview-error">{previewError}</span> : pageCount ? `${pageCount} página${pageCount === 1 ? '' : 's'}` : 'Paginando…'} <span>Enter baja una línea · Backspace sube una línea</span></footer>
      </section>

      <aside className="inspector-panel">
        <div className="panel-title"><span>DISEÑO</span></div>
        {selected && activeStyle ? <section className="inspector-section selection-card">
          <span className="eyebrow">ELEMENTO SELECCIONADO</span><strong>{selected.type.toUpperCase()}</strong><p>{selected.text || 'Bloque vacío'}</p>
          <Field label="Tamaño (pt)" value={activeStyle.fontSize ?? 11} onChange={(fontSize) => changeOverride({ fontSize })} />
          <label className="field"><span>Alineación</span><select value={activeStyle.textAlign ?? 'left'} onChange={(event) => changeOverride({ textAlign: event.target.value as TextStyle['textAlign'] })}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option><option value="justify">Justificado</option></select></label>
          <label className="check"><input type="checkbox" checked={(activeStyle.fontWeight ?? 400) >= 600} onChange={(event) => changeOverride({ fontWeight: event.target.checked ? 700 : 400 })} /> Negrita</label>
          <label className="check"><input type="checkbox" checked={activeStyle.fontStyle === 'italic'} onChange={(event) => changeOverride({ fontStyle: event.target.checked ? 'italic' : 'normal' })} /> Cursiva</label>
          <label className="check"><input type="checkbox" checked={Boolean(activeStyle.pageBreakBefore)} onChange={(event) => changeOverride({ pageBreakBefore: event.target.checked })} /> Salto antes</label>
          <button className="secondary small" onClick={() => addLineBefore(selected.id, selected.type)}>↓ Bajar 1 línea</button>
          <button className="secondary small" onClick={() => setProject({ ...project, overrides: Object.fromEntries(Object.entries(project.overrides).filter(([id]) => id !== selected.id)) })}>Quitar override</button>
        </section> : <section className="inspector-section"><span className="eyebrow">DOCUMENTO</span><p className="muted">Selecciona un bloque en la hoja para aplicar un override local.</p></section>}

        <section className="inspector-section"><h2>Página</h2><div className="field-grid"><Field label="Superior mm" value={project.style.margins.top} onChange={(top) => setProject({ ...project, style: { ...project.style, margins: { ...project.style.margins, top } } })} /><Field label="Inferior mm" value={project.style.margins.bottom} onChange={(bottom) => setProject({ ...project, style: { ...project.style, margins: { ...project.style.margins, bottom } } })} /><Field label="Izquierdo mm" value={project.style.margins.left} onChange={(left) => setProject({ ...project, style: { ...project.style, margins: { ...project.style.margins, left } } })} /><Field label="Derecho mm" value={project.style.margins.right} onChange={(right) => setProject({ ...project, style: { ...project.style, margins: { ...project.style.margins, right } } })} /></div></section>
        <section className="inspector-section"><h2>Tipografía</h2><label className="field"><span>Fuente</span><select value={project.style.body.fontFamily} onChange={(event) => changeStyle('body', { fontFamily: event.target.value })}>{fonts.map((font) => <option key={font} value={font}>{font.split(',')[0]}</option>)}</select></label><div className="field-grid"><Field label="Tamaño pt" value={project.style.body.fontSize} onChange={(fontSize) => changeStyle('body', { fontSize })} step={0.5} /><Field label="Interlineado" value={project.style.body.lineHeight} onChange={(lineHeight) => changeStyle('body', { lineHeight })} min={1} step={0.05} /><Field label="Párrafo pt" value={project.style.body.paragraphSpacing} onChange={(paragraphSpacing) => changeStyle('body', { paragraphSpacing })} /></div><label className="field"><span>Alineación</span><select value={project.style.body.textAlign} onChange={(event) => changeStyle('body', { textAlign: event.target.value as TextStyle['textAlign'] })}><option value="left">Izquierda</option><option value="justify">Justificado</option><option value="center">Centro</option><option value="right">Derecha</option></select></label></section>
        <section className="inspector-section"><h2>Títulos</h2>{(['h1', 'h2', 'h3'] as const).map((kind) => <div className="heading-row" key={kind}><strong>{kind.toUpperCase()}</strong><Field label="pt" value={project.style.headings[kind].fontSize} onChange={(fontSize) => changeStyle(kind, { fontSize })} /><label className="check"><input type="checkbox" checked={project.style.headings[kind].fontWeight >= 600} onChange={(event) => changeStyle(kind, { fontWeight: event.target.checked ? 700 : 400 })} /> Bold</label></div>)}</section>
        <section className="inspector-section"><h2>Presets</h2><div className="preset-list">{Object.entries(presets).map(([name, style]) => <button key={name} className="secondary" onClick={() => { setProject({ ...project, style: structuredClone(style) }); setNotice(`Preset aplicado: ${name}`) }}>{name}</button>)}</div></section>
      </aside>
    </section>
  </main>
}

export default App
