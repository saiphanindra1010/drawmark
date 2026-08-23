export const GITHUB_API = 'https://api.github.com'
export const DIAGRAM_FOLDER = 'drawmark'
export const REPO_KEY = 'drawmark.github.repo'
export const LAST_OPEN_KEY = 'drawmark.github.last'
export const THEME_KEY = 'drawmark.theme'
export const AUTO_SAVE_MS = 2000
const LEGACY_SESSION_KEY = 'drawmark.github'

function readEnv(
  name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY',
): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export const SUPABASE_URL = readEnv('VITE_SUPABASE_URL')
export const SUPABASE_PUBLISHABLE_KEY =
  readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || readEnv('VITE_SUPABASE_ANON_KEY')

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
}

export function forgetLegacyGithubToken(): void {
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(LEGACY_SESSION_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as { repo?: { owner: string; name: string; branch: string } }
    if (parsed.repo && !localStorage.getItem(REPO_KEY)) {
      localStorage.setItem(REPO_KEY, JSON.stringify(parsed.repo))
    }
  } catch {
    // Drop the old blob even if it is not JSON — it may contain a token.
  }
  localStorage.removeItem(LEGACY_SESSION_KEY)
}
