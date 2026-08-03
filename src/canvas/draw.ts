import { splitMembers } from '../scene/members.ts'
import {
  COMPARTMENT_KINDS,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type EdgeRelation,
  type NodeKind,
} from '../scene/types.ts'

export type CanvasColors = {
  bg: string
  grid: string
  gridRgb: string
  text: string
  muted: string
  edge: string
  select: string
  selectFill: string
  selectRing: string
  snap: string
  group: string
  groupStroke: string
  groupFill: string
  nodeFill: string
  nodeShadow: string
  insetLine: string
  handle: string
}

const DARK_COLORS: CanvasColors = {
  bg: '#0f0f0f',
  grid: '#2a2a2a',
  gridRgb: '255,255,255',
  text: '#ececec',
  muted: '#9a9a9a',
  edge: '#8a8a8a',
  select: '#7aa2f7',
  selectFill: 'rgba(122,162,247,0.12)',
  selectRing: 'rgba(122,162,247,0.4)',
  snap: '#e0af68',
  group: '#3a3a3a',
  groupStroke: '#5a5a5a',
  groupFill: 'rgba(58,58,58,0.18)',
  nodeFill: '#1e1e1e',
  nodeShadow: 'rgba(0,0,0,0.28)',
  insetLine: 'rgba(255,255,255,0.08)',
  handle: '#fff',
}

const LIGHT_COLORS: CanvasColors = {
  bg: '#f4f4f5',
  grid: '#d4d4d8',
  gridRgb: '24,24,27',
  text: '#18181b',
  muted: '#71717a',
  edge: '#71717a',
  select: '#3d6fd9',
  selectFill: 'rgba(61,111,217,0.12)',
  selectRing: 'rgba(61,111,217,0.4)',
  snap: '#b45309',
  group: '#e4e4e7',
  groupStroke: '#a1a1aa',
  groupFill: 'rgba(24,24,27,0.04)',
  nodeFill: '#ffffff',
  nodeShadow: 'rgba(24,24,27,0.08)',
  insetLine: 'rgba(24,24,27,0.08)',
  handle: '#fff',
}

const DARK_KINDS: Record<string, string> = {
  service: '#7aa2f7',
  api: '#89ddff',
  database: '#9ece6a',
  cache: '#e0af68',
  queue: '#bb9af7',
  client: '#c0caf5',
  loadBalancer: '#f7768e',
  store: '#73daca',
  class: '#7aa2f7',
  interface: '#89ddff',
  abstract: '#bb9af7',
  enum: '#e0af68',
  actor: '#c0caf5',
  participant: '#7aa2f7',
  entity: '#9ece6a',
  state: '#7aa2f7',
  stateStart: '#c0caf5',
  stateEnd: '#c0caf5',
  stateChoice: '#e0af68',
  activityStart: '#9ece6a',
  action: '#7aa2f7',
  decision: '#e0af68',
  activityEnd: '#f7768e',
}

const LIGHT_KINDS: Record<string, string> = {
  service: '#3d6fd9',
  api: '#0e7490',
  database: '#15803d',
  cache: '#b45309',
  queue: '#7c3aed',
  client: '#4338ca',
  loadBalancer: '#e11d48',
  store: '#0f766e',
  class: '#3d6fd9',
  interface: '#0e7490',
  abstract: '#7c3aed',
  enum: '#b45309',
  actor: '#4338ca',
  participant: '#3d6fd9',
  entity: '#15803d',
  state: '#3d6fd9',
  stateStart: '#4338ca',
  stateEnd: '#4338ca',
  stateChoice: '#b45309',
  activityStart: '#15803d',
  action: '#3d6fd9',
  decision: '#b45309',
  activityEnd: '#e11d48',
}

export const colors: CanvasColors = { ...DARK_COLORS }

let kindColor: Record<string, string> = { ...DARK_KINDS }

export function applyCanvasTheme(theme: 'light' | 'dark'): void {
  Object.assign(colors, theme === 'light' ? LIGHT_COLORS : DARK_COLORS)
  kindColor = theme === 'light' ? LIGHT_KINDS : DARK_KINDS
}

