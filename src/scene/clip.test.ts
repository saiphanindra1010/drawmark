import { describe, expect, it } from 'vitest'
import { applyClipboard, decodeClipboard, encodeClipboard, rebaseClipboard, recalledClip, rememberClip, sliceSelection } from './clip.ts'
import { resetIds } from './ids.ts'
import { replaceGraph, scene } from './scene.ts'
import type { SceneGraph } from './types.ts'

globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  cb(0)
  return 0
}) as typeof requestAnimationFrame

const graph: SceneGraph = {
  diagramType: 'class',
  nodes: [
    { id: 'a', kind: 'class', label: 'A', x: 0, y: 0, w: 100, h: 80, members: ['+id: string'] },
    { id: 'b', kind: 'class', label: 'B', x: 200, y: 0, w: 100, h: 80 },
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b', label: '', relation: 'assoc' }],
  groups: [],
}

describe('sliceSelection', () => {
  it('copies selected nodes and edges between them', () => {
    const clip = sliceSelection(['a', 'b'], graph)
    expect(clip?.nodes).toHaveLength(2)
    expect(clip?.edges).toHaveLength(1)
    expect(clip?.edges[0]?.from).toBe('a')
  })

  it('drops edges whose ends are not both selected', () => {
    const clip = sliceSelection(['a'], graph)
    expect(clip?.nodes).toHaveLength(1)
    expect(clip?.edges).toHaveLength(0)
  })

  it('returns null when nothing is selected', () => {
    expect(sliceSelection([], graph)).toBeNull()
  })
})

describe('encodeClipboard', () => {
  it('round-trips through text for every browser clipboard', () => {
    const clip = sliceSelection(['a'], graph)
    if (!clip) throw new Error('expected clip')
    const text = encodeClipboard(clip)
    expect(decodeClipboard(text)).toEqual(clip)
    expect(decodeClipboard('classDiagram\n  class A')).toBeNull()
  })
})

describe('rebaseClipboard', () => {
  it('assigns new ids and offsets copies', () => {
    resetIds(10)
    const clip = sliceSelection(['a', 'b'], graph)
    if (!clip) throw new Error('expected clip')
    const next = rebaseClipboard(clip)
    expect(next.nodes.map((n) => n.id)).toEqual(['n11', 'n12'])
    expect(next.nodes[0]?.x).toBe(24)
    expect(next.edges[0]?.from).toBe('n11')
    expect(next.edges[0]?.to).toBe('n12')
  })
})

describe('applyClipboard', () => {
  it('appends remapped copies onto the scene', () => {
    replaceGraph(graph, true)
    resetIds(20)
    const clip = sliceSelection(['a'], graph)
    if (!clip) throw new Error('expected clip')
    const ids = applyClipboard(clip)
    expect(ids).toEqual(['n21'])
    expect(scene.nodes).toHaveLength(3)
    expect(scene.nodes[2]?.label).toBe('A')
    expect(scene.nodes[2]?.members).toEqual(['+id: string'])
  })
})

describe('rememberClip', () => {
  it('keeps an in-app fallback when the system clipboard is blocked', () => {
    rememberClip('hello')
    expect(recalledClip()).toBe('hello')
  })
})
