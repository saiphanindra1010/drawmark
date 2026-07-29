import { fitToBounds, pan, screenToWorld, setZoomCentered, zoomAt, zoomFactorFromWheel } from './camera.ts'
import { connectSnapPad, nearestConnectTarget } from './connect.ts'
import { cursorFor } from './cursor.ts'
import { nearestPorts, ports } from './draw.ts'
import { overlayState, paint, canvasSize } from './renderer.ts'
import { isDoubleClick, type ClickStamp } from './dblclick.ts'
import { isEditing, startEdit } from './textOverlay.ts'
import { snapDrag } from './snap.ts'
import { checkpoint, checkpointCoalesced, endCoalesce } from '../scene/history.ts'
import {
  addEdge,
  addGroup,
  addNode,
  camera,
  classEditorId,
  deleteSelected,
  groupById,
  markDirty,
  nodeById,
  notifyChrome,
  overlayFocused,
  requestRender,
  scene,
  selectedIds,
  setClassEditor,
  setSelection,
} from '../scene/scene.ts'
import { rebuildIndex, hitsAt, hitsIn } from '../scene/spatial.ts'
import { isTypingTarget } from '../scene/typing.ts'
import type { GroupKind, NodeKind, Tool } from '../scene/types.ts'
import { COMPARTMENT_KINDS, NODE_SIZES, PALETTE, isSequenceLayout } from '../scene/types.ts'

export let currentTool: Tool = 'select'
let spacePan = false
let pointer: PointerState | null = null
let overlayEl: HTMLCanvasElement | null = null
let lastClick: ClickStamp | null = null

type Hit = { id: string; kind: 'node' | 'group' | 'edge' }

type PointerState =
  | { mode: 'pan'; lx: number; ly: number }
  | { mode: 'drag'; lx: number; ly: number; sx: number; sy: number; ids: string[]; moved: boolean; editOnUp: boolean }
  | { mode: 'marquee'; sx: number; sy: number; moved: boolean }
  | { mode: 'connect'; fromId: string }
  | { mode: 'create'; kind: NodeKind; sx: number; sy: number }
  | { mode: 'group'; sx: number; sy: number; kind: GroupKind }

const shapeTools: NodeKind[] = Object.values(PALETTE).flat()

export function setTool(tool: Tool): void {
  if (tool !== currentTool && classEditorId) setClassEditor(null)
  currentTool = tool
  if (!isShapeTool(tool)) overlayState.ghost = null
  syncCursor()
  notifyChrome()
  requestRender()
}

export function isShapeTool(tool: Tool): tool is NodeKind {
  return (shapeTools as string[]).includes(tool)
}

export function initPointer(overlay: HTMLCanvasElement): void {
  overlayEl = overlay
  overlay.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  overlay.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  rebuildIndex()
  syncCursor()
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const cam = camera()
  if (e.ctrlKey || e.metaKey) {
    zoomAt(cam, e.clientX, e.clientY, zoomFactorFromWheel(e.deltaY))
  } else {
    pan(cam, -e.deltaX, -e.deltaY)
  }
  requestRender()
}

function chromeTyping(e: KeyboardEvent): boolean {
  return isTypingTarget(e.target)
}

function onKeyDown(e: KeyboardEvent): void {
  if (overlayFocused || isEditing() || chromeTyping(e)) return
  if (e.code === 'Space') {
    spacePan = true
    e.preventDefault()
    syncCursor()
  }
  const meta = e.metaKey || e.ctrlKey
  if (meta || e.altKey) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    checkpoint()
    deleteSelected()
    rebuildIndex()
    return
  }
  if (e.key === 'Enter' || e.key === 'F2') {
    e.preventDefault()
    beginEditSelection()
    return
  }
  if (e.key === 'Escape' && classEditorId) {
    setClassEditor(null)
    e.preventDefault()
    return
  }
  if (e.key === 'v' || e.key === 'Escape') setTool('select')
  if (e.key === 'h') setTool('hand')
  if (e.key === 'l') setTool('arrow')
  if (e.key === 'g') setTool(scene.diagramType === 'sequence' ? 'alt' : 'group')
  if (e.key === '1') fitAll()
  if (e.key === '2') fitSelection()
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    checkpointCoalesced()
    nudge(dx, dy)
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') {
    spacePan = false
    syncCursor()
  }
}