export function strokeFor(kind: NodeKind): string {
  return kindColor[kind] ?? colors.select
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number; zoom: number },
  w: number,
  h: number,
): void {
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, w, h)
  const step = 24 * camera.zoom
  if (step < 8) return
  const alpha = Math.min(0.14, 0.05 + (step - 8) / 180)
  ctx.fillStyle = `rgba(${colors.gridRgb},${alpha})`
  const ox = camera.x % step
  const oy = camera.y % step
  const size = camera.zoom < 0.7 ? 1 : 1.25
  for (let x = ox; x < w; x += step) {
    for (let y = oy; y < h; y += step) {
      ctx.fillRect(x, y, size, size)
    }
  }
}

export function drawGroup(
  ctx: CanvasRenderingContext2D,
  group: DiagramGroup,
  _selected: boolean,
  _hovered = false,
  hideLabel = false,
): void {
  ctx.save()
  ctx.strokeStyle = colors.groupStroke
  ctx.fillStyle = colors.groupFill
  ctx.setLineDash([8, 6])
  ctx.lineWidth = 1.25
  roundRect(ctx, group.x, group.y, group.w, group.h, 12)
  ctx.fill()
  ctx.stroke()
  ctx.setLineDash([])
  if (!hideLabel) {
    ctx.fillStyle = colors.muted
    ctx.font = '12px "SF Pro Text", "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'top'
    const tag = group.kind && group.kind !== 'group' ? `${group.kind}: ${group.label}` : group.label
    ctx.fillText(tag, group.x + 12, group.y + 10)
  }
  ctx.restore()
}

export function drawNode(
  ctx: CanvasRenderingContext2D,
  node: DiagramNode,
  _selected: boolean,
  _hovered = false,
  hideLabel = false,
): void {
  const stroke = strokeFor(node.kind)
  ctx.save()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = stroke
  ctx.fillStyle = colors.nodeFill
  ctx.shadowColor = colors.nodeShadow
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.font = '13px "SF Pro Text", "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (COMPARTMENT_KINDS.includes(node.kind)) {
    drawCompartment(ctx, node, stroke, hideLabel)
    ctx.restore()
    return
  }

  switch (node.kind) {
    case 'database':
      drawCylinder(ctx, node.x, node.y, node.w, node.h)
      break
    case 'cache':
      drawHexagon(ctx, node.x, node.y, node.w, node.h)
      break
    case 'loadBalancer':
    case 'decision':
    case 'stateChoice':
      drawDiamond(ctx, node.x, node.y, node.w, node.h)
      break
    case 'queue':
    case 'activityStart':
    case 'activityEnd':
    case 'state':
      stadium(ctx, node.x, node.y, node.w, node.h)
      ctx.fill()
      ctx.stroke()
      break
    case 'client':
    case 'actor':
      roundRect(ctx, node.x, node.y, node.w, node.h, 18)
      ctx.fill()
      ctx.stroke()
      break
    case 'stateStart':
      ctx.beginPath()
      ctx.arc(node.x + node.w / 2, node.y + node.h / 2, node.w / 2, 0, Math.PI * 2)
      ctx.fillStyle = stroke
      ctx.fill()
      ctx.restore()
      return
    case 'stateEnd':
      ctx.beginPath()
      ctx.arc(node.x + node.w / 2, node.y + node.h / 2, node.w / 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(node.x + node.w / 2, node.y + node.h / 2, node.w / 2 - 5, 0, Math.PI * 2)
      ctx.fillStyle = stroke
      ctx.fill()
      ctx.restore()
      return
    case 'participant':
      roundRect(ctx, node.x, node.y, node.w, node.h, 6)
      ctx.fill()
      ctx.stroke()
      break
    default:
      roundRect(ctx, node.x, node.y, node.w, node.h, 10)
      ctx.fill()
      ctx.stroke()
  }
  clearShadow(ctx)
  if (!hideLabel && node.label) {
    ctx.fillStyle = colors.text
    ctx.fillText(truncate(node.label, node.w - 16), node.x + node.w / 2, node.y + node.h / 2 + (node.kind === 'database' ? 6 : 0))
  }
  ctx.restore()
}

export function drawLifeline(ctx: CanvasRenderingContext2D, node: DiagramNode, bottom: number): void {
  const x = node.x + node.w / 2
  ctx.save()
  ctx.strokeStyle = colors.groupStroke
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(x, node.y + node.h)
  ctx.lineTo(x, bottom)
  ctx.stroke()
  ctx.restore()
}

