import { describe, expect, it } from 'vitest'
import { callbackErrorFromLocation, friendlyAuthError, keepProviderToken, loginFromUser } from './auth.ts'

describe('loginFromUser', () => {
  it('prefers the GitHub user name', () => {
    expect(loginFromUser({ user_metadata: { user_name: 'octocat', preferred_username: 'other' } })).toBe('octocat')
  })

  it('falls back to the email local part', () => {
    expect(loginFromUser({ user_metadata: {}, email: 'dev@example.com' })).toBe('dev')
  })

  it('returns empty when nothing is present', () => {
    expect(loginFromUser(null)).toBe('')
  })
})

describe('keepProviderToken', () => {
  it('keeps the previous GitHub token when a later session omits it', () => {
    expect(keepProviderToken(undefined, 'gho_old')).toBe('gho_old')
    expect(keepProviderToken('gho_new', 'gho_old')).toBe('gho_new')
    expect(keepProviderToken(null, null)).toBeNull()
  })
})

describe('friendlyAuthError', () => {
  it('explains a missing PKCE verifier', () => {
    expect(friendlyAuthError({ name: 'AuthPKCECodeVerifierMissingError', message: 'PKCE code verifier not found' })).toContain(
      'localhost:5173',
    )
  })

  it('does not treat AuthImplicitGrantRedirectError as a missing Redirect URL', () => {
    expect(
      friendlyAuthError({
        name: 'AuthImplicitGrantRedirectError',
        message: 'Unable to exchange external code',
        details: { error: 'invalid_request', code: 'unexpected_failure' },
      }),
    ).toContain('token exchange')
  })

  it('explains a GitHub profile fetch failure', () => {
    expect(friendlyAuthError({ message: 'Error getting user profile from external provider' })).toContain(
      'could not read your GitHub profile',
    )
  })

  it('explains a missing GitHub email', () => {
    expect(friendlyAuthError({ message: 'Error getting user email from external provider' })).toContain(
      'Allow users without an email',
    )
  })

  it('mentions Redirect URLs only when the callback says so', () => {
    expect(friendlyAuthError({ message: 'Redirect URL not allowed for this request' })).toContain('Redirect URLs')
  })

  it('does not surface token-like messages', () => {
    expect(friendlyAuthError({ message: 'bearer gho_secret' })).toBe(
      'GitHub sign-in did not finish. Click Sign in to save again.',
    )
  })
})

describe('callbackErrorFromLocation', () => {
  it('reads the description from the query string', () => {
    expect(callbackErrorFromLocation('?error=invalid_request&error_description=Redirect+URL+not+allowed', '')).toEqual({
      message: 'Redirect URL not allowed',
      code: 'invalid_request',
    })
  })
})
