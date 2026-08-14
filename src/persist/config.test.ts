import { describe, expect, it } from 'vitest'
import { supabaseConfigured } from './config.ts'

describe('supabaseConfigured', () => {
  it('matches whether both Vite env vars are set', () => {
    const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
    const key = String(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    ).trim()
    expect(supabaseConfigured()).toBe(Boolean(url && key))
  })
})
