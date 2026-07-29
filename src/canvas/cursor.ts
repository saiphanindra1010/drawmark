import type { Tool } from '../scene/types.ts'

export type CanvasCursor = 'default' | 'move' | 'grab' | 'grabbing' | 'crosshair' | 'copy'

const PLACE_TOOLS = new Set<string>([
  'arrow',
  'group',
  'alt',
  'loop',
  'opt',
  'service',
  'api',
  'database',
  'cache',
  'queue',
  'client',
  'loadBalancer',
  'store',
  'class',
  'interface',
  'abstract',
  'enum',
  'actor',
  'participant',
  'entity',
  'state',
  'stateStart',
  'stateEnd',
  'stateChoice',
  'activityStart',
  'action',
  'decision',
  'activityEnd',
])

export function cursorFor(tool: Tool, hovered: boolean, panning: boolean): CanvasCursor {
  if (panning) return 'grabbing'
  if (tool === 'hand') return 'grab'
  if (tool === 'arrow') return 'crosshair'
  if (PLACE_TOOLS.has(tool)) return 'copy'
  if (hovered) return 'move'
  return 'default'
}
