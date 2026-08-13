import type { SceneGraph } from '../scene/types.ts'
import { fromMermaid } from '../mermaid/fromMermaid.ts'
import { toMarkdown, toMermaid } from '../mermaid/toMermaid.ts'

type WorkerResponse =
  | { id: number; type: 'text'; text: string }
  | { id: number; type: 'graph'; graph: SceneGraph }
  | { id: number; type: 'error'; error: string }

let worker: Worker | null = null
let seq = 1
const pending = new Map<number, { resolve: (v: WorkerResponse) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker/mermaid.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const wait = pending.get(event.data.id)
      if (!wait) return
      pending.delete(event.data.id)
      wait.resolve(event.data)
    }
    worker.onerror = () => {
      worker = null
      for (const wait of pending.values()) wait.resolve({ id: 0, type: 'error', error: 'worker failed' })
      pending.clear()
    }
  }
  return worker
}

const WORKER_TIMEOUT_MS = 3000

function call(payload: Record<string, unknown>): Promise<WorkerResponse> {
  const id = seq++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.delete(id)) return
      reject(new Error('timeout'))
    }, WORKER_TIMEOUT_MS)
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer)
        resolve(value)
      },
    })
    getWorker().postMessage({ id, ...payload })
  })
}

export async function serializeScene(graph: SceneGraph, opts?: { clean?: boolean; markdown?: boolean; title?: string }): Promise<string> {
  try {
    const res = await call({ type: 'toMermaid', graph, clean: opts?.clean, markdown: opts?.markdown, title: opts?.title })
    if (res.type === 'text') return res.text
    if (res.type === 'error') throw new Error(res.error)
  } catch {
    return opts?.markdown ? toMarkdown(graph, opts.title, { clean: opts.clean }) : toMermaid(graph, { clean: opts?.clean })
  }
  return toMermaid(graph, { clean: opts?.clean })
}

export async function parseScene(text: string): Promise<{ graph: SceneGraph } | { error: string }> {
  try {
    const res = await call({ type: 'fromMermaid', text })
    if (res.type === 'graph') return { graph: res.graph }
    if (res.type === 'error') return { error: res.error }
  } catch {
    const parsed = fromMermaid(text)
    return parsed.ok ? { graph: parsed.graph } : { error: parsed.error }
  }
  const parsed = fromMermaid(text)
  return parsed.ok ? { graph: parsed.graph } : { error: parsed.error }
}