function capturePointer(e: PointerEvent): void {
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onDown(e: PointerEvent): void {
  if (e.button === 2) return
  if (overlayFocused || isEditing()) return
  const world = screenToWorld(camera(), e.clientX, e.clientY)
  const tool = spacePan || e.button === 1 || currentTool === 'hand' ? 'hand' : currentTool

  if (tool === 'hand') {
    capturePointer(e)
    pointer = { mode: 'pan', lx: e.clientX, ly: e.clientY }
    syncCursor()
    return
  }

  if (tool === 'arrow') {
    capturePointer(e)
    const fromId = connectTargetAt(world.x, world.y)
    if (fromId) pointer = { mode: 'connect', fromId }
    return
  }

  if (tool === 'group' || tool === 'alt' || tool === 'loop' || tool === 'opt') {
    capturePointer(e)
    pointer = { mode: 'group', sx: e.clientX, sy: e.clientY, kind: tool }
    return
  }

  if (isShapeTool(tool)) {
    capturePointer(e)
    pointer = { mode: 'create', kind: tool, sx: e.clientX, sy: e.clientY }
    return
  }

  const hit = topHit(world.x, world.y)
  const stamp: ClickStamp | null = hit ? { t: performance.now(), id: hit.id, x: e.clientX, y: e.clientY } : null
  const doubled = Boolean(
    hit && hit.kind !== 'edge' && stamp && (e.detail >= 2 || isDoubleClick(lastClick, stamp)),
  )
  lastClick = doubled ? null : stamp
  if (doubled && hit && hit.kind !== 'edge') {
    pointer = null
    if (!selectedIds.has(hit.id)) setSelection([hit.id])
    const node = hit.kind === 'node' ? nodeById(hit.id) : groupById(hit.id)
    if (node) startEdit(node, hit.kind)
    return
  }

  if (hit) {
    capturePointer(e)
    const already = selectedIds.has(hit.id)
    if (!e.shiftKey && !already) setSelection([hit.id])
    if (e.shiftKey) {
      const next = new Set(selectedIds)
      if (next.has(hit.id)) next.delete(hit.id)
      else next.add(hit.id)
      setSelection(next)
    }
    if (hit.kind !== 'edge') {
      pointer = {
        mode: 'drag',
        lx: e.clientX,
        ly: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        ids: [...selectedIds],
        moved: false,
        editOnUp: already && !e.shiftKey && canTypeOn(hit) && !isCompartmentHit(hit),
      }
      if (!pointer.editOnUp) checkpointCoalesced()
    }
    return
  }

  capturePointer(e)
  if (!e.shiftKey) setSelection([])
  pointer = { mode: 'marquee', sx: e.clientX, sy: e.clientY, moved: false }
}

function onMove(e: PointerEvent): void {
  if (!pointer) {
    hoverAndGhost(e)
    syncCursor()
    return
  }
  const cam = camera()
  if (pointer.mode === 'pan') {
    pan(cam, e.clientX - pointer.lx, e.clientY - pointer.ly)
    pointer.lx = e.clientX
    pointer.ly = e.clientY
    requestRender()
    syncCursor()
    return
  }
  if (pointer.mode === 'drag') {
    if (!pointer.moved) {
      if (Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy) < 5) return
      pointer.moved = true
      checkpointCoalesced()
    }
    let dx = (e.clientX - pointer.lx) / cam.zoom
    let dy = (e.clientY - pointer.ly) / cam.zoom
    const movingNodes = scene.nodes.filter((n) => pointer && pointer.mode === 'drag' && pointer.ids.includes(n.id))
    const movingGroups = scene.groups.filter((g) => pointer && pointer.mode === 'drag' && pointer.ids.includes(g.id))
    const others = scene.nodes.filter((n) => !pointer || pointer.mode !== 'drag' || !pointer.ids.includes(n.id))
    const snapped = movingNodes.length ? snapDrag(dx, dy, movingNodes, others) : { dx, dy, guides: [] }
    dx = snapped.dx
    dy = snapped.dy
    overlayState.guides = snapped.guides
    for (const n of movingNodes) {
      n.x += dx
      n.y += dy
    }
    for (const g of movingGroups) {
      g.x += dx
      g.y += dy
    }
    pointer.lx = e.clientX
    pointer.ly = e.clientY
    markDirty()
    return
  }
  if (pointer.mode === 'marquee' || pointer.mode === 'group') {
    const dist = Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy)
    if (pointer.mode === 'marquee' && !pointer.moved && dist < 5) return
    if (pointer.mode === 'marquee') pointer.moved = true
    const x = Math.min(pointer.sx, e.clientX)
    const y = Math.min(pointer.sy, e.clientY)
    overlayState.marquee = { x, y, w: Math.abs(e.clientX - pointer.sx), h: Math.abs(e.clientY - pointer.sy) }
    requestRender()
    return
  }
  if (pointer.mode === 'connect') {
    const from = nodeById(pointer.fromId)
    if (!from) return
    const world = screenToWorld(cam, e.clientX, e.clientY)
    const toId = connectTargetAt(world.x, world.y, pointer.fromId)
    overlayState.hoveredId = toId
    overlayState.liveArrow = liveConnectEnds(from, toId ? nodeById(toId) : undefined, world)
    requestRender()
    return
  }
  if (pointer.mode === 'create') setPlaceGhostFromScreen(e.clientX, e.clientY, pointer.kind)
}

