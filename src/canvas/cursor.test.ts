import { describe, expect, it } from 'vitest'
import { cursorFor } from './cursor.ts'

describe('cursorFor', () => {
  it('uses default on empty select', () => {
    expect(cursorFor('select', false, false)).toBe('default')
  })

  it('uses move when hovering a node in select', () => {
    expect(cursorFor('select', true, false)).toBe('move')
  })

  it('uses grabbing while panning', () => {
    expect(cursorFor('select', true, true)).toBe('grabbing')
    expect(cursorFor('hand', false, true)).toBe('grabbing')
  })

  it('uses grab for the hand tool', () => {
    expect(cursorFor('hand', false, false)).toBe('grab')
  })

  it('uses crosshair while connecting', () => {
    expect(cursorFor('arrow', false, false)).toBe('crosshair')
  })

  it('uses copy while placing a shape', () => {
    expect(cursorFor('class', false, false)).toBe('copy')
    expect(cursorFor('group', false, false)).toBe('copy')
  })
})
