import { describe, expect, it } from 'vitest'
import { isDoubleClick, type ClickStamp } from './dblclick.ts'

const a: ClickStamp = { t: 1000, id: 'n1', x: 10, y: 10 }

describe('isDoubleClick', () => {
  it('is true for a second click on the same node within the time window', () => {
    expect(isDoubleClick(a, { t: 1200, id: 'n1', x: 12, y: 11 })).toBe(true)
  })

  it('is false for the first click', () => {
    expect(isDoubleClick(null, a)).toBe(false)
  })

  it('is false when the clicks are too far apart in time or space', () => {
    expect(isDoubleClick(a, { t: 1600, id: 'n1', x: 10, y: 10 })).toBe(false)
    expect(isDoubleClick(a, { t: 1100, id: 'n1', x: 40, y: 10 })).toBe(false)
  })

  it('is false when the second click is a different node', () => {
    expect(isDoubleClick(a, { t: 1100, id: 'n2', x: 10, y: 10 })).toBe(false)
  })
})