function onUp(e: PointerEvent): void {
  if (!pointer) return
  const cam = camera()
  const world = screenToWorld(cam, e.clientX, e.clientY)
  if (pointer.mode === 'connect') {
    const toId = connectTargetAt(world.x, world.y, pointer.fromId)
    if (toId) {
      checkpoint()
      const y = isSequenceLayout(scene.nodes) ? Math.max(world.y, 80) : undefined
      const edge = addEdge(pointer.fromId, toId, '', y)
      if (edge) setSelection([toId])
      markDirty()
    }
  }
  if (pointer.mode === 'create') {
    placeNodeAt(pointer.kind, e.clientX, e.clientY)
  }
  if (pointer.mode === 'drag' && !pointer.moved && pointer.editOnUp) {
    const id = pointer.ids[0]
    if (id) {
      const node = nodeById(id)
      const group = groupById(id)
      if (node) startEdit(node, 'node')
      else if (group) startEdit(group, 'group')
    }
  }
  if (pointer.mode === 'group' && overlayState.marquee) {
    const a = screenToWorld(cam, overlayState.marquee.x, overlayState.marquee.y)
    const b = screenToWorld(
      cam,
      overlayState.marquee.x + overlayState.marquee.w,
      overlayState.marquee.y + overlayState.marquee.h,
    )
    checkpoint()
    const g = addGroup(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), pointer.kind)
    setSelection([g.id])
    setTool('select')
    markDirty()
  }
  if (pointer.mode === 'marquee' && overlayState.marquee && pointer.moved) {
    const a = screenToWorld(cam, overlayState.marquee.x, overlayState.marquee.y)
    const b = screenToWorld(
      cam,
      overlayState.marquee.x + overlayState.marquee.w,
      overlayState.marquee.y + overlayState.marquee.h,
    )
    const hits = hitsIn(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))
    setSelection(hits.filter((h) => h.kind === 'node' || h.kind === 'group').map((h) => h.id))
  }
  pointer = null
  overlayState.marquee = null
  overlayState.liveArrow = null
  overlayState.guides = []
  overlayState.ghost = null
  endCoalesce()
  rebuildIndex()
  notifyChrome()
  syncCursor()
  paint()
}

