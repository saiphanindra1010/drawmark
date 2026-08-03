import { describe, expect, it } from 'vitest'
import { applyCanvasTheme, classEdgeStyle, colors } from './draw.ts'

describe('classEdgeStyle', () => {
  it('uses a hollow triangle at the parent for extends', () => {
    expect(classEdgeStyle('extends')).toEqual({ dashed: false, fromMark: 'none', toMark: 'triangle' })
  })

  it('dashes implements and uses', () => {
    expect(classEdgeStyle('implements').dashed).toBe(true)
    expect(classEdgeStyle('depends')).toEqual({ dashed: true, fromMark: 'none', toMark: 'arrow' })
  })

  it('puts diamonds at the owner', () => {
    expect(classEdgeStyle('composes').fromMark).toBe('diamondFill')
    expect(classEdgeStyle('aggregates').fromMark).toBe('diamond')
  })
})

describe('applyCanvasTheme', () => {
  it('switches canvas colors for light and dark', () => {
    applyCanvasTheme('light')
    expect(colors.bg).toBe('#f4f4f5')
    expect(colors.nodeFill).toBe('#ffffff')
    applyCanvasTheme('dark')
    expect(colors.bg).toBe('#0f0f0f')
    expect(colors.nodeFill).toBe('#1e1e1e')
  })
})
