import { THEME_KEY } from './config.ts'

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

type ThemeListener = () => void

const listeners = new Set<ThemeListener>()
let mediaBound = false

export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === 'light' || pref === 'dark') return pref
  return systemDark ? 'dark' : 'light'
}

export function systemPrefersDark(): boolean {
  if (typeof matchMedia !== 'function') return false
  return matchMedia('(prefers-color-scheme: dark)').matches
}

export function themePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system'
  return parseThemePreference(localStorage.getItem(THEME_KEY))
}

export function resolvedTheme(): ResolvedTheme {
  return resolveTheme(themePreference(), systemPrefersDark())
}

export function setThemePreference(pref: ThemePreference): void {
  if (typeof localStorage !== 'undefined') {
    if (pref === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, pref)
  }
  applyTheme()
  notifyTheme()
}

export function applyTheme(): ResolvedTheme {
  const pref = themePreference()
  const resolved = resolveTheme(pref, systemPrefersDark())
  if (typeof document === 'undefined') return resolved
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  root.style.colorScheme = pref === 'system' ? 'light dark' : pref
  return resolved
}

export function subscribeTheme(fn: ThemeListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function initTheme(): ResolvedTheme {
  const resolved = applyTheme()
  if (mediaBound || typeof matchMedia !== 'function') return resolved
  mediaBound = true
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const onChange = (): void => {
    applyTheme()
    notifyTheme()
  }
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
  else mq.addListener(onChange)
  return resolved
}

function notifyTheme(): void {
  for (const fn of listeners) fn()
}