function hoverAndGhost(e: PointerEvent): void {
  const overCanvas = e.target === overlayEl || document.elementFromPoint(e.clientX, e.clientY) === overlayEl
  if (!overCanvas) {
    if (overlayState.hoveredId || overlayState.ghost) {
      overlayState.hoveredId = null
      overlayState.ghost = null
      requestRender()
    }
    return
  }
  const world = screenToWorld(camera(), e.clientX, e.clientY)
  const hit = currentTool === 'arrow' ? connectHit(world.x, world.y) : topHit(world.x, world.y)
  const nextId = hit?.id ?? null
  let dirtyHover = false
  if (nextId !== overlayState.hoveredId) {
    overlayState.hoveredId = nextId
    dirtyHover = true
  }
  if (isShapeTool(currentTool)) {
    setPlaceGhostFromScreen(e.clientX, e.clientY, currentTool)
    return
  }
  if (overlayState.ghost) {
    overlayState.ghost = null
    dirtyHover = true
  }
  if (dirtyHover) requestRender()
}

export function setPlaceGhostFromScreen(clientX: number, clientY: number, kind: NodeKind): void {
  const world = screenToWorld(camera(), clientX, clientY)
  const size = NODE_SIZES[kind]
  let x = world.x - size.w / 2
  let y = world.y - size.h / 2
  if (scene.diagramType === 'sequence') {
    x = Math.round(world.x / 200) * 200 - size.w / 2
    y = 40
  }
  overlayState.ghost = { kind, x, y, w: size.w, h: size.h }
  requestRender()
}

export function clearPlaceGhost(): void {
  overlayState.ghost = null
  requestRender()
}

export function placeNodeAt(kind: NodeKind, clientX: number, clientY: number): void {
  const world = screenToWorld(camera(), clientX, clientY)
  checkpoint()
  let x = world.x
  let y = world.y
  if (scene.diagramType === 'sequence') {
    x = Math.round(world.x / 200) * 200
    y = 40
  }
  const node = addNode(kind, x, y)
  node.x -= node.w / 2
  if (scene.diagramType !== 'sequence') node.y -= node.h / 2
  else node.y = 40
  setSelection([node.id])
  setTool('select')
  overlayState.ghost = null
  markDirty()
  rebuildIndex()
  notifyChrome()
  paint()
  if (canTypeOn({ id: node.id, kind: 'node' })) startEdit(node, 'node')
}

export function resetZoom(): void {
  const { w, h } = canvasSize()
  setZoomCentered(camera(), 1, w, h)
  requestRender()
  notifyChrome()
}

function liveConnectEnds(
  from: NonNullable<ReturnType<typeof nodeById>>,
  dest: ReturnType<typeof nodeById>,
  world: { x: number; y: number },
): { x1: number; y1: number; x2: number; y2: number } {
  if (isSequenceLayout(scene.nodes)) {
    const floor = Math.max(from.y + from.h + 8, dest ? dest.y + dest.h + 8 : 0)
    const y = Math.max(world.y, floor)
    return {
      x1: from.x + from.w / 2,
      y1: y,
      x2: dest ? dest.x + dest.w / 2 : world.x,
      y2: y,
    }
  }
  const start = nearestPoint(from, world.x, world.y)
  const end = dest ? nearestPoint(dest, world.x, world.y) : world
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
}

function connectTargetAt(x: number, y: number, excludeId?: string): string | null {
  return nearestConnectTarget(x, y, scene.nodes, connectSnapPad(camera().zoom), {
    excludeId,
    sequence: isSequenceLayout(scene.nodes),
    sequenceBottom: sequenceBottom(),
  })
}

function connectHit(x: number, y: number): Hit | null {
  const id = connectTargetAt(x, y)
  return id ? { id, kind: 'node' } : null
}

