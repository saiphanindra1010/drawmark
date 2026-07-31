import { describe, expect, it } from 'vitest'
import { selectionBoxes, unionBounds } from './selection.ts'

const nodes = [
  { id: 'a', kind: 'class' as const, label: 'A', x: 0, y: 0, w: 100, h: 50 },
  { id: 'b', kind: 'class' as const, label: 'B', x: 200, y: 20, w: 80, h: 40 },
]
const groups = [{ id: 'g', label: 'G', x: 10, y: 10, w: 20, h: 20 }]

describe('selectionBoxes', () => {
  it('returns nothing when empty', () => {
    expect(selectionBoxes([], nodes, groups)).toEqual([])
  })

  it('returns a box per selected node or group', () => {
    expect(selectionBoxes(['a', 'g'], nodes, groups)).toEqual([
      { x: 0, y: 0, w: 100, h: 50 },
      { x: 10, y: 10, w: 20, h: 20 },
    ])
  })
})

describe('unionBounds', () => {
  it('is null for no boxes', () => {
    expect(unionBounds([])).toBeNull()
  })

  it('wraps every selected box', () => {
    expect(unionBounds(selectionBoxes(['a', 'b'], nodes, []))).toEqual({
      x: 0,
      y: 0,
      w: 280,
      h: 60,
    })
  })
})
