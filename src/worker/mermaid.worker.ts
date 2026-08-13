import { fromMermaid } from '../mermaid/fromMermaid.ts'
import { toMarkdown, toMermaid } from '../mermaid/toMermaid.ts'
import type { SceneGraph } from '../scene/types.ts'

type Request =
  | { id: number; type: 'toMermaid'; graph: SceneGraph; clean?: boolean; markdown?: boolean; title?: string }
  | { id: number; type: 'fromMermaid'; text: string }

type Response =
  | { id: number; type: 'text'; text: string }
  | { id: number; type: 'graph'; graph: SceneGraph }
  | { id: number; type: 'error'; error: string }

self.onmessage = (event: MessageEvent<Request>) => {
  const msg = event.data
  try {
    if (msg.type === 'toMermaid') {
      const text = msg.markdown
        ? toMarkdown(msg.graph, msg.title, { clean: msg.clean })
        : toMermaid(msg.graph, { clean: msg.clean })
      const res: Response = { id: msg.id, type: 'text', text }
      self.postMessage(res)
      return
    }
    const parsed = fromMermaid(msg.text)
    const res: Response = parsed.ok
      ? { id: msg.id, type: 'graph', graph: parsed.graph }
      : { id: msg.id, type: 'error', error: parsed.error }
    self.postMessage(res)
  } catch (err) {
    const res: Response = { id: msg.id, type: 'error', error: err instanceof Error ? err.message : 'Convert failed' }
    self.postMessage(res)
  }
}
