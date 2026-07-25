import { cloneGraph, replaceGraph } from './scene.ts'
import type { SceneGraph } from './types.ts'

const MAX = 80
const past: SceneGraph[] = []
const future: SceneGraph[] = []
let coalescing = false

export function checkpoint(): void {
  past.push(cloneGraph())
  if (past.length > MAX) past.shift()
  future.length = 0
  coalescing = false
}

export function checkpointCoalesced(): void {
  if (coalescing) return
  checkpoint()
  coalescing = true
}

export function endCoalesce(): void {
  coalescing = false
}

export function undo(): void {
  const prev = past.pop()
  if (!prev) return
  future.push(cloneGraph())
  restore(prev)
}

export function redo(): void {
  const next = future.pop()
  if (!next) return
  past.push(cloneGraph())
  restore(next)
}

function restore(graph: SceneGraph): void {
  replaceGraph(
    {
      diagramType: graph.diagramType,
      nodes: graph.nodes.map((n) => ({ ...n, members: n.members ? [...n.members] : undefined })),
      edges: graph.edges.map((e) => ({ ...e })),
      groups: graph.groups.map((g) => ({ ...g })),
    },
    true,
  )
}
