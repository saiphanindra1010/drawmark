export type ConnectBox = { id: string; x: number; y: number; w: number; h: number }

export function connectSnapPad(zoom: number): number {
  return 20 / Math.max(0.15, zoom)
}

export function distanceToRect(x: number, y: number, box: ConnectBox): number {
  const dx = x < box.x ? box.x - x : x > box.x + box.w ? x - (box.x + box.w) : 0
  const dy = y < box.y ? box.y - y : y > box.y + box.h ? y - (box.y + box.h) : 0
  return Math.hypot(dx, dy)
}

export function nearestConnectTarget(
  x: number,
  y: number,
  nodes: ConnectBox[],
  pad: number,
  opts: { excludeId?: string; sequence?: boolean; sequenceBottom?: number } = {},
): string | null {
  let bestId: string | null = null
  let bestScore = Infinity
  const bottom = opts.sequenceBottom ?? 480
  for (const node of nodes) {
    if (node.id === opts.excludeId) continue
    const box = opts.sequence
      ? { ...node, h: Math.max(node.h, bottom - node.y) }
      : node
    const d = distanceToRect(x, y, box)
    if (d > pad) continue
    const cx = box.x + box.w / 2
    const cy = opts.sequence ? y : box.y + box.h / 2
    const score = d * 1000 + Math.hypot(x - cx, y - cy)
    if (score < bestScore) {
      bestScore = score
      bestId = node.id
    }
  }
  return bestId
}
