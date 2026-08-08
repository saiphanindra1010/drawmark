import type { DiagramEdge, DiagramNode, NodeKind, SceneGraph } from '../scene/types.ts'
import { NODE_SIZES } from '../scene/types.ts'
import { appendMeta, applyMeta, bodyLines, extractMeta, uniqueId } from './shared.ts'
import { layoutGraph } from './layout.ts'

export function toActivity(graph: SceneGraph, clean?: boolean): string {
  const lines = ['flowchart TD']
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  const idOf = (node: DiagramNode): string => {
    const hit = assigned.get(node.id)
    if (hit) return hit
    const id = uniqueId(node.id, used)
    assigned.set(node.id, id)
    used.add(id)
    return id
  }
  const wrap = (node: DiagramNode): string => {
    const id = idOf(node)
    const label = node.label || node.kind
    if (node.kind === 'activityStart') return `${id}([${label}])`
    if (node.kind === 'activityEnd') return `${id}([${label}])`
    if (node.kind === 'decision') return `${id}{${label}}`
    return `${id}[${label}]`
  }
  for (const node of graph.nodes) lines.push(`  ${wrap(node)}`)
  for (const edge of graph.edges) {
    const a = graph.nodes.find((n) => n.id === edge.from)
    const b = graph.nodes.find((n) => n.id === edge.to)
    if (!a || !b) continue
    if (edge.label.trim()) lines.push(`  ${idOf(a)} -->|${edge.label}| ${idOf(b)}`)
    else lines.push(`  ${idOf(a)} --> ${idOf(b)}`)
  }
  appendMeta(lines, graph, assigned, new Map(), clean)
  return `${lines.join('\n')}\n`
}

export function fromActivity(text: string): SceneGraph {
  const meta = extractMeta(text)
  const lines = bodyLines(text).slice(1)
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const byId = new Map<string, DiagramNode>()
  let edgeSeq = 1

  const ensure = (id: string, kind: NodeKind, label: string): DiagramNode => {
    const existing = byId.get(id)
    if (existing) {
      if (label && existing.label === id) existing.label = label
      if (kind !== 'action') existing.kind = kind
      return existing
    }
    const size = NODE_SIZES[kind]
    const node: DiagramNode = { id, kind, label: label || id, x: 0, y: 0, w: size.w, h: size.h }
    byId.set(id, node)
    nodes.push(node)
    return node
  }

  for (const line of lines) {
    const labeled = /^(.+?)\s*-->\|([^|]*)\|\s*(.+)$/.exec(line)
    const plain = labeled ?? /^(.+?)\s*-->\s*(.+)$/.exec(line)
    if (plain) {
      const fromTok = labeled ? labeled[1]! : plain[1]!
      const toTok = labeled ? labeled[3]! : plain[2]!
      const a = parseToken(fromTok)
      const b = parseToken(toTok)
      if (a) ensure(a.id, a.kind, a.label)
      if (b) ensure(b.id, b.kind, b.label)
      if (a && b) {
        edges.push({
          id: `e${edgeSeq}`,
          from: a.id,
          to: b.id,
          label: labeled ? labeled[2]!.trim() : '',
          relation: 'assoc',
        })
        edgeSeq += 1
      }
      continue
    }
    const tok = parseToken(line)
    if (tok) ensure(tok.id, tok.kind, tok.label)
  }
  const graph: SceneGraph = { diagramType: 'activity', nodes, edges, groups: [] }
  if (meta) applyMeta(nodes, [], meta)
  else layoutGraph(graph, 'TD')
  return graph
}

function parseToken(token: string): { id: string; kind: NodeKind; label: string } | null {
  const t = token.trim()
  const m = /^([A-Za-z][A-Za-z0-9_]*)(.*)$/.exec(t)
  if (!m) return null
  const id = m[1]!
  const rest = m[2] ?? ''
  if (rest.startsWith('([') && rest.endsWith('])')) {
    const label = rest.slice(2, -2)
    const kind: NodeKind = /end/i.test(label) ? 'activityEnd' : 'activityStart'
    return { id, kind, label }
  }
  if (rest.startsWith('{') && rest.endsWith('}')) return { id, kind: 'decision', label: rest.slice(1, -1) }
  if (rest.startsWith('[') && rest.endsWith(']')) return { id, kind: 'action', label: rest.slice(1, -1) }
  return { id, kind: 'action', label: id }
}
