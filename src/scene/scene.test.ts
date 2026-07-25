import { describe, expect, it } from 'vitest'
import { replaceGraph, scene, setDiagramType } from './scene.ts'
import { isSequenceLayout } from './types.ts'

globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  cb(0)
  return 0
}) as typeof requestAnimationFrame

describe('setDiagramType', () => {
  it('does not move or replace boxes on the canvas', () => {
    replaceGraph(
      {
        diagramType: 'class',
        nodes: [{ id: 'a', kind: 'class', label: 'Order', x: 40, y: 80, w: 220, h: 128 }],
        edges: [],
        groups: [],
      },
      true,
    )
    const before = { ...scene.nodes[0]! }
    const nodes = scene.nodes
    setDiagramType('er')
    expect(scene.diagramType).toBe('er')
    expect(scene.nodes).toBe(nodes)
    expect(scene.nodes[0]).toEqual(before)
  })
})

describe('isSequenceLayout', () => {
  it('is based on node kinds, not the selected diagram type', () => {
    expect(isSequenceLayout([{ kind: 'class' }])).toBe(false)
    expect(isSequenceLayout([{ kind: 'actor' }, { kind: 'participant' }])).toBe(true)
    expect(isSequenceLayout([])).toBe(false)
  })
})
