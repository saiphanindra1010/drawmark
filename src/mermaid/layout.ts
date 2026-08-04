import type { SceneGraph } from '../scene/types.ts'

export function layoutGraph(
  graph: SceneGraph,
  direction: 'LR' | 'TD',
  membership = new Map<string, string>(),
): void {
  const incoming = new Map<string, number>()
  for (const n of graph.nodes) incoming.set(n.id, 0)
  for (const e of graph.edges) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1)
  const layers = new Map<string, number>()
  const queue = graph.nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id)
  for (const id of queue) layers.set(id, 0)
  const outs = new Map<string, string[]>()
  for (const e of graph.edges) {
    const list = outs.get(e.from) ?? []
    list.push(e.to)
    outs.set(e.from, list)
  }
  const visiting = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (visiting.has(id)) continue
    visiting.add(id)
    const layer = layers.get(id) ?? 0
    for (const next of outs.get(id) ?? []) {
      layers.set(next, Math.max(layers.get(next) ?? 0, layer + 1))
      const left = (incoming.get(next) ?? 1) - 1
      incoming.set(next, left)
      if (left <= 0) queue.push(next)
    }
  }
  const buckets = new Map<number, typeof graph.nodes>()
  for (const n of graph.nodes) {
    const layer = layers.get(n.id) ?? 0
    const bucket = buckets.get(layer) ?? []
    bucket.push(n)
    buckets.set(layer, bucket)
  }
  const gapX = 260
  const gapY = 110
  for (const [layer, bucket] of buckets) {
    bucket.forEach((n, i) => {
      if (direction === 'LR') {
        n.x = 80 + layer * gapX
        n.y = 80 + i * gapY
      } else {
        n.x = 80 + i * gapX
        n.y = 80 + layer * gapY
      }
    })
  }
  for (const g of graph.groups) {
    const members = graph.nodes.filter((n) => membership.get(n.id) === g.id)
    const set = members.length ? members : graph.nodes
    if (!set.length) continue
    const minX = Math.min(...set.map((n) => n.x)) - 36
    const minY = Math.min(...set.map((n) => n.y)) - 40
    const maxX = Math.max(...set.map((n) => n.x + n.w)) + 36
    const maxY = Math.max(...set.map((n) => n.y + n.h)) + 36
    g.x = minX
    g.y = minY
    g.w = maxX - minX
    g.h = maxY - minY
  }
}
