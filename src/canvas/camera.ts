import type { Camera } from '../scene/types.ts'

export function screenToWorld(camera: Camera, sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  }
}

export function worldToScreen(camera: Camera, x: number, y: number): { x: number; y: number } {
  return {
    x: x * camera.zoom + camera.x,
    y: y * camera.zoom + camera.y,
  }
}

export function pan(camera: Camera, dx: number, dy: number): void {
  camera.x += dx
  camera.y += dy
}

export function zoomFactorFromWheel(deltaY: number): number {
  return Math.exp(-deltaY * 0.002)
}

export function zoomAt(camera: Camera, sx: number, sy: number, factor: number): void {
  const next = Math.min(4, Math.max(0.15, camera.zoom * factor))
  const world = screenToWorld(camera, sx, sy)
  camera.zoom = next
  camera.x = sx - world.x * camera.zoom
  camera.y = sy - world.y * camera.zoom
}

export function setZoomCentered(camera: Camera, zoom: number, viewW: number, viewH: number): void {
  const world = screenToWorld(camera, viewW / 2, viewH / 2)
  camera.zoom = Math.min(4, Math.max(0.15, zoom))
  camera.x = viewW / 2 - world.x * camera.zoom
  camera.y = viewH / 2 - world.y * camera.zoom
}

export function fitToBounds(
  camera: Camera,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewW: number,
  viewH: number,
  padding = 80,
): void {
  const w = Math.max(1, bounds.maxX - bounds.minX)
  const h = Math.max(1, bounds.maxY - bounds.minY)
  const zoom = Math.min((viewW - padding * 2) / w, (viewH - padding * 2) / h, 1.4)
  camera.zoom = Math.max(0.15, zoom)
  camera.x = viewW / 2 - ((bounds.minX + bounds.maxX) / 2) * camera.zoom
  camera.y = viewH / 2 - ((bounds.minY + bounds.maxY) / 2) * camera.zoom
}
