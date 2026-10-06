declare module 'pagedjs' {
  export class Previewer {
    preview(content: Element | DocumentFragment | string, stylesheets: Array<string | Record<string, string>>, renderTo: Element): Promise<unknown>
  }
}
