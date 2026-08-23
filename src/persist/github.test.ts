import { describe, expect, it } from 'vitest'
import {
  canPushToRepo,
  compareReposByLatest,
  decodeBase64,
  encodeBase64,
  githubPathForTitle,
  nextGithubPath,
  nextLinkFromHeader,
  lastOpenedStorageKey,
  repoStorageKey,
  savePathFor,
  contentsApiPath,
} from './github.ts'

describe('encodeBase64', () => {
  it('round-trips unicode markdown', () => {
    const text = '# Order service\n\n```mermaid\nclassDiagram\n  class Café\n```\n'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('ignores whitespace in GitHub payloads', () => {
    const encoded = encodeBase64('hello')
    expect(decodeBase64(`${encoded.slice(0, 2)}\n${encoded.slice(2)}`)).toBe('hello')
  })
})

describe('nextLinkFromHeader', () => {
  it('reads the next page URL', () => {
    expect(
      nextLinkFromHeader(
        '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=4>; rel="last"',
      ),
    ).toBe('https://api.github.com/user/repos?page=2')
  })

  it('returns null when there is no next page', () => {
    expect(nextLinkFromHeader('<https://api.github.com/user/repos?page=1>; rel="prev"')).toBeNull()
  })
})

describe('compareReposByLatest', () => {
  it('puts the most recently pushed repo first', () => {
    const older = { name: 'old', pushed_at: '2024-01-01T00:00:00Z' }
    const newer = { name: 'new', pushed_at: '2026-08-17T00:00:00Z' }
    expect([older, newer].sort(compareReposByLatest).map((r) => r.name)).toEqual(['new', 'old'])
  })
})

describe('canPushToRepo', () => {
  it('keeps repos without a permissions object', () => {
    expect(canPushToRepo({})).toBe(true)
  })

  it('drops read-only org repos', () => {
    expect(canPushToRepo({ permissions: { push: false, admin: false } })).toBe(false)
  })
})

describe('savePathFor', () => {
  it('keeps the existing GitHub path when the title changes', () => {
    expect(savePathFor('Payments', 'drawmark/untitled.md')).toBe('drawmark/untitled.md')
  })

  it('uses the title slug for a new diagram', () => {
    expect(savePathFor('Order Service')).toBe('drawmark/order-service.md')
  })
})

describe('nextGithubPath', () => {
  it('writes new diagrams under drawmark/', () => {
    expect(githubPathForTitle('Diagram')).toBe('drawmark/diagram.md')
    expect(nextGithubPath('Diagram')).toEqual({ path: 'drawmark/diagram.md' })
  })

  it('renames when the diagram title changes', () => {
    expect(nextGithubPath('diagram', 'drawmark/ddddd.md')).toEqual({
      path: 'drawmark/diagram.md',
      previous: 'drawmark/ddddd.md',
    })
  })

  it('keeps the path when the title slug is unchanged', () => {
    expect(nextGithubPath('Diagram', 'drawmark/diagram.md')).toEqual({ path: 'drawmark/diagram.md' })
  })
})

describe('repoStorageKey', () => {
  it('scopes the remembered repo to the signed-in GitHub user', () => {
    expect(repoStorageKey('Octocat')).toBe('drawmark.github.repo.octocat')
    expect(repoStorageKey('')).toBe('drawmark.github.repo')
  })
})

describe('contentsApiPath', () => {
  it('encodes each path segment', () => {
    expect(contentsApiPath('drawmark/order service.md')).toBe('drawmark/order%20service.md')
  })
})

describe('lastOpenedStorageKey', () => {
  it('scopes the last diagram to the GitHub user and repo', () => {
    expect(lastOpenedStorageKey('Octocat', 'Celigo', 'Docs')).toBe(
      'drawmark.github.last.octocat.celigo/docs',
    )
  })
})
