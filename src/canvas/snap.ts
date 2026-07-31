import type { DiagramNode } from '../scene/types.ts'
import { colors } from './draw.ts'

export type Guide = { x1: number; y1: number; x2: number; y2: number }

const THRESH = 6

export function snapDrag(dx: number, dy: number, moving: DiagramNode[], others: DiagramNode[]): { dx: number; dy: number; guides: Guide[] } {
  const guides: Guide[] = []
  let ax = dx
  let ay = dy
  const mids = moving.map((n) => ({
    l: n.x + dx,
    r: n.x + n.w + dx,
    t: n.y + dy,
    b: n.y + n.h + dy,
    cx: n.x + n.w / 2 + dx,
    cy: n.y + n.h / 2 + dy,
  }))

  for (const o of others) {
    const ol = o.x
    const or_ = o.x + o.w
    const ot = o.y
    const ob = o.y + o.h
    const ocx = o.x + o.w / 2
    const ocy = o.y + o.h / 2
    for (const m of mids) {
      const pairsX: [number, number][] = [
        [m.l, ol],
        [m.r, or_],
        [m.cx, ocx],
        [m.l, or_],
        [m.r, ol],
      ]
      for (const [a, b] of pairsX) {
        if (Math.abs(a - b) < THRESH) {
          ax += b - a
          guides.push({ x1: b, y1: Math.min(m.t, ot) - 40, x2: b, y2: Math.max(m.b, ob) + 40 })
        }
      }
      const pairsY: [number, number][] = [
        [m.t, ot],
        [m.b, ob],
        [m.cy, ocy],
        [m.t, ob],
        [m.b, ot],
      ]
      for (const [a, b] of pairsY) {
        if (Math.abs(a - b) < THRESH) {
          ay += b - a
          guides.push({ x1: Math.min(m.l, ol) - 40, y1: b, x2: Math.max(m.r, or_) + 40, y2: b })
        }
      }
    }
  }
  return { dx: ax, dy: ay, guides }
}

export function drawGuides(ctx: CanvasRenderingContext2D, guides: Guide[]): void {
  ctx.save()
  ctx.strokeStyle = colors.snap
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const g of guides) {
    ctx.moveTo(g.x1, g.y1)
    ctx.lineTo(g.x2, g.y2)
  }
  ctx.stroke()
  ctx.restore()
}
