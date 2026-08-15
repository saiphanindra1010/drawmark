export type DocumentFile = {
  markdown: string
  name: string
  handle?: FileSystemFileHandle
  github?: {
    owner: string
    repo: string
    path: string
    sha: string
    branch: string
  }
}

export interface StorageAdapter {
  open(): Promise<DocumentFile>
  save(doc: DocumentFile): Promise<DocumentFile>
}

const ACCEPT: FilePickerAcceptType[] = [
  {
    description: 'Markdown / Mermaid',
    accept: { 'text/markdown': ['.md', '.mmd', '.markdown'], 'text/plain': ['.md', '.mmd'] },
  },
]

export const fileStorage: StorageAdapter = {
  async open() {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: ACCEPT,
      })
      if (!handle) throw new Error('No file selected')
      const file = await handle.getFile()
      return { markdown: await file.text(), name: file.name, handle }
    }
    return openFallback()
  },
  async save(doc) {
    if (doc.handle && 'createWritable' in doc.handle) {
      const writable = await doc.handle.createWritable()
      await writable.write(doc.markdown)
      await writable.close()
      return doc
    }
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: doc.name || 'architecture.md',
        types: ACCEPT,
      })
      const writable = await handle.createWritable()
      await writable.write(doc.markdown)
      await writable.close()
      return { ...doc, name: handle.name, handle }
    }
    downloadFallback(doc)
    return doc
  },
}

function openFallback(): Promise<DocumentFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.mmd,.markdown,text/markdown'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('No file selected'))
        return
      }
      resolve({ markdown: await file.text(), name: file.name })
    }
    input.click()
  })
}

function downloadFallback(doc: DocumentFile): void {
  const blob = new Blob([doc.markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.name || 'architecture.md'
  a.click()
  URL.revokeObjectURL(url)
}
