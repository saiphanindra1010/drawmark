import { colors } from './draw.ts'
import type { DiagramGroup, DiagramNode } from '../scene/types.ts'

export type Bounds = { x: number; y: number; w: number; h: number }

export function selectionBoxes(
  ids: Iterable<string>,
  nodes: DiagramNode[],
  groups: DiagramGroup[],
): Bounds[] {
  const set = new Set(ids)
  const boxes: Bounds[] = []
  for (const n of nodes) {
    if (set.has(n.id)) boxes.push({ x: n.x, y: n.y, w: n.w, h: n.h })
  }
  for (const g of groups) {
    if (set.has(g.id)) boxes.push({ x: g.x, y: g.y, w: g.w, h: g.h })
  }
  return boxes
}

export function unionBounds(boxes: Bounds[]): Bounds | null {
  if (!boxes.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function drawHoverFrame(ctx: CanvasRenderingContext2D, box: Bounds, zoom: number): void {
  strokeRoundFrame(ctx, box, zoom, colors.selectRing, 6)
}

export function drawSelectionFrame(ctx: CanvasRenderingContext2D, box: Bounds, zoom: number): void {
  strokeRoundFrame(ctx, box, zoom, colors.select, 6)
}

export function drawEdgeEndpoints(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: number,
): void {
  const r = 3.5 / zoom
  ctx.save()
  ctx.fillStyle = colors.handle
  ctx.strokeStyle = colors.select
  ctx.lineWidth = 1.5 / zoom
  for (const p of [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ]) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

function strokeRoundFrame(
  ctx: CanvasRenderingContext2D,
  box: Bounds,
  zoom: number,
  stroke: string,
  padPx: number,
): void {
  const pad = padPx / zoom
  const r = 8 / zoom
  ctx.save()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2 / zoom
  roundRectPath(ctx, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, r)
  ctx.stroke()
  ctx.restore()
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const rr = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