export function drawEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  selected: boolean,
  opts: boolean | DrawEdgeOpts = false,
): void {
  const style: DrawEdgeOpts = typeof opts === 'boolean' || opts == null ? { dashed: Boolean(opts) } : opts
  const dashed = Boolean(style.dashed)
  const fromMark = style.fromMark ?? 'none'
  const toMark = style.toMark ?? 'arrow'
  ctx.save()
  ctx.strokeStyle = selected ? colors.select : colors.edge
  ctx.fillStyle = selected ? colors.select : colors.edge
  ctx.lineWidth = selected ? 2 : 1.4
  if (dashed) ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  const mx = (x1 + x2) / 2
  ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
  const startAngle = Math.atan2(0, mx - x1 || 1)
  const endAngle = Math.atan2(0, x2 - mx || 1)
  drawEdgeMark(ctx, x1, y1, startAngle, fromMark, selected)
  drawEdgeMark(ctx, x2, y2, endAngle, toMark, selected)
  if (label) {
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = colors.muted
    ctx.fillText(label, mx, (y1 + y2) / 2 - 6)
  }
  if (style.fromCard) drawCard(ctx, x1, y1, startAngle, style.fromCard, 1)
  if (style.toCard) drawCard(ctx, x2, y2, endAngle, style.toCard, -1)
  ctx.restore()
}

export type EdgeMark = 'none' | 'arrow' | 'triangle' | 'diamond' | 'diamondFill'

export type DrawEdgeOpts = {
  dashed?: boolean
  fromMark?: EdgeMark
  toMark?: EdgeMark
  fromCard?: string
  toCard?: string
}

export function classEdgeStyle(relation?: EdgeRelation): { dashed: boolean; fromMark: EdgeMark; toMark: EdgeMark } {
  if (relation === 'extends') return { dashed: false, fromMark: 'none', toMark: 'triangle' }
  if (relation === 'implements') return { dashed: true, fromMark: 'none', toMark: 'triangle' }
  if (relation === 'composes') return { dashed: false, fromMark: 'diamondFill', toMark: 'none' }
  if (relation === 'aggregates') return { dashed: false, fromMark: 'diamond', toMark: 'none' }
  if (relation === 'depends') return { dashed: true, fromMark: 'none', toMark: 'arrow' }
  return { dashed: false, fromMark: 'none', toMark: 'arrow' }
}

export function edgeLabel(edge: DiagramEdge, diagramType?: string): string {
  if (diagramType === 'class') return edge.label
  if (edge.relation === 'extends') return edge.label ? `extends ${edge.label}` : 'extends'
  if (edge.relation === 'implements') return edge.label ? `impl ${edge.label}` : 'implements'
  if (edge.relation === 'composes') return edge.label || '◆'
  if (edge.relation === 'aggregates') return edge.label || '◇'
  if (edge.relation === 'oneToMany') return edge.label ? `||--|{ ${edge.label}` : '||--|{'
  if (edge.relation === 'zeroToMany') return edge.label ? `||--o{ ${edge.label}` : '||--o{'
  if (edge.relation === 'oneToOne') return edge.label ? `||--|| ${edge.label}` : '||--||'
  if (edge.relation === 'manyToMany') return edge.label ? `}|--|{ ${edge.label}` : '}|--|{'
  return edge.label
}

export function ports(node: DiagramNode): { x: number; y: number }[] {
  return [
    { x: node.x + node.w / 2, y: node.y },
    { x: node.x + node.w, y: node.y + node.h / 2 },
    { x: node.x + node.w / 2, y: node.y + node.h },
    { x: node.x, y: node.y + node.h / 2 },
  ]
}

export function nearestPorts(
  a: DiagramNode,
  b: DiagramNode,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  let best = { from: ports(a)[1]!, to: ports(b)[3]!, d: Infinity }
  for (const p of ports(a)) {
    for (const q of ports(b)) {
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2
      if (d < best.d) best = { from: p, to: q, d }
    }
  }
  return best
}

