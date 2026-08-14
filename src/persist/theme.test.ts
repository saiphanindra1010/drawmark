import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from './theme.ts'

describe('parseThemePreference', () => {
  it('defaults to system', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference(undefined)).toBe('system')
    expect(parseThemePreference('')).toBe('system')
    expect(parseThemePreference('auto')).toBe('system')
  })

  it('keeps light and dark', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows the system when preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('ignores the system when light or dark is chosen', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
