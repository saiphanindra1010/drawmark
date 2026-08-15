export {}

declare global {
  interface FilePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }

  interface FilePickerOptions {
    multiple?: boolean
    types?: FilePickerAcceptType[]
    suggestedName?: string
  }

  interface FileSystemWritableFileStream {
    write(data: string): Promise<void>
    close(): Promise<void>
  }

  interface FileSystemFileHandle {
    name: string
    getFile(): Promise<File>
    createWritable(): Promise<FileSystemWritableFileStream>
  }

  interface Window {
    showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>
  }
}