function drawCompartment(ctx: CanvasRenderingContext2D, node: DiagramNode, stroke: string, hideLabel = false): void {
  roundRect(ctx, node.x, node.y, node.w, node.h, 8)
  ctx.fill()
  clearShadow(ctx)
  ctx.strokeStyle = stroke
  ctx.stroke()
  ctx.save()
  ctx.strokeStyle = colors.insetLine
  ctx.lineWidth = 1
  roundRect(ctx, node.x + 1, node.y + 1, node.w - 2, node.h - 2, 7)
  ctx.stroke()
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(node.x, node.y + 36)
  ctx.lineTo(node.x + node.w, node.y + 36)
  ctx.strokeStyle = stroke
  ctx.stroke()
  ctx.fillStyle = colors.text
  ctx.font = 'bold 13px "SF Pro Text", "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (!hideLabel) {
    const title = node.stereotype ? `«${node.stereotype}» ${node.label}` : node.label
    ctx.fillText(truncate(title, node.w - 12), node.x + node.w / 2, node.y + 18)
  }
  if (hideLabel) return
  ctx.font = '12px ui-monospace, Menlo, monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = colors.muted
  const members = node.members ?? []
  const classLike = node.kind === 'class' || node.kind === 'interface' || node.kind === 'abstract'
  if (classLike) {
    const { fields, methods } = splitMembers(members)
    let y = node.y + 50
    for (const m of fields) {
      ctx.fillText(truncate(m, node.w - 20), node.x + 10, y)
      y += 18
    }
    if (fields.length && methods.length) {
      ctx.beginPath()
      ctx.moveTo(node.x, y - 8)
      ctx.lineTo(node.x + node.w, y - 8)
      ctx.strokeStyle = stroke
      ctx.stroke()
      y += 10
    }
    ctx.fillStyle = colors.muted
    for (const m of methods) {
      ctx.fillText(truncate(m, node.w - 20), node.x + 10, y)
      y += 18
    }
    return
  }
  members.forEach((m, i) => {
    ctx.fillText(truncate(m, node.w - 20), node.x + 10, node.y + 50 + i * 18)
  })
}

function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function stadium(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, h / 2)
}

function drawCylinder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const ry = Math.min(14, h / 6)
  ctx.beginPath()
  ctx.moveTo(x, y + ry)
  ctx.lineTo(x, y + h - ry)
  ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, Math.PI, 0, true)
  ctx.lineTo(x + w, y + ry)
  ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI, true)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const inset = w * 0.18
  ctx.beginPath()
  ctx.moveTo(x + inset, y)
  ctx.lineTo(x + w - inset, y)
  ctx.lineTo(x + w, y + h / 2)
  ctx.lineTo(x + w - inset, y + h)
  ctx.lineTo(x + inset, y + h)
  ctx.lineTo(x, y + h / 2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w, y + h / 2)
  ctx.lineTo(x + w / 2, y + h)
  ctx.lineTo(x, y + h / 2)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawEdgeMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  kind: EdgeMark,
  selected: boolean,
): void {
  if (kind === 'none') return
  const stroke = selected ? colors.select : colors.edge
  ctx.save()
  ctx.fillStyle = stroke
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  if (kind === 'arrow') {
    drawArrowHead(ctx, x, y, angle)
    ctx.restore()
    return
  }
  if (kind === 'triangle') {
    const size = 11
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - size * Math.cos(angle - 0.45), y - size * Math.sin(angle - 0.45))
    ctx.lineTo(x - size * Math.cos(angle + 0.45), y - size * Math.sin(angle + 0.45))
    ctx.closePath()
    ctx.fillStyle = colors.nodeFill
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    return
  }
  const size = 8
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const px = -dy
  const py = dx
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dx * size + px * 5, y + dy * size + py * 5)
  ctx.lineTo(x + dx * size * 2, y + dy * size * 2)
  ctx.lineTo(x + dx * size - px * 5, y + dy * size - py * 5)
  ctx.closePath()
  if (kind === 'diamondFill') ctx.fill()
  else {
    ctx.fillStyle = colors.nodeFill
    ctx.fill()
  }
  ctx.stroke()
  ctx.restore()
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  text: string,
  along: 1 | -1,
): void {
  const dist = 16
  const side = 10
  const px = -Math.sin(angle)
  const py = Math.cos(angle)
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = colors.muted
  ctx.fillText(text, x + Math.cos(angle) * dist * along + px * side, y + Math.sin(angle) * dist * along + py * side)
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  const size = 9
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - size * Math.cos(angle - 0.4), y - size * Math.sin(angle - 0.4))
  ctx.lineTo(x - size * Math.cos(angle + 0.4), y - size * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

function truncate(text: string, maxWidth: number): string {
  if (text.length * 7 < maxWidth) return text
  const chars = Math.max(4, Math.floor(maxWidth / 7) - 1)
  return text.slice(0, chars) + '…'
}
