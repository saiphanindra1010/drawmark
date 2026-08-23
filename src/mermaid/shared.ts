import type { DiagramGroup, DiagramNode, DiagramType, NodeKind, SceneGraph } from '../scene/types.ts'

export type DrawmarkMeta = {
  v: 1
  diagramType: DiagramType
  nodes: Record<
    string,
    { x: number; y: number; w: number; h: number; kind: NodeKind; members?: string[]; stereotype?: string }
  >
  groups: Record<string, { x: number; y: number; w: number; h: number; kind?: string }>
  edges?: Record<string, { y?: number; relation?: string; label?: string; fromCard?: string; toCard?: string }>
}

export function uniqueId(raw: string, used: Set<string>): string {
  let base = raw.replace(/[^A-Za-z0-9_]/g, '_')
  if (!/^[A-Za-z]/.test(base)) base = `n${base}`
  if (!base) base = 'n'
  let id = base
  let i = 2
  while (used.has(id)) {
    id = `${base}_${i}`
    i += 1
  }
  return id
}

export function esc(text: string): string {
  return text.replace(/]/g, '／').replace(/\[/g, '／').replace(/\n/g, ' ')
}

export function mermaidSafe(label: string, used: Set<string>): string {
  return uniqueId(label.replace(/\s+/g, '_'), used)
}

export function nodeGroups(graph: SceneGraph): Map<string, string> {
  const map = new Map<string, string>()
  const sorted = [...graph.groups].sort((a, b) => a.w * a.h - b.w * b.h)
  for (const node of graph.nodes) {
    const cx = node.x + node.w / 2
    const cy = node.y + node.h / 2
    for (const g of sorted) {
      if (cx >= g.x && cy >= g.y && cx <= g.x + g.w && cy <= g.y + g.h) {
        map.set(node.id, g.id)
        break
      }
    }
  }
  return map
}

export function appendMeta(lines: string[], graph: SceneGraph, assigned: Map<string, string>, groupIds: Map<string, string>, clean?: boolean): void {
  if (clean) return
  const meta: DrawmarkMeta = { v: 1, diagramType: graph.diagramType, nodes: {}, groups: {}, edges: {} }
  for (const n of graph.nodes) {
    const id = assigned.get(n.id)
    if (!id) continue
    meta.nodes[id] = {
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      kind: n.kind,
      members: n.members,
      stereotype: n.stereotype,
    }
  }
  for (const g of graph.groups) {
    const key = groupIds.get(g.id)
    if (!key) continue
    meta.groups[key] = { x: g.x, y: g.y, w: g.w, h: g.h, kind: g.kind }
  }
  graph.edges.forEach((e, i) => {
    meta.edges![`e${i + 1}`] = { y: e.y, relation: e.relation, label: e.label, fromCard: e.fromCard, toCard: e.toCard }
  })
  lines.push(`%% drawmark:${JSON.stringify(meta)}`)
}

export function extractMeta(text: string): DrawmarkMeta | null {
  const m = /%% drawmark:(\{.*\})\s*$/m.exec(text)
  if (!m?.[1]) return null
  try {
    const parsed = JSON.parse(m[1]) as DrawmarkMeta
    if (parsed.v !== 1 || !parsed.nodes) return null
    return parsed
  } catch {
    return null
  }
}

export function applyMeta(nodes: DiagramNode[], groups: DiagramGroup[], meta: DrawmarkMeta): void {
  for (const n of nodes) {
    const pos = meta.nodes[n.id]
    if (!pos) continue
    n.x = pos.x
    n.y = pos.y
    n.w = pos.w
    n.h = pos.h
    n.kind = pos.kind
    if (pos.members) n.members = pos.members
    if (pos.stereotype) n.stereotype = pos.stereotype
  }
  for (const g of groups) {
    const pos = meta.groups[g.id]
    if (!pos) continue
    g.x = pos.x
    g.y = pos.y
    g.w = pos.w
    g.h = pos.h
    if (pos.kind === 'alt' || pos.kind === 'loop' || pos.kind === 'opt' || pos.kind === 'group') {
      g.kind = pos.kind
    }
  }
}

export function applyEdgeMeta(edges: { id: string; y?: number; relation?: string; label: string; fromCard?: string; toCard?: string }[], meta: DrawmarkMeta): void {
  if (!meta.edges) return
  edges.forEach((edge, i) => {
    const pos = meta.edges![edge.id] ?? meta.edges![`e${i + 1}`]
    if (!pos) return
    if (pos.y !== undefined) edge.y = pos.y
    if (pos.fromCard) edge.fromCard = pos.fromCard
    if (pos.toCard) edge.toCard = pos.toCard
  })
}

export function stripFence(source: string): string {
  const fence = /```(?:mermaid)?\s*([\s\S]*?)```/i.exec(source)
  if (fence?.[1]) return fence[1]
  return source
}

export function bodyLines(source: string): string[] {
  return source
    .replace(/%% drawmark:.*$/m, '')
    .replace(/%%.*$/gm, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export function idMap(graph: SceneGraph): { assigned: Map<string, string>; used: Set<string> } {
  const assigned = new Map<string, string>()
  const used = new Set<string>()
  for (const n of graph.nodes) {
    const id = uniqueId(n.label || n.id, used)
    assigned.set(n.id, id)
    used.add(id)
  }
  return { assigned, used }
}
