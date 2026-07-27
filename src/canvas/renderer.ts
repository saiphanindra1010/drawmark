import { camera, currentRelation, groupById, nodeById, scene, selectedIds, subscribeRender } from '../scene/scene.ts'
import { KIND_LABEL, isSequenceLayout, type NodeKind } from '../scene/types.ts'
import { classEdgeStyle, nearestPorts, colors, drawEdge, drawGrid, drawGroup, drawLifeline, drawNode } from './draw.ts'
import { drawEdgeEndpoints, drawHoverFrame, drawSelectionFrame, selectionBoxes } from './selection.ts'
import { drawGuides, type Guide } from './snap.ts'
import { editingId, layoutEdit } from './textOverlay.ts'

export type OverlayState = {
  marquee: { x: number; y: number; w: number; h: number } | null
  liveArrow: { x1: number; y1: number; x2: number; y2: number } | null
  guides: Guide[]
  hoveredId: string | null
  ghost: { kind: NodeKind; x: number; y: number; w: number; h: number } | null
}

export const overlayState: OverlayState = {
  marquee: null,
  liveArrow: null,
  guides: [],
  hoveredId: null,
  ghost: null,
}

let world: HTMLCanvasElement
let overlay: HTMLCanvasElement
let worldCtx: CanvasRenderingContext2D
let overlayCtx: CanvasRenderingContext2D

export function initRenderer(worldEl: HTMLCanvasElement, overlayEl: HTMLCanvasElement): void {
  world = worldEl
  overlay = overlayEl
  const wctx = world.getContext('2d')
  const octx = overlay.getContext('2d')
  if (!wctx || !octx) throw new Error('Canvas 2d unavailable')
  worldCtx = wctx
  overlayCtx = octx
  resize()
  window.addEventListener('resize', resize)
  subscribeRender(paint)
  paint()
}

export function canvasSize(): { w: number; h: number } {
  return { w: world.width / devicePixelRatio, h: world.height / devicePixelRatio }
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  for (const c of [world, overlay]) {
    c.width = Math.floor(w * dpr)
    c.height = Math.floor(h * dpr)
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    const ctx = c.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  paint()
}

export function paint(): void {
  const { w, h } = canvasSize()
  const cam = camera()
  drawGrid(worldCtx, cam, w, h)
  worldCtx.save()
  worldCtx.translate(cam.x, cam.y)
  worldCtx.scale(cam.zoom, cam.zoom)
  for (const g of scene.groups) {
    drawGroup(worldCtx, g, selectedIds.has(g.id), overlayState.hoveredId === g.id, editingId() === g.id)
  }
  if (sequenceLayout()) {
    const bottom = Math.max(360, ...scene.edges.map((e) => (e.y ?? 160) + 80), ...scene.nodes.map((n) => n.y + 320))
    for (const n of scene.nodes) drawLifeline(worldCtx, n, bottom)
    for (const e of scene.edges) {
      const a = nodeById(e.from)
      const b = nodeById(e.to)
      if (!a || !b) continue
      const y = e.y ?? 160
      drawEdge(
        worldCtx,
        a.x + a.w / 2,
        y,
        b.x + b.w / 2,
        y,
        e.label,
        selectedIds.has(e.id) || overlayState.hoveredId === e.id,
        e.relation === 'reply',
      )
    }
  } else {
    for (const e of scene.edges) {
      const a = nodeById(e.from)
      const b = nodeById(e.to)
      if (!a || !b) continue
      const p = nearestPorts(a, b)
      const style = classEdgeStyle(e.relation)
      drawEdge(
        worldCtx,
        p.from.x,
        p.from.y,
        p.to.x,
        p.to.y,
        e.label,
        selectedIds.has(e.id) || overlayState.hoveredId === e.id,
        {
          ...style,
          fromCard: e.fromCard,
          toCard: e.toCard,
        },
      )
    }
  }
  for (const n of scene.nodes) {
    drawNode(worldCtx, n, selectedIds.has(n.id), overlayState.hoveredId === n.id, editingId() === n.id)
  }
  worldCtx.restore()

  overlayCtx.clearRect(0, 0, w, h)
  overlayCtx.save()
  overlayCtx.translate(cam.x, cam.y)
  overlayCtx.scale(cam.zoom, cam.zoom)
  if (overlayState.guides.length) drawGuides(overlayCtx, overlayState.guides)
  if (overlayState.ghost) {
    overlayCtx.globalAlpha = 0.4
    const g = overlayState.ghost
    drawNode(
      overlayCtx,
      { id: 'ghost', kind: g.kind, label: KIND_LABEL[g.kind], x: g.x, y: g.y, w: g.w, h: g.h },
      false,
    )
    overlayCtx.globalAlpha = 1
  }
  if (overlayState.liveArrow) {
    drawEdge(
      overlayCtx,
      overlayState.liveArrow.x1,
      overlayState.liveArrow.y1,
      overlayState.liveArrow.x2,
      overlayState.liveArrow.y2,
      '',
      true,
      classEdgeStyle(currentRelation),
    )
  }
  drawSelectionOverlay(overlayCtx, cam.zoom)
  overlayCtx.restore()
  if (overlayState.marquee) {
    overlayCtx.save()
    overlayCtx.strokeStyle = colors.select
    overlayCtx.fillStyle = colors.selectFill
    overlayCtx.strokeRect(overlayState.marquee.x, overlayState.marquee.y, overlayState.marquee.w, overlayState.marquee.h)
    overlayCtx.fillRect(overlayState.marquee.x, overlayState.marquee.y, overlayState.marquee.w, overlayState.marquee.h)
    overlayCtx.restore()
  }
  const editId = editingId()
  if (editId) {
    const target = nodeById(editId) ?? groupById(editId)
    if (target) layoutEdit(target)
  }
}

function drawSelectionOverlay(ctx: CanvasRenderingContext2D, zoom: number): void {
  const boxes = selectionBoxes(selectedIds, scene.nodes, scene.groups)
  for (const box of boxes) drawSelectionFrame(ctx, box, zoom)
  drawSelectedEdges(ctx, zoom)
  const hover = overlayState.hoveredId
  if (!hover || selectedIds.has(hover) || overlayState.liveArrow) return
  const node = nodeById(hover)
  const group = groupById(hover)
  const box = node ?? group
  if (box) drawHoverFrame(ctx, { x: box.x, y: box.y, w: box.w, h: box.h }, zoom)
}

function drawSelectedEdges(ctx: CanvasRenderingContext2D, zoom: number): void {
  for (const e of scene.edges) {
    if (!selectedIds.has(e.id) && overlayState.hoveredId !== e.id) continue
    const a = nodeById(e.from)
    const b = nodeById(e.to)
    if (!a || !b) continue
    if (sequenceLayout()) {
      const y = e.y ?? 160
      if (selectedIds.has(e.id)) {
        drawEdgeEndpoints(ctx, a.x + a.w / 2, y, b.x + b.w / 2, y, zoom)
      }
      continue
    }
    const p = nearestPorts(a, b)
    if (selectedIds.has(e.id)) drawEdgeEndpoints(ctx, p.from.x, p.from.y, p.to.x, p.to.y, zoom)
  }
}

function sequenceLayout(): boolean {
  return isSequenceLayout(scene.nodes)
}
