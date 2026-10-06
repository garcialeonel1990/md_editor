import type { DocumentProject } from './models'

const dbName = 'markdown-pdf-designer'
const storeName = 'projects'

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveLocal(project: DocumentProject) {
  const db = await database()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(project, 'current')
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
  })
  db.close()
}

export async function loadLocal(): Promise<DocumentProject | undefined> {
  const db = await database()
  const project = await new Promise<DocumentProject | undefined>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get('current')
    request.onsuccess = () => resolve(request.result as DocumentProject | undefined); request.onerror = () => reject(request.error)
  })
  db.close(); return project
}
