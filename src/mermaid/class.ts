import type { DiagramEdge, DiagramGroup, DiagramNode, EdgeRelation, SceneGraph } from '../scene/types.ts'
import { NODE_SIZES, nodeHeight } from '../scene/types.ts'
import { appendMeta, applyEdgeMeta, applyMeta, bodyLines, extractMeta, mermaidSafe, nodeGroups } from './shared.ts'
import { layoutGraph } from './layout.ts'

const REL: Record<string, string> = {
  extends: '--|>',
  implements: '..|>',
  composes: '*--',
  aggregates: 'o--',
  assoc: '-->',
  depends: '..>',
}

export function toClass(graph: SceneGraph, clean?: boolean): string {
  const lines = ['classDiagram']
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  const groupIds = new Map<string, string>()
  const idOf = (node: DiagramNode): string => {
    const hit = assigned.get(node.id)
    if (hit) return hit
    const id = mermaidSafe(node.label || node.id, used)
    assigned.set(node.id, id)
    used.add(id)
    return id
  }
  const emitClass = (node: DiagramNode, indent: string): void => {
    const id = idOf(node)
    const members = node.members ?? []
    if (!node.stereotype && members.length === 0) {
      lines.push(`${indent}class ${id}`)
      return
    }
    lines.push(`${indent}class ${id} {`)
    if (node.stereotype) lines.push(`${indent}  <<${node.stereotype}>>`)
    for (const m of members) lines.push(`${indent}  ${m}`)
    lines.push(`${indent}}`)
  }
  const membership = nodeGroups(graph)
  const grouped = new Set<string>()
  for (const group of graph.groups) {
    const gid = mermaidSafe(group.label || group.id, used)
    groupIds.set(group.id, gid)
    used.add(gid)
    lines.push(`  namespace ${gid} {`)
    for (const node of graph.nodes) {
      if (membership.get(node.id) !== group.id) continue
      grouped.add(node.id)
      emitClass(node, '    ')
    }
    lines.push('  }')
  }
  for (const node of graph.nodes) {
    if (grouped.has(node.id)) continue
    emitClass(node, '  ')
  }
  for (const edge of graph.edges) {
    const a = graph.nodes.find((n) => n.id === edge.from)
    const b = graph.nodes.find((n) => n.id === edge.to)
    if (!a || !b) continue
    const op = REL[edge.relation ?? 'assoc'] ?? '-->'
    const fromCard = edge.fromCard ? ` "${edge.fromCard}"` : ''
    const toCard = edge.toCard ? `"${edge.toCard}" ` : ''
    const label = edge.label.trim() ? ` : ${edge.label}` : ''
    lines.push(`  ${idOf(a)}${fromCard} ${op} ${toCard}${idOf(b)}${label}`)
  }
  appendMeta(lines, graph, assigned, groupIds, clean)
  return `${lines.join('\n')}\n`
}