function sequenceBottom(): number {
  let bottom = 480
  for (const n of scene.nodes) bottom = Math.max(bottom, n.y + n.h + 360)
  for (const e of scene.edges) bottom = Math.max(bottom, (e.y ?? 160) + 80)
  return bottom
}

function topHit(x: number, y: number): Hit | null {
  const hits = hitsAt(x, y)
  const node = hits.find((h) => h.kind === 'node')
  if (node) return node
  const edge = edgeHit(x, y)
  if (edge) return edge
  const group = hits.find((h) => h.kind === 'group')
  return group ?? null
}

function edgeHit(x: number, y: number): Hit | null {
  const thresh = 8 / camera().zoom
  for (const e of scene.edges) {
    const a = nodeById(e.from)
    const b = nodeById(e.to)
    if (!a || !b) continue
    let x1: number
    let y1: number
    let x2: number
    let y2: number
    if (isSequenceLayout(scene.nodes)) {
      x1 = a.x + a.w / 2
      y1 = e.y ?? 160
      x2 = b.x + b.w / 2
      y2 = e.y ?? 160
    } else {
      const p = nearestPorts(a, b)
      x1 = p.from.x
      y1 = p.from.y
      x2 = p.to.x
      y2 = p.to.y
    }
    if (distToSegment(x, y, x1, y1, x2, y2) <= thresh) return { id: e.id, kind: 'edge' }
  }
  return null
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = dx * dx + dy * dy
  if (len === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function nearestPoint(node: ReturnType<typeof nodeById>, x: number, y: number): { x: number; y: number } {
  if (!node) return { x, y }
  let best = ports(node)[0]!
  let d = Infinity
  for (const p of ports(node)) {
    const n = (p.x - x) ** 2 + (p.y - y) ** 2
    if (n < d) {
      d = n
      best = p
    }
  }
  return best
}

function canTypeOn(hit: Hit): boolean {
  if (hit.kind === 'edge') return false
  if (hit.kind === 'group') return true
  const n = nodeById(hit.id)
  if (!n) return false
  return n.kind !== 'stateStart' && n.kind !== 'stateEnd'
}

function isCompartmentHit(hit: Hit): boolean {
  if (hit.kind !== 'node') return false
  const n = nodeById(hit.id)
  return Boolean(n && COMPARTMENT_KINDS.includes(n.kind))
}

function beginEditSelection(): void {
  if (selectedIds.size !== 1) return
  const id = [...selectedIds][0]
  if (!id) return
  const node = nodeById(id)
  if (node && canTypeOn({ id, kind: 'node' })) {
    startEdit(node, 'node')
    return
  }
  const group = groupById(id)
  if (group) startEdit(group, 'group')
}

function nudge(dx: number, dy: number): void {
  for (const n of scene.nodes) {
    if (selectedIds.has(n.id)) {
      n.x += dx
      n.y += dy
    }
  }
  for (const g of scene.groups) {
    if (selectedIds.has(g.id)) {
      g.x += dx
      g.y += dy
    }
  }
  markDirty()
}

function syncCursor(): void {
  if (!overlayEl) return
  const tool = spacePan ? 'hand' : currentTool
  overlayEl.style.cursor = cursorFor(tool, Boolean(overlayState.hoveredId), pointer?.mode === 'pan')
}

export function fitAll(): void {
  const bounds = boundsOfIds(scene.nodes.map((n) => n.id).concat(scene.groups.map((g) => g.id)))
  if (!bounds) return
  const { w, h } = canvasSize()
  fitToBounds(camera(), bounds, w, h)
  requestRender()
}

function fitSelection(): void {
  const ids = [...selectedIds]
  const bounds = boundsOfIds(ids.length ? ids : scene.nodes.map((n) => n.id))
  if (!bounds) return
  const { w, h } = canvasSize()
  fitToBounds(camera(), bounds, w, h)
  requestRender()
}

function boundsOfIds(ids: string[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of ids) {
    const n = nodeById(id)
    const g = groupById(id)
    const b = n ?? g
    if (!b) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}
