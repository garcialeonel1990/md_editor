export type Alignment = 'left' | 'center' | 'right' | 'justify'

export interface TextStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  textAlign: Alignment
  marginTop: number
  marginBottom: number
  pageBreakBefore?: boolean
  pageBreakAfter?: boolean
}

export interface DocumentStyle {
  margins: { top: number; right: number; bottom: number; left: number }
  monochrome?: boolean
  body: TextStyle & { lineHeight: number; paragraphSpacing: number }
  headings: Record<'h1' | 'h2' | 'h3', TextStyle>
}

export interface BlockOverride extends Partial<TextStyle> {
  id: string
}

export interface DocumentProject {
  version: 1
  name: string
  markdown: string
  style: DocumentStyle
  overrides: Record<string, BlockOverride>
}

export const defaultMarkdown = `# Diseño de documentos Markdown

Convierte tus notas en documentos preparados para imprimir sin perder la simplicidad de **Markdown**.

## Un flujo visual y editable

Selecciona cualquier bloque en esta vista previa para ajustar solo ese elemento. Los cambios globales se administran desde el panel de diseño.

> El preview y el PDF comparten los mismos estilos de impresión.

### Lista de posibilidades

- Editar el contenido a la izquierda.
- Personalizar tipografías y márgenes.
- Insertar un salto de página con \`<!-- pagebreak -->\`.

| Función | Estado |
| --- | --- |
| Preview A4 | Listo |
| Estilos | Listo |
| PDF | Listo para imprimir |
`

const heading = (fontSize: number): TextStyle => ({
  fontFamily: 'Inter, Arial, sans-serif', fontSize, fontWeight: 700, fontStyle: 'normal',
  textAlign: 'left', marginTop: 16, marginBottom: 8,
})

export const defaultStyle: DocumentStyle = {
  margins: { top: 16, right: 18, bottom: 16, left: 18 },
  monochrome: false,
  body: {
    fontFamily: 'Inter, Arial, sans-serif', fontSize: 11, fontWeight: 400, fontStyle: 'normal',
    textAlign: 'left', marginTop: 0, marginBottom: 0, lineHeight: 1.45, paragraphSpacing: 7,
  },
  headings: { h1: heading(22), h2: heading(16), h3: heading(13) },
}

export const initialProject = (): DocumentProject => ({
  version: 1, name: 'Documento sin título', markdown: defaultMarkdown,
  style: structuredClone(defaultStyle), overrides: {},
})

export const presets: Record<string, DocumentStyle> = {
  'Lectura cómoda': {
    ...structuredClone(defaultStyle), margins: { top: 22, right: 22, bottom: 22, left: 22 },
    body: { ...structuredClone(defaultStyle).body, fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.55 },
  },
  'Apunte universidad': {
    ...structuredClone(defaultStyle), margins: { top: 13, right: 13, bottom: 13, left: 13 },
    body: { ...structuredClone(defaultStyle).body, fontFamily: 'Arial, sans-serif', fontSize: 10.5, lineHeight: 1.2 },
    headings: { h1: { ...heading(18) }, h2: { ...heading(14) }, h3: { ...heading(12) } },
  },
  'Impresión compacta': {
    ...structuredClone(defaultStyle), margins: { top: 10, right: 10, bottom: 10, left: 10 },
    body: { ...structuredClone(defaultStyle).body, fontFamily: 'Arial, sans-serif', fontSize: 9.5, lineHeight: 1.15, paragraphSpacing: 4 },
  },
}
