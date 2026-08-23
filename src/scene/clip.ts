import { nextId } from './ids.ts'
import { scene } from './scene.ts'
import type { DiagramEdge, DiagramGroup, DiagramNode, SceneGraph } from './types.ts'

const PREFIX = '%%drawmark-clip:'
const PASTE_OFFSET = 24

export type ClipboardGraph = SceneGraph

let memoryText = ''

export function rememberClip(text: string): void {
  memoryText = text
}

export function recalledClip(): string {
  return memoryText
}

export function sliceSelection(selected: Iterable<string>, graph: SceneGraph): ClipboardGraph | null {
  const ids = new Set(selected)
  const nodes = graph.nodes.filter((n) => ids.has(n.id)).map(cloneNode)
  const groups = graph.groups.filter((g) => ids.has(g.id)).map(cloneGroup)
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = graph.edges
    .filter((e) => ids.has(e.id) || (nodeIds.has(e.from) && nodeIds.has(e.to)))
    .map(cloneEdge)
  if (!nodes.length && !groups.length && !edges.length) return null
  return { diagramType: graph.diagramType, nodes, edges, groups }
}

export function rebaseClipboard(clip: ClipboardGraph, dx = PASTE_OFFSET, dy = PASTE_OFFSET): ClipboardGraph {
  const ids = new Map<string, string>()
  const nodes = clip.nodes.map((n) => {
    const id = nextId('n')
    ids.set(n.id, id)
    return { ...cloneNode(n), id, x: n.x + dx, y: n.y + dy }
  })
  const groups = clip.groups.map((g) => {
    const id = nextId('g')
    ids.set(g.id, id)
    return { ...cloneGroup(g), id, x: g.x + dx, y: g.y + dy }
  })
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = clip.edges
    .map((e) => ({
      ...cloneEdge(e),
      id: nextId('e'),
      from: ids.get(e.from) ?? e.from,
      to: ids.get(e.to) ?? e.to,
    }))
    .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
  return { diagramType: clip.diagramType, nodes, edges, groups }
}

export function applyClipboard(clip: ClipboardGraph): string[] {
  const next = rebaseClipboard(clip)
  scene.nodes.push(...next.nodes)
  scene.edges.push(...next.edges)
  scene.groups.push(...next.groups)
  return [...next.nodes.map((n) => n.id), ...next.groups.map((g) => g.id)]
}

export function encodeClipboard(clip: ClipboardGraph): string {
  return PREFIX + JSON.stringify(clip)
}

export function decodeClipboard(text: string): ClipboardGraph | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith(PREFIX)) return null
  try {
    const parsed = JSON.parse(trimmed.slice(PREFIX.length)) as ClipboardGraph
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.groups)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function writeClipboardText(text: string): Promise<void> {
  rememberClip(text)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // Clipboard API is missing or blocked; fall through to execCommand.
  }
  copyViaExecCommand(text)
}

function copyViaExecCommand(text: string): void {
  if (typeof document === 'undefined') return
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  ta.setSelectionRange(0, text.length)
  document.execCommand('copy')
  ta.remove()
}

function cloneNode(n: DiagramNode): DiagramNode {
  return { ...n, members: n.members ? [...n.members] : undefined }
}

function cloneGroup(g: DiagramGroup): DiagramGroup {
  return { ...g }
}

function cloneEdge(e: DiagramEdge): DiagramEdge {
  return { ...e }
}
