export type ClickStamp = { t: number; id: string; x: number; y: number }

export const DBLCLICK_MS = 500
export const DBLCLICK_PX = 8

export function isDoubleClick(prev: ClickStamp | null, next: ClickStamp): boolean {
  if (!prev) return false
  if (prev.id !== next.id) return false
  if (next.t - prev.t > DBLCLICK_MS || next.t < prev.t) return false
  return Math.hypot(next.x - prev.x, next.y - prev.y) <= DBLCLICK_PX
}
