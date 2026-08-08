import { describe, expect, it } from 'vitest'
import { demoGraph, emptyGraph } from '../scene/demo.ts'
import { fromMermaid } from './fromMermaid.ts'
import { toMermaid } from './toMermaid.ts'
import type { DiagramType } from '../scene/types.ts'

describe('architecture flowchart', () => {
  it('emits a flowchart with bound edges and a subgraph', () => {
    const src = toMermaid(demoGraph('architecture'), { clean: true })
    expect(src.startsWith('flowchart LR')).toBe(true)
    expect(src).toContain('subgraph')
    expect(src).toContain('-->|HTTPS|')
    expect(src).toContain('[(Postgres)]')
    expect(src).not.toContain('%% mermade:')
  })

  it('round-trips architecture demo', () => {
    const src = toMermaid(demoGraph('architecture'))
    const parsed = fromMermaid(src)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.graph.diagramType).toBe('architecture')
    expect(parsed.graph.nodes.some((n) => n.label === 'Order Service')).toBe(true)
    expect(parsed.graph.edges.some((e) => e.label === 'HTTPS')).toBe(true)
    expect(parsed.graph.groups.some((g) => g.label === 'VPC')).toBe(true)
  })

  it('reads a fenced markdown flowchart', () => {
    const md = '```mermaid\nflowchart LR\nA[Api] --> B[(Db)]\n```\n'
    const parsed = fromMermaid(md)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.graph.diagramType).toBe('architecture')
    expect(parsed.graph.nodes).toHaveLength(2)
    expect(parsed.graph.nodes[1]?.kind).toBe('database')
  })
})

const lldTypes: DiagramType[] = ['class', 'sequence', 'er', 'state', 'activity']

describe('LLD round-trips', () => {
  it.each(lldTypes)('%s demo round-trips labels', (type) => {
    const graph = demoGraph(type)
    const src = toMermaid(graph)
    const parsed = fromMermaid(src)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.graph.diagramType).toBe(type)
    expect(src).toContain('%% mermade:')
    const labeled = graph.nodes.filter((n) => n.label)
    for (const n of labeled) {
      expect(parsed.graph.nodes.some((p) => p.label === n.label || p.id === n.label.replace(/\s+/g, '_'))).toBe(true)
    }
  })

  it('class diagram emits members and relations', () => {
    const src = toMermaid(demoGraph('class'), { clean: true })
    expect(src.startsWith('classDiagram')).toBe(true)
    expect(src).toContain('class OrderService')
    expect(src).toContain('+place(cmd)')
    expect(src).toContain('*--')
  })

  it('class diagram emits uses, cardinality, and namespace', () => {
    const graph = demoGraph('class')
    graph.edges.push({
      id: 'e3',
      from: 'n1',
      to: 'n3',
      label: '',
      relation: 'depends',
      fromCard: '1',
      toCard: '*',
    })
    graph.groups.push({ id: 'g1', label: 'Domain', x: 60, y: 40, w: 700, h: 400, kind: 'group' })
    const src = toMermaid(graph, { clean: true })
    expect(src).toContain('..>')
    expect(src).toContain('"1"')
    expect(src).toContain('namespace Domain')
  })

  it('parses class Foo without braces, reverse inheritance, and quoted cards', () => {
    const src = `classDiagram
class Foo
Bar --|> Foo
Order "1" --> "*" Item
`
    const parsed = fromMermaid(src)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.graph.nodes.some((n) => n.label === 'Foo')).toBe(true)
    const ext = parsed.graph.edges.find((e) => e.relation === 'extends')
    expect(ext?.from).toBe('Bar')
    expect(ext?.to).toBe('Foo')
    const assoc = parsed.graph.edges.find((e) => e.relation === 'assoc')
    expect(assoc?.fromCard).toBe('1')
    expect(assoc?.toCard).toBe('*')
  })

  it('parses namespace and Parent <|-- Child as child extends parent', () => {
    const src = `classDiagram
namespace Payments {
  class Client
}
Animal <|-- Dog
`
    const parsed = fromMermaid(src)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.graph.groups.some((g) => g.label === 'Payments')).toBe(true)
    expect(parsed.graph.nodes.some((n) => n.label === 'Client')).toBe(true)
    const ext = parsed.graph.edges.find((e) => e.relation === 'extends')
    expect(ext?.from).toBe('Dog')
    expect(ext?.to).toBe('Animal')
  })


  it('sequence diagram emits messages', () => {
    const src = toMermaid(demoGraph('sequence'), { clean: true })
    expect(src.startsWith('sequenceDiagram')).toBe(true)
    expect(src).toContain('actor Client')
    expect(src).toContain('->>')
    expect(src).toContain('POST /orders')
  })

  it('er diagram emits cardinality', () => {
    const src = toMermaid(demoGraph('er'), { clean: true })
    expect(src.startsWith('erDiagram')).toBe(true)
    expect(src).toContain('ORDER')
    expect(src).toContain('||--|{')
  })

  it('state diagram emits transitions', () => {
    const src = toMermaid(demoGraph('state'), { clean: true })
    expect(src.startsWith('stateDiagram-v2')).toBe(true)
    expect(src).toContain('[*]')
    expect(src).toContain('place')
  })

  it('activity diagram emits flowchart TD', () => {
    const src = toMermaid(demoGraph('activity'), { clean: true })
    expect(src.startsWith('flowchart TD')).toBe(true)
    expect(src).toContain('Valid?')
    expect(src).toContain('Place order')
  })

  it('parses sequence from code without throwing', () => {
    const parsed = fromMermaid('sequenceDiagram\nA->>B: hi')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.graph.diagramType).toBe('sequence')
    expect(parsed.graph.edges[0]?.label).toBe('hi')
  })
})

describe('emptyGraph', () => {
  it('starts blank for each diagram type', () => {
    const types: DiagramType[] = ['class', 'sequence', 'er', 'state', 'activity', 'architecture']
    for (const type of types) {
      const graph = emptyGraph(type)
      expect(graph.diagramType).toBe(type)
      expect(graph.nodes).toEqual([])
      expect(graph.edges).toEqual([])
      expect(graph.groups).toEqual([])
      expect(() => toMermaid(graph, { clean: true })).not.toThrow()
    }
  })
})
