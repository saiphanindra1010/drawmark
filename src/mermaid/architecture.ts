import type { DiagramEdge, DiagramGroup, DiagramNode, NodeKind, SceneGraph } from '../scene/types.ts'
import { NODE_SIZES } from '../scene/types.ts'
import { appendMeta, applyMeta, bodyLines, extractMeta, esc, nodeGroups, uniqueId } from './shared.ts'
import { layoutGraph } from './layout.ts'

const KIND_WRAP: Partial<Record<NodeKind, (id: string, label: string) => string>> = {
  service: (id, label) => `${id}[${esc(label)}]`,
  api: (id, label) => `${id}[${esc(label)}]`,
  database: (id, label) => `${id}[(${esc(label)})]`,
  cache: (id, label) => `${id}{{${esc(label)}}}`,
  queue: (id, label) => `${id}([${esc(label)}])`,
  client: (id, label) => `${id}([${esc(label)}])`,
  loadBalancer: (id, label) => `${id}{${esc(label)}}`,
  store: (id, label) => `${id}[${esc(label)}]`,
}

export function toArchitecture(graph: SceneGraph, clean?: boolean): string {
  const lines: string[] = ['flowchart LR']
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  const groupIds = new Map<string, string>()
  const idOf = (node: DiagramNode): string => {
    const existing = assigned.get(node.id)
    if (existing) return existing
    const id = uniqueId(node.id, used)
    assigned.set(node.id, id)
    used.add(id)
    return id
  }
  const wrap = (node: DiagramNode): string => {
    const fn = KIND_WRAP[node.kind] ?? KIND_WRAP.service!
    return fn(idOf(node), node.label)
  }
  const membership = nodeGroups(graph)
  const grouped = new Set<string>()
  for (const group of graph.groups) {
    const gid = uniqueId(group.id, used)
    groupIds.set(group.id, gid)
    used.add(gid)
    lines.push(`  subgraph ${gid} [${esc(group.label)}]`)
    for (const node of graph.nodes) {
      if (membership.get(node.id) !== group.id) continue
      grouped.add(node.id)
      lines.push(`    ${wrap(node)}`)
    }
    lines.push('  end')
  }
  for (const node of graph.nodes) {
    if (grouped.has(node.id)) continue
    lines.push(`  ${wrap(node)}`)
  }
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from)
    const to = graph.nodes.find((n) => n.id === edge.to)
    if (!from || !to) continue
    const a = idOf(from)
    const b = idOf(to)
    if (edge.label.trim()) lines.push(`  ${a} -->|${esc(edge.label)}| ${b}`)
    else lines.push(`  ${a} --> ${b}`)
  }
  appendMeta(lines, graph, assigned, groupIds, clean)
  return `${lines.join('\n')}\n`
}

export function fromArchitecture(text: string): SceneGraph {
  const meta = extractMeta(text)
  const lines = bodyLines(text)
  const header = lines[0] ?? ''
  const direction = /(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)/i.exec(header)?.[1]?.toUpperCase() ?? 'LR'
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const groups: DiagramGroup[] = []
  const byId = new Map<string, DiagramNode>()
  const membership = new Map<string, string>()
  const stack: DiagramGroup[] = []
  let edgeSeq = 1

  const ensure = (id: string, kind: NodeKind, label: string): DiagramNode => {
    const existing = byId.get(id)
    if (existing) {
      if (label && existing.label === id) existing.label = label
      if (kind !== 'service') existing.kind = kind
      return existing
    }
    const size = NODE_SIZES[kind] ?? NODE_SIZES.service
    const node: DiagramNode = { id, kind, label: label || id, x: 0, y: 0, w: size.w, h: size.h }
    byId.set(id, node)
    nodes.push(node)
    const current = stack[stack.length - 1]
    if (current) membership.set(id, current.id)
    return node
  }

  for (const line of lines.slice(1)) {
    const sub = /^subgraph\s+([A-Za-z][A-Za-z0-9_]*)(?:\s*\[(.*)\])?$/.exec(line)
    if (sub) {
      const group: DiagramGroup = {
        id: sub[1]!,
        label: sub[2] ?? sub[1]!,
        x: 40,
        y: 40,
        w: 400,
        h: 240,
        kind: 'group',
      }
      groups.push(group)
      stack.push(group)
      continue
    }
    if (line === 'end') {
      stack.pop()
      continue
    }
    const labeled = /^(.+?)\s*-->\|([^|]*)\|\s*(.+)$/.exec(line)
    const plain = labeled ?? /^(.+?)\s*-->\s*(.+)$/.exec(line)
    if (plain) {
      const fromTok = labeled ? labeled[1]! : plain[1]!
      const toTok = labeled ? labeled[3]! : plain[2]!
      const a = parseArchToken(fromTok)
      const b = parseArchToken(toTok)
      if (a) ensure(a.id, a.kind, a.label)
      if (b) ensure(b.id, b.kind, b.label)
      if (a && b) {
        edges.push({ id: `e${edgeSeq}`, from: a.id, to: b.id, label: labeled ? labeled[2]!.trim() : '' })
        edgeSeq += 1
      }
      continue
    }
    const tok = parseArchToken(line)
    if (tok) ensure(tok.id, tok.kind, tok.label)
  }

  const graph: SceneGraph = { diagramType: 'architecture', nodes, edges, groups }
  if (meta) applyMeta(nodes, groups, meta)
  else layoutGraph(graph, direction === 'TD' || direction === 'TB' ? 'TD' : 'LR', membership)
  return graph
}

function parseArchToken(token: string): { id: string; kind: NodeKind; label: string } | null {
  const t = token.trim()
  const m = /^([A-Za-z][A-Za-z0-9_]*)(.*)$/.exec(t)
  if (!m) return null
  const id = m[1]!
  const rest = m[2] ?? ''
  if (!rest) return { id, kind: 'service', label: id }
  const specs: { start: string; end: string; kind: NodeKind }[] = [
    { start: '[(', end: ')]', kind: 'database' },
    { start: '([', end: '])', kind: 'queue' },
    { start: '{{', end: '}}', kind: 'cache' },
    { start: '{', end: '}', kind: 'loadBalancer' },
    { start: '[', end: ']', kind: 'service' },
    { start: '(', end: ')', kind: 'api' },
  ]
  for (const spec of specs) {
    if (rest.startsWith(spec.start) && rest.endsWith(spec.end)) {
      const label = rest.slice(spec.start.length, rest.length - spec.end.length).trim()
      return { id, kind: spec.kind, label: label || id }
    }
  }
  return { id, kind: 'service', label: id }
}
