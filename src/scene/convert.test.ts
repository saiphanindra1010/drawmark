import { describe, expect, it } from 'vitest'
import { toMermaid } from '../mermaid/toMermaid.ts'
import { demoGraph, emptyGraph } from './demo.ts'
import { convertGraph, convertKind } from './convert.ts'
import { PALETTE, type DiagramType } from './types.ts'

const TYPES: DiagramType[] = ['class', 'sequence', 'er', 'state', 'activity', 'architecture']

describe('convertGraph', () => {
  it('keeps every node when switching types', () => {
    const graph = demoGraph('class')
    const next = convertGraph(graph, 'er')
    expect(next.diagramType).toBe('er')
    expect(next.nodes).toHaveLength(graph.nodes.length)
    expect(next.edges).toHaveLength(graph.edges.length)
    expect(next.nodes.every((node) => PALETTE.er.includes(node.kind))).toBe(true)
  })

  it('does not wipe an empty canvas', () => {
    const next = convertGraph(emptyGraph('class'), 'sequence')
    expect(next.nodes).toEqual([])
    expect(next.diagramType).toBe('sequence')
  })

  it('emits valid mermaid after every type switch', () => {
    for (const from of TYPES) {
      for (const to of TYPES) {
        const graph = convertGraph(demoGraph(from), to)
        expect(graph.nodes.every((node) => PALETTE[to].includes(node.kind))).toBe(true)
        expect(() => toMermaid(graph, { clean: true })).not.toThrow()
      }
    }
  })

  it('maps people to sequence actors', () => {
    expect(convertKind('client', 'sequence')).toBe('actor')
    expect(convertKind('class', 'sequence')).toBe('participant')
    expect(convertKind('decision', 'state')).toBe('stateChoice')
    expect(convertKind('stateStart', 'activity')).toBe('activityStart')
  })
})
