import { describe, expect, it } from 'vitest'
import { inspectorModel, inspectorTitle, inspectorVisible, nodePopOpen } from './inspector.ts'
import type { DiagramEdge, DiagramGroup, DiagramNode } from '../scene/types.ts'

const nodes: DiagramNode[] = [
  { id: 'n1', kind: 'class', label: 'Order', x: 0, y: 0, w: 120, h: 80 },
]
const groups: DiagramGroup[] = [{ id: 'g1', label: 'Box', x: 0, y: 0, w: 100, h: 100 }]
const edges: DiagramEdge[] = [{ id: 'e1', from: 'n1', to: 'n1', label: 'owns', relation: 'assoc' }]

describe('inspectorVisible', () => {
  it('hides when nothing is selected', () => {
    const model = inspectorModel([], nodes, groups, edges)
    expect(model.mode).toBe('hidden')
    expect(inspectorVisible(model)).toBe(false)
  })

  it('shows a node inspector for a single node', () => {
    const model = inspectorModel(['n1'], nodes, groups, edges)
    expect(model).toEqual({
      mode: 'node',
      id: 'n1',
      label: 'Order',
      kindLabel: 'Class',
      hasMembers: true,
      memberEdit: 'class',
      fields: [],
      methods: [],
    })
    expect(inspectorVisible(model)).toBe(true)
  })

  it('keeps the class editor closed until an explicit editor id is set', () => {
    const model = inspectorModel(['n1'], nodes, groups, edges)
    expect(nodePopOpen(model, null)).toBe(false)
    expect(nodePopOpen(model, 'n1')).toBe(true)
    expect(nodePopOpen(model, 'other')).toBe(false)
  })

  it('shows multi when several ids are selected', () => {
    const model = inspectorModel(['n1', 'g1'], nodes, groups, edges)
    expect(model).toEqual({ mode: 'multi', count: 2 })
    expect(inspectorVisible(model)).toBe(true)
  })

  it('splits class fields and methods in the inspector', () => {
    const classNode: DiagramNode = {
      id: 'n2',
      kind: 'class',
      label: 'Order',
      x: 0,
      y: 0,
      w: 120,
      h: 80,
      members: ['+id: string', '+place(cmd)'],
    }
    const model = inspectorModel(['n2'], [classNode], groups, edges)
    expect(model).toMatchObject({
      mode: 'node',
      memberEdit: 'class',
      fields: ['+id: string'],
      methods: ['+place(cmd)'],
    })
  })

  it('titles a node as its kind', () => {
    const model = inspectorModel(['n1'], nodes, groups, edges)
    expect(inspectorTitle(model)).toBe('Class')
  })

  it('shows an edge inspector', () => {
    const model = inspectorModel(['e1'], nodes, groups, edges)
    expect(model.mode).toBe('edge')
    expect(inspectorTitle(model)).toBe('Connection')
    expect(inspectorVisible(model)).toBe(true)
  })

  it('exposes multiplicity on class edges', () => {
    const edge: DiagramEdge = {
      id: 'e2',
      from: 'n1',
      to: 'n1',
      label: '',
      relation: 'assoc',
      fromCard: '1',
      toCard: '*',
    }
    const model = inspectorModel(['e2'], nodes, groups, [edge])
    expect(model).toMatchObject({ mode: 'edge', fromCard: '1', toCard: '*' })
  })
})
