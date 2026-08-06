import type { DiagramEdge, DiagramGroup, DiagramNode, SceneGraph } from '../scene/types.ts'
import { NODE_SIZES } from '../scene/types.ts'
import { appendMeta, applyMeta, bodyLines, extractMeta, mermaidSafe } from './shared.ts'

export function toSequence(graph: SceneGraph, clean?: boolean): string {
  const lines = ['sequenceDiagram']
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  const groupIds = new Map<string, string>()
  const participants = [...graph.nodes].sort((a, b) => a.x - b.x)
  const idOf = (node: DiagramNode): string => {
    const hit = assigned.get(node.id)
    if (hit) return hit
    const id = mermaidSafe(node.label || node.id, used)
    assigned.set(node.id, id)
    used.add(id)
    return id
  }
  for (const p of participants) {
    const id = idOf(p)
    if (p.kind === 'actor') lines.push(`  actor ${id}`)
    else lines.push(`  participant ${id}`)
  }
  const messages = [...graph.edges].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
  const membership = boxMessages(graph)
  let open: string | null = null
  for (const edge of messages) {
    const boxId = membership.get(edge.id)
    if (boxId !== open) {
      if (open) lines.push('  end')
      if (boxId) {
        const g = graph.groups.find((x) => x.id === boxId)
        const kind = g?.kind === 'loop' ? 'loop' : g?.kind === 'opt' ? 'opt' : 'alt'
        lines.push(`  ${kind} ${g?.label ?? kind}`)
      }
      open = boxId ?? null
    }
    const a = graph.nodes.find((n) => n.id === edge.from)
    const b = graph.nodes.find((n) => n.id === edge.to)
    if (!a || !b) continue
    const arrow = edge.relation === 'reply' ? '-->>' : '->>'
    const label = edge.label.trim() || 'msg'
    lines.push(`  ${idOf(a)}${arrow}${idOf(b)}: ${label}`)
  }
  if (open) lines.push('  end')
  for (const g of graph.groups) groupIds.set(g.id, mermaidSafe(g.id, used))
  appendMeta(lines, graph, assigned, groupIds, clean)
  return `${lines.join('\n')}\n`
}

export function fromSequence(text: string): SceneGraph {
  const meta = extractMeta(text)
  const lines = bodyLines(text).slice(1)
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const groups: DiagramGroup[] = []
  const byId = new Map<string, DiagramNode>()
  let x = 80
  let y = 140
  let edgeSeq = 1
  const stack: DiagramGroup[] = []

  const ensure = (id: string, kind: DiagramNode['kind']): DiagramNode => {
    const existing = byId.get(id)
    if (existing) return existing
    const size = NODE_SIZES[kind]
    const node: DiagramNode = { id, kind, label: id, x, y: 40, w: size.w, h: size.h }
    x += 220
    byId.set(id, node)
    nodes.push(node)
    return node
  }

  for (const line of lines) {
    const actor = /^actor\s+([A-Za-z][A-Za-z0-9_]*)/.exec(line)
    if (actor) {
      ensure(actor[1]!, 'actor')
      continue
    }
    const part = /^participant\s+([A-Za-z][A-Za-z0-9_]*)/.exec(line)
    if (part) {
      ensure(part[1]!, 'participant')
      continue
    }
    const box = /^(alt|loop|opt)\s+(.*)$/.exec(line)
    if (box) {
      const g: DiagramGroup = {
        id: `g${groups.length + 1}`,
        label: box[2] || box[1]!,
        kind: box[1] as 'alt' | 'loop' | 'opt',
        x: 40,
        y,
        w: 640,
        h: 120,
      }
      groups.push(g)
      stack.push(g)
      continue
    }
    if (line === 'end') {
      const g = stack.pop()
      if (g) g.h = y - g.y + 40
      continue
    }
    const msg = /^([A-Za-z][A-Za-z0-9_]*)\s*(-->>|->>|->)\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)
    if (msg) {
      const a = ensure(msg[1]!, 'participant')
      const b = ensure(msg[3]!, 'participant')
      edges.push({
        id: `e${edgeSeq}`,
        from: a.id,
        to: b.id,
        label: msg[4] ?? '',
        relation: msg[2] === '-->>' ? 'reply' : 'sync',
        y,
      })
      edgeSeq += 1
      y += 60
    }
  }
  const graph: SceneGraph = { diagramType: 'sequence', nodes, edges, groups }
  if (meta) applyMeta(nodes, groups, meta)
  return graph
}

function boxMessages(graph: SceneGraph): Map<string, string> {
  const map = new Map<string, string>()
  for (const edge of graph.edges) {
    const y = edge.y ?? 0
    const a = graph.nodes.find((n) => n.id === edge.from)
    const b = graph.nodes.find((n) => n.id === edge.to)
    if (!a || !b) continue
    const cx = (a.x + b.x) / 2
    for (const g of graph.groups) {
      if (cx >= g.x && cx <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
        map.set(edge.id, g.id)
        break
      }
    }
  }
  return map
}
