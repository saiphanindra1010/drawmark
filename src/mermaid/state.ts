import type { DiagramEdge, DiagramNode, SceneGraph } from '../scene/types.ts'
import { NODE_SIZES } from '../scene/types.ts'
import { appendMeta, applyMeta, bodyLines, extractMeta, mermaidSafe } from './shared.ts'
import { layoutGraph } from './layout.ts'

export function toState(graph: SceneGraph, clean?: boolean): string {
  const lines = ['stateDiagram-v2']
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  const idOf = (node: DiagramNode): string => {
    if (node.kind === 'stateStart') return '[*]'
    if (node.kind === 'stateEnd') return '[*]'
    const hit = assigned.get(node.id)
    if (hit) return hit
    const id = mermaidSafe(node.label || node.id, used)
    assigned.set(node.id, id)
    used.add(id)
    return id
  }
  for (const node of graph.nodes) {
    if (node.kind === 'stateStart' || node.kind === 'stateEnd') continue
    if (node.kind === 'stateChoice') {
      const id = idOf(node)
      lines.push(`  state ${id} <<choice>>`)
      continue
    }
    idOf(node)
  }
  for (const edge of graph.edges) {
    const a = graph.nodes.find((n) => n.id === edge.from)
    const b = graph.nodes.find((n) => n.id === edge.to)
    if (!a || !b) continue
    const label = edge.label.trim() ? ` : ${edge.label}` : ''
    lines.push(`  ${idOf(a)} --> ${idOf(b)}${label}`)
  }
  appendMeta(lines, graph, assigned, new Map(), clean)
  return `${lines.join('\n')}\n`
}

export function fromState(text: string): SceneGraph {
  const meta = extractMeta(text)
  const lines = bodyLines(text).slice(1)
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const byId = new Map<string, DiagramNode>()
  let x = 80
  let edgeSeq = 1
  let start: DiagramNode | null = null
  let end: DiagramNode | null = null

  const ensure = (id: string, kind: DiagramNode['kind'] = 'state'): DiagramNode => {
    if (id === '[*]') {
      if (!start) {
        start = { id: 'start', kind: 'stateStart', label: '', x: 40, y: 120, w: 28, h: 28 }
        nodes.push(start)
        byId.set('start', start)
      }
      if (!end) {
        end = { id: 'end', kind: 'stateEnd', label: '', x: 640, y: 120, w: 32, h: 32 }
        nodes.push(end)
        byId.set('end', end)
      }
      return kind === 'stateEnd' ? end : start
    }
    const existing = byId.get(id)
    if (existing) return existing
    const size = NODE_SIZES[kind]
    const node: DiagramNode = { id, kind, label: id, x, y: 104, w: size.w, h: size.h }
    x += 240
    byId.set(id, node)
    nodes.push(node)
    return node
  }

  for (const line of lines) {
    const choice = /^state\s+([A-Za-z][A-Za-z0-9_]*)\s+<<choice>>/.exec(line)
    if (choice) {
      ensure(choice[1]!, 'stateChoice')
      continue
    }
    const trans = /^(\[\*\]|[A-Za-z][A-Za-z0-9_]*)\s+-->\s+(\[\*\]|[A-Za-z][A-Za-z0-9_]*)(?:\s*:\s*(.*))?$/.exec(line)
    if (trans) {
      const fromTok = trans[1]!
      const toTok = trans[2]!
      const a = ensure(fromTok, fromTok === '[*]' ? 'stateStart' : 'state')
      const b = ensure(toTok, toTok === '[*]' ? 'stateEnd' : 'state')
      // First [*] is start; if from is named and to is [*], use end
      const fromNode = fromTok === '[*]' ? start! : a
      const toNode = toTok === '[*]' ? end! : b
      edges.push({
        id: `e${edgeSeq}`,
        from: fromNode.id,
        to: toNode.id,
        label: trans[3] ?? '',
        relation: 'transition',
      })
      edgeSeq += 1
    }
  }
  const graph: SceneGraph = { diagramType: 'state', nodes, edges, groups: [] }
  if (meta) applyMeta(nodes, [], meta)
  else layoutGraph(graph, 'LR')
  return graph
}
