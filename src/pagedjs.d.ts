declare module 'pagedjs' {
  export class Previewer {
    preview(content: Element | DocumentFragment | string, stylesheets: string[], renderTo: Element): Promise<unknown>
  }
}
