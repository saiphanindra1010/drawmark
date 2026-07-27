import { describe, expect, it } from 'vitest'
import { zoomFactorFromWheel } from './camera.ts'

describe('zoomFactorFromWheel', () => {
  it('is 1 at rest', () => {
    expect(zoomFactorFromWheel(0)).toBe(1)
  })

  it('zooms out for positive delta', () => {
    const factor = zoomFactorFromWheel(100)
    expect(factor).toBeLessThan(1)
    expect(factor).toBeCloseTo(Math.exp(-0.2), 8)
  })

  it('zooms in for negative delta', () => {
    const factor = zoomFactorFromWheel(-100)
    expect(factor).toBeGreaterThan(1)
    expect(factor).toBeCloseTo(Math.exp(0.2), 8)
  })
})
