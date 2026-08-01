import { describe, expect, it } from 'vitest'
import { connectSnapPad, distanceToRect, nearestConnectTarget } from './connect.ts'

const a = { id: 'a', x: 0, y: 0, w: 100, h: 80 }
const b = { id: 'b', x: 200, y: 0, w: 100, h: 80 }

describe('nearestConnectTarget', () => {
  it('hits inside the box', () => {
    expect(nearestConnectTarget(40, 40, [a, b], 20)).toBe('a')
  })

  it('snaps when just outside the box', () => {
    expect(nearestConnectTarget(108, 40, [a, b], 20)).toBe('a')
  })

  it('ignores a far pointer', () => {
    expect(nearestConnectTarget(150, 40, [a, b], 20)).toBeNull()
  })

  it('skips the excluded node', () => {
    expect(nearestConnectTarget(40, 40, [a, b], 20, { excludeId: 'a' })).toBeNull()
  })

  it('hits a sequence lifeline below the actor', () => {
    expect(
      nearestConnectTarget(50, 240, [a, b], 20, { sequence: true, sequenceBottom: 400 }),
    ).toBe('a')
  })

  it('does not hit a neighboring sequence column', () => {
    expect(
      nearestConnectTarget(160, 240, [a, b], 20, { sequence: true, sequenceBottom: 400 }),
    ).toBeNull()
  })
})

describe('distanceToRect', () => {
  it('is 0 inside', () => {
    expect(distanceToRect(10, 10, a)).toBe(0)
  })

  it('is the gap outside', () => {
    expect(distanceToRect(120, 40, a)).toBe(20)
  })
})

describe('connectSnapPad', () => {
  it('grows as you zoom out', () => {
    expect(connectSnapPad(1)).toBe(20)
    expect(connectSnapPad(0.5)).toBe(40)
  })
})
