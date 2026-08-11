import { describe, expect, it } from 'vitest'
import { isTypingTarget } from './typing.ts'

describe('isTypingTarget', () => {
  it('treats form fields as typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true)
  })

  it('ignores the canvas and body', () => {
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false)
    expect(isTypingTarget({ tagName: 'BODY', closest: () => null })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })

  it('treats a code editor as typing', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', closest: () => ({}) })).toBe(true)
  })
})
