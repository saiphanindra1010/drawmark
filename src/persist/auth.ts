import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from './config.ts'
import { notifyChrome } from '../scene/scene.ts'

const PROVIDER_TOKEN_KEY = 'mermade.gh.provider'

let client: SupabaseClient | null = null
let session: Session | null = null
let providerToken: string | null = null
let signedInEvent = false
let forceRepoPick = false
let lastAuthError = ''

export function oauthReturnPending(): boolean {
  if (typeof window === 'undefined') return false
  const query = new URLSearchParams(window.location.search)
  if (query.has('code') || query.has('error')) return true
  return window.location.hash.includes('access_token') || window.location.hash.includes('error')
}

export function supabaseClient(): SupabaseClient {
  if (!supabaseConfigured()) {
    throw new Error('Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env')
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
    client.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') {
        clearAuth()
        return
      }
      if (next) applySession(next)
      if (event === 'SIGNED_IN') {
        signedInEvent = true
        lastAuthError = ''
      }
    })
  }
  return client
}

export async function initAuth(): Promise<string> {
  if (!supabaseConfigured()) return ''
  providerToken = readStoredProviderToken()
  const fromUrl = typeof window !== 'undefined' ? callbackErrorFromLocation(window.location.search, window.location.hash) : null
  const sb = supabaseClient()
  const started = await sb.auth.initialize()
  const { data } = await sb.auth.getSession()
  if (data.session) {
    applySession(data.session)
    lastAuthError = ''
    stripAuthParams()
    return ''
  }
  if (fromUrl) lastAuthError = friendlyAuthError(fromUrl)
  else if (started.error) lastAuthError = friendlyAuthError(started.error)
  stripAuthParams()
  return lastAuthError
}

export function isSignedIn(): boolean {
  return Boolean(session?.user)
}

export function consumeSignedInEvent(): boolean {
  const value = signedInEvent
  signedInEvent = false
  return value
}

export function shouldPickRepo(): boolean {
  return forceRepoPick
}

export function clearRepoPickPrompt(): void {
  forceRepoPick = false
}

export function authError(): string {
  return lastAuthError
}

export function githubAccessToken(): string | null {
  return session?.provider_token || providerToken || readStoredProviderToken()
}

export function authLogin(): string {
  return loginFromUser(session?.user ?? null)
}

export function loginFromUser(user: User | { user_metadata?: Record<string, unknown>; email?: string } | null): string {
  if (!user) return ''
  const meta = user.user_metadata
  if (meta && typeof meta.user_name === 'string' && meta.user_name.trim()) return meta.user_name.trim()
  if (meta && typeof meta.preferred_username === 'string' && meta.preferred_username.trim()) {
    return meta.preferred_username.trim()
  }
  const email = user.email
  if (email) {
    const local = email.split('@')[0]
    return local ?? ''
  }
  return ''
}

export function keepProviderToken(next: string | null | undefined, previous: string | null): string | null {
  if (next) return next
  return previous
}

export async function signInWithGithub(): Promise<void> {
  lastAuthError = ''
  const sb = supabaseClient()
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'user:email repo',
      redirectTo: window.location.origin,
    },
  })
  if (error) throw new Error('GitHub sign-in failed')
}

export async function signOut(): Promise<void> {
  forceRepoPick = false
  signedInEvent = false
  if (client) {
    const { error } = await client.auth.signOut()
    clearAuth()
    if (error) throw new Error('Sign out failed')
    return
  }
  clearAuth()
}

function applySession(next: Session): void {
  session = next
  const kept = keepProviderToken(next.provider_token, providerToken ?? readStoredProviderToken())
  providerToken = kept
  if (kept) writeStoredProviderToken(kept)
  notifyChrome()
}

function clearAuth(): void {
  session = null
  providerToken = null
  writeStoredProviderToken(null)
  notifyChrome()
}

function readStoredProviderToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(PROVIDER_TOKEN_KEY)
}

function writeStoredProviderToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (token) localStorage.setItem(PROVIDER_TOKEN_KEY, token)
  else localStorage.removeItem(PROVIDER_TOKEN_KEY)
}

function stripAuthParams(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_code')
  url.searchParams.delete('error_description')
  url.hash = ''
  const next = `${url.pathname}${url.search}`
  if (`${url.pathname}${url.search}${url.hash}` !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(window.history.state, '', next)
  }
}

export function callbackErrorFromLocation(search: string, hash: string): AuthFail | null {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const frag = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const message = query.get('error_description') || frag.get('error_description') || ''
  const code = query.get('error_code') || frag.get('error_code') || query.get('error') || frag.get('error') || ''
  if (!message && !code) return null
  return { message: decodeAuthText(message), code }
}

type AuthFail = {
  name?: string
  message?: string
  code?: string
  details?: { error?: string; code?: string } | null
}

export function friendlyAuthError(error: AuthFail): string {
  const message = decodeAuthText(error.message)
  const code = error.code || error.details?.code || error.details?.error || ''
  const text = `${code} ${message}`
  if (/pkce|verifier|code_verifier/i.test(text)) {
    return 'Sign-in was interrupted. Open http://localhost:5173 and click Sign in to save again.'
  }
  if (/redirect[_ ]?uri|redirect url not allowed|redirect url/i.test(text)) {
    return 'Add http://localhost:5173 to Supabase Authentication → URL configuration → Redirect URLs.'
  }
  if (/user profile from external/i.test(text)) {
    return 'Supabase could not read your GitHub profile. Click Save on the GitHub provider, set the GitHub OAuth App callback to the Callback URL shown there, revoke the app at github.com/settings/applications, then sign in again.'
  }
  if (/user email from external/i.test(text)) {
    return 'GitHub did not return an email. Turn on “Allow users without an email”, click Save, then sign in again.'
  }
  if (/unable to exchange external/i.test(text)) {
    const callback = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/callback` : 'your Supabase Auth callback'
    return `GitHub could not finish the token exchange. The OAuth App callback must be ${callback}, and the client ID/secret in Supabase must match.`
  }
  if (message && message.length < 200 && !/token|bearer|ghp_|gho_|sb_|eyJ/i.test(message)) {
    return message
  }
  return 'GitHub sign-in did not finish. Click Sign in to save again.'
}

function decodeAuthText(value?: string): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value.replace(/\+/g, ' ')
  }
}
