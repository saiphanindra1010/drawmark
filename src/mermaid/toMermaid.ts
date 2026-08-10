import type { SceneGraph } from '../scene/types.ts'
import { fromActivity, toActivity } from './activity.ts'
import { fromArchitecture, toArchitecture } from './architecture.ts'
import { fromClass, toClass } from './class.ts'
import { fromEr, toEr } from './er.ts'
import { extractMeta, stripFence } from './shared.ts'
import { fromSequence, toSequence } from './sequence.ts'
import { fromState, toState } from './state.ts'

export { uniqueId } from './shared.ts'
export type { MermadeMeta } from './shared.ts'

export function toMermaid(graph: SceneGraph, opts?: { clean?: boolean }): string {
  const clean = opts?.clean
  switch (graph.diagramType) {
    case 'class':
      return toClass(graph, clean)
    case 'sequence':
      return toSequence(graph, clean)
    case 'er':
      return toEr(graph, clean)
    case 'state':
      return toState(graph, clean)
    case 'activity':
      return toActivity(graph, clean)
    case 'architecture':
      return toArchitecture(graph, clean)
    default: {
      const _never: never = graph.diagramType
      return _never
    }
  }
}

export function toMarkdown(graph: SceneGraph, title = 'Design', opts?: { clean?: boolean }): string {
  const mermaid = toMermaid(graph, opts).trimEnd()
  return `# ${title}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`
}

export type ParseResult =
  | { ok: true; graph: SceneGraph }
  | { ok: false; error: string }

export function fromMermaid(source: string): ParseResult {
  const text = stripFence(source).trim()
  if (!text) return { ok: true, graph: { diagramType: 'class', nodes: [], edges: [], groups: [] } }
  const meta = extractMeta(text)
  const header = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  try {
    if (/^classDiagram/i.test(header) || meta?.diagramType === 'class') {
      return { ok: true, graph: fromClass(text) }
    }
    if (/^sequenceDiagram/i.test(header) || meta?.diagramType === 'sequence') {
      return { ok: true, graph: fromSequence(text) }
    }
    if (/^erDiagram/i.test(header) || meta?.diagramType === 'er') {
      return { ok: true, graph: fromEr(text) }
    }
    if (/^stateDiagram/i.test(header) || meta?.diagramType === 'state') {
      return { ok: true, graph: fromState(text) }
    }
    if (/^flowchart\b|^graph\b/i.test(header)) {
      const dir = /(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i.exec(header)?.[1]?.toUpperCase()
      if (meta?.diagramType === 'activity' || ((dir === 'TD' || dir === 'TB') && meta?.diagramType !== 'architecture')) {
        return { ok: true, graph: fromActivity(text) }
      }
      return { ok: true, graph: fromArchitecture(text) }
    }
    return { ok: false, error: 'Unsupported Mermaid header for the canvas.' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Parse failed' }
  }
}
