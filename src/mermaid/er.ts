import type { DiagramEdge, DiagramNode, EdgeRelation, SceneGraph } from '../scene/types.ts'
import { NODE_SIZES, nodeHeight } from '../scene/types.ts'
import { appendMeta, applyMeta, bodyLines, extractMeta, mermaidSafe } from './shared.ts'
import { layoutGraph } from './layout.ts'

const CARD: Record<string, EdgeRelation> = {
  '||--||': 'oneToOne',
  '||--|{': 'oneToMany',
  '||--o{': 'zeroToMany',
  '}|--|{': 'manyToMany',
}

const CARD_OUT: Record<string, string> = {
  oneToOne: '||--||',
  oneToMany: '||--|{',
  zeroToMany: '||--o{',
  manyToMany: '}|--|{',
}

export function toEr(graph: SceneGraph, clean?: boolean): string {
  const lines = ['erDiagram']
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  const idOf = (node: DiagramNode): string => {
    const hit = assigned.get(node.id)
    if (hit) return hit
    const id = mermaidSafe(node.label || node.id, used).toUpperCase()
    assigned.set(node.id, id)
    used.add(id)
    return id
  }
  for (const node of graph.nodes) {
    const id = idOf(node)
    lines.push(`  ${id} {`)
    for (const m of node.members ?? ['id']) {
      const parts = m.split(/\s+/)
      const name = parts[0] ?? 'id'
      const rest = parts.slice(1).join(' ')
      lines.push(`    string ${name}${rest ? ` ${rest}` : ''}`)
    }
    lines.push('  }')
  }
  for (const edge of graph.edges) {
    const a = graph.nodes.find((n) => n.id === edge.from)
    const b = graph.nodes.find((n) => n.id === edge.to)
    if (!a || !b) continue
    const card = CARD_OUT[edge.relation ?? 'oneToMany'] ?? '||--o{'
    const label = edge.label.trim() || 'rel'
    lines.push(`  ${idOf(a)} ${card} ${idOf(b)} : ${label}`)
  }
  appendMeta(lines, graph, assigned, new Map(), clean)
  return `${lines.join('\n')}\n`
}

export function fromEr(text: string): SceneGraph {
  const meta = extractMeta(text)
  const lines = bodyLines(text).slice(1)
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const byId = new Map<string, DiagramNode>()
  let current: DiagramNode | null = null
  let edgeSeq = 1
  let x = 80

  const ensure = (id: string): DiagramNode => {
    const existing = byId.get(id)
    if (existing) return existing
    const size = NODE_SIZES.entity
    const node: DiagramNode = { id, kind: 'entity', label: id, x, y: 80, w: size.w, h: size.h, members: [] }
    x += 280
    byId.set(id, node)
    nodes.push(node)
    return node
  }

  for (const line of lines) {
    const start = /^([A-Za-z][A-Za-z0-9_]*)\s*\{/.exec(line)
    if (start) {
      current = ensure(start[1]!)
      continue
    }
    if (line === '}') {
      if (current) current.h = nodeHeight(current)
      current = null
      continue
    }
    if (current) {
      const attr = line.replace(/^string\s+/i, '')
      current.members = [...(current.members ?? []), attr]
      continue
    }
    const rel = /^([A-Za-z][A-Za-z0-9_]*)\s+(\|\|--\|\||\|\|--\|\{|\|\|--o\{|\}\|--\|\{)\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)
    if (rel) {
      ensure(rel[1]!)
      ensure(rel[3]!)
      edges.push({
        id: `e${edgeSeq}`,
        from: rel[1]!,
        to: rel[3]!,
        label: rel[4] ?? '',
        relation: CARD[rel[2]!] ?? 'oneToMany',
      })
      edgeSeq += 1
    }
  }
  const graph: SceneGraph = { diagramType: 'er', nodes, edges, groups: [] }
  if (meta) applyMeta(nodes, [], meta)
  else layoutGraph(graph, 'LR')
  return graph
}
