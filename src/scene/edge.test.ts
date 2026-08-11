import { describe, expect, it } from 'vitest'
import { addEdge, classEditorId, replaceGraph, scene, setClassEditor, setRelation, setSelection } from './scene.ts'

globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  cb(0)
  return 0
}) as typeof requestAnimationFrame

describe('addEdge', () => {
  it('updates relation when the same pair is linked again', () => {
    replaceGraph(
      {
        diagramType: 'class',
        nodes: [
          { id: 'a', kind: 'class', label: 'A', x: 0, y: 0, w: 100, h: 80 },
          { id: 'b', kind: 'class', label: 'B', x: 200, y: 0, w: 100, h: 80 },
        ],
        edges: [],
        groups: [],
      },
      true,
    )
    setRelation('assoc')
    addEdge('a', 'b')
    setRelation('extends')
    addEdge('a', 'b')
    expect(scene.edges).toHaveLength(1)
    expect(scene.edges[0]?.relation).toBe('extends')
  })

  it('rejects a self link', () => {
    expect(addEdge('a', 'a')).toBeNull()
  })
})

describe('setClassEditor', () => {
  it('closes when the edited node is no longer selected', () => {
    setSelection(['a'])
    setClassEditor('a')
    expect(classEditorId).toBe('a')
    setSelection(['b'])
    expect(classEditorId).toBeNull()
  })
})
