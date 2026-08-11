import { describe, expect, it } from 'vitest'
import { KIND_DETAIL, KIND_LABEL, RELATION_PALETTE } from './types.ts'
import type { NodeKind } from './types.ts'

describe('readable labels', () => {
  it('uses Entity not Table', () => {
    expect(KIND_LABEL.entity).toBe('Entity')
    expect(KIND_LABEL.actor).toBe('Person')
    expect(KIND_LABEL.participant).toBe('System')
    expect(KIND_LABEL.abstract).toBe('Abstract class')
  })

  it('has a detail line for every shape', () => {
    const kinds = Object.keys(KIND_LABEL) as NodeKind[]
    for (const kind of kinds) {
      expect(KIND_DETAIL[kind].length).toBeGreaterThan(3)
    }
  })

  it('uses English for table links, not crow-foot glyphs', () => {
    const labels = RELATION_PALETTE.er.map((r) => r.label)
    expect(labels).toEqual(['One to one', 'One to many', 'Zero to many', 'Many to many'])
    for (const label of labels) expect(label).not.toMatch(/\|/)
  })

  it('uses Related not Assoc', () => {
    expect(RELATION_PALETTE.class.find((r) => r.id === 'assoc')?.label).toBe('Related')
    expect(RELATION_PALETTE.class.find((r) => r.id === 'composes')?.label).toBe('Contains')
    expect(RELATION_PALETTE.class.find((r) => r.id === 'depends')?.label).toBe('Uses')
  })
})