export function fromClass(text: string): SceneGraph {
  const meta = extractMeta(text)
  const lines = bodyLines(text).slice(1)
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const groups: DiagramGroup[] = []
  const byId = new Map<string, DiagramNode>()
  const membersOf = new Map<string, string[]>()
  let current: DiagramNode | null = null
  let namespace: DiagramGroup | null = null
  let edgeSeq = 1
  let x = 80

  const ensure = (id: string): DiagramNode => {
    const existing = byId.get(id)
    if (existing) return existing
    const size = NODE_SIZES.class
    const node: DiagramNode = { id, kind: 'class', label: id, x, y: 80, w: size.w, h: size.h, members: [] }
    x += 280
    byId.set(id, node)
    nodes.push(node)
    return node
  }

  for (const line of lines) {
    const ns = /^namespace\s+([A-Za-z][A-Za-z0-9_]*)\s*\{?$/.exec(line)
    if (ns) {
      namespace = {
        id: ns[1]!,
        label: ns[1]!,
        x: 40,
        y: 40,
        w: 360,
        h: 240,
        kind: 'group',
      }
      groups.push(namespace)
      continue
    }
    const start = /^class\s+([A-Za-z][A-Za-z0-9_]*)\s*(\{)?$/.exec(line)
    if (start) {
      current = ensure(start[1]!)
      if (namespace) {
        const list = membersOf.get(namespace.id) ?? []
        list.push(current.id)
        membersOf.set(namespace.id, list)
      }
      if (!start[2]) current = null
      continue
    }
    if (line === '}') {
      if (current) {
        current.h = nodeHeight(current)
        current = null
        continue
      }
      if (namespace) namespace = null
      continue
    }
    if (current) {
      const stereo = /^<<(.+)>>$/.exec(line)
      if (stereo) {
        current.stereotype = stereo[1]
        if (stereo[1] === 'interface') current.kind = 'interface'
        if (stereo[1] === 'abstract') current.kind = 'abstract'
        if (stereo[1] === 'enumeration') current.kind = 'enum'
        continue
      }
      current.members = [...(current.members ?? []), line]
      continue
    }
    const rel = parseClassRel(line)
    if (rel) {
      ensure(rel.from)
      ensure(rel.to)
      edges.push({
        id: `e${edgeSeq}`,
        from: rel.from,
        to: rel.to,
        label: rel.label,
        relation: rel.relation,
        fromCard: rel.fromCard,
        toCard: rel.toCard,
      })
      edgeSeq += 1
    }
  }
  const graph: SceneGraph = { diagramType: 'class', nodes, edges, groups }
  if (meta) {
    applyMeta(nodes, groups, meta)
    applyEdgeMeta(edges, meta)
  } else {
    layoutGraph(graph, 'LR')
    for (const g of groups) fitGroup(g, nodes, membersOf.get(g.id) ?? [])
  }
  return graph
}

function fitGroup(group: DiagramGroup, nodes: DiagramNode[], ids: string[]): void {
  const members = nodes.filter((n) => ids.includes(n.id))
  if (!members.length) return
  const minX = Math.min(...members.map((n) => n.x)) - 24
  const minY = Math.min(...members.map((n) => n.y)) - 36
  const maxX = Math.max(...members.map((n) => n.x + n.w)) + 24
  const maxY = Math.max(...members.map((n) => n.y + n.h)) + 24
  group.x = minX
  group.y = minY
  group.w = maxX - minX
  group.h = maxY - minY
}

type ParsedRel = {
  from: string
  to: string
  label: string
  relation: EdgeRelation
  fromCard?: string
  toCard?: string
}

function parseClassRel(line: string): ParsedRel | null {
  const specs: { op: string; relation: EdgeRelation; reverse?: boolean }[] = [
    { op: '<|--', relation: 'extends', reverse: true },
    { op: '--|>', relation: 'extends' },
    { op: '<|..', relation: 'implements', reverse: true },
    { op: '..|>', relation: 'implements' },
    { op: '*--', relation: 'composes' },
    { op: '--*', relation: 'composes', reverse: true },
    { op: 'o--', relation: 'aggregates' },
    { op: '--o', relation: 'aggregates', reverse: true },
    { op: '..>', relation: 'depends' },
    { op: '-->', relation: 'assoc' },
  ]
  for (const spec of specs) {
    const idx = line.indexOf(spec.op)
    if (idx < 0) continue
    const left = parseEnd(line.slice(0, idx).trim())
    const rest = line.slice(idx + spec.op.length).trim()
    const parts = rest.split(/\s+:\s+/)
    const right = parseEnd((parts[0] ?? '').trim())
    const label = (parts[1] ?? '').trim()
    if (!left.id || !right.id) return null
    if (spec.reverse) {
      return {
        from: right.id,
        to: left.id,
        label,
        relation: spec.relation,
        fromCard: right.card,
        toCard: left.card,
      }
    }
    return {
      from: left.id,
      to: right.id,
      label,
      relation: spec.relation,
      fromCard: left.card,
      toCard: right.card,
    }
  }
  return null
}

function parseEnd(text: string): { id: string; card?: string } {
  const quotedLeft = /^"([^"]+)"\s+([A-Za-z][A-Za-z0-9_]*)$/.exec(text)
  if (quotedLeft) return { id: quotedLeft[2]!, card: quotedLeft[1] }
  const quotedRight = /^([A-Za-z][A-Za-z0-9_]*)\s+"([^"]+)"$/.exec(text)
  if (quotedRight) return { id: quotedRight[1]!, card: quotedRight[2] }
  return { id: text }
}

export { parseClassRel }
