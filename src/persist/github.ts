import type { DocumentFile } from './file.ts'
import { DIAGRAM_FOLDER, GITHUB_API, LAST_OPEN_KEY, REPO_KEY, forgetLegacyGithubToken } from './config.ts'
import { authLogin, githubAccessToken, isSignedIn } from './auth.ts'
import { copyName, fileNameFor, replaceMarkdownTitle, titleFromFileName, titleFromMarkdown } from './name.ts'
import { notifyChrome } from '../scene/scene.ts'

export type GithubRepo = { owner: string; name: string; branch: string }

type GithubRepoRaw = {
  name: string
  owner: { login: string }
  default_branch?: string
  pushed_at?: string | null
  updated_at?: string
  permissions?: { push?: boolean; admin?: boolean }
}

const REPO_PAGE_SIZE = 100
const REPO_MAX_PAGES = 20

export type GithubDiagram = { name: string; path: string; sha: string }

type ContentsFile = {
  name: string
  path: string
  sha: string
  type: string
  content?: string
  encoding?: string
}

let picked: GithubRepo | null = null
let pickedLogin: string | null = null
let migrated = false
let diagramIndex: { key: string; files: GithubDiagram[] } | null = null
let indexLoad: Promise<GithubDiagram[]> | null = null

export function repoStorageKey(login: string): string {
  const id = login.trim().toLowerCase()
  return id ? `${REPO_KEY}.${id}` : REPO_KEY
}

export function lastOpenedStorageKey(login: string, owner: string, repo: string): string {
  return `${LAST_OPEN_KEY}.${login.trim().toLowerCase()}.${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`
}

export function lastOpenedPath(): string | null {
  if (typeof localStorage === 'undefined') return null
  const login = authLogin()
  const repo = githubRepo()
  if (!login || !repo) return null
  const path = localStorage.getItem(lastOpenedStorageKey(login, repo.owner, repo.name))
  return path && path.startsWith(`${DIAGRAM_FOLDER}/`) ? path : null
}

export function setLastOpenedPath(path: string | null): void {
  if (typeof localStorage === 'undefined') return
  const login = authLogin()
  const repo = githubRepo()
  if (!login || !repo) return
  const key = lastOpenedStorageKey(login, repo.owner, repo.name)
  if (path) localStorage.setItem(key, path)
  else localStorage.removeItem(key)
}

export function githubRepo(): GithubRepo | null {
  ensureMigrated()
  if (!isSignedIn() && !githubAccessToken()) {
    picked = null
    pickedLogin = null
    return null
  }
  const login = authLogin()
  if (picked && pickedLogin === login) return picked
  picked = readRepo(login)
  pickedLogin = login
  return picked
}

export async function listGithubRepos(): Promise<GithubRepo[]> {
  const token = requireToken()
  const repos = await listAllUserRepos(token)
  return repos
    .filter(canPushToRepo)
    .sort(compareReposByLatest)
    .map((r) => ({
      owner: r.owner.login,
      name: r.name,
      branch: r.default_branch || 'main',
    }))
}

export function canPushToRepo(repo: { permissions?: { push?: boolean; admin?: boolean } }): boolean {
  if (!repo.permissions) return true
  return Boolean(repo.permissions.push || repo.permissions.admin)
}

export function compareReposByLatest(a: { pushed_at?: string | null; updated_at?: string }, b: {
  pushed_at?: string | null
  updated_at?: string
}): number {
  return repoTimestamp(b) - repoTimestamp(a)
}

export function nextLinkFromHeader(link: string | null): string | null {
  if (!link) return null
  for (const part of link.split(',')) {
    if (!part.includes('rel="next"')) continue
    const match = part.match(/<([^>]+)>/)
    if (match?.[1]) return match[1]
  }
  return null
}

function repoTimestamp(repo: { pushed_at?: string | null; updated_at?: string }): number {
  return Date.parse(repo.pushed_at || repo.updated_at || '') || 0
}

async function listAllUserRepos(token: string): Promise<GithubRepoRaw[]> {
  const collected: GithubRepoRaw[] = []
  let path: string | null =
    `/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&direction=desc&per_page=${REPO_PAGE_SIZE}`
  for (let page = 0; path && page < REPO_MAX_PAGES; page++) {
    const { data, link } = await requestJson<GithubRepoRaw[]>(path, token)
    collected.push(...data)
    const next = nextLinkFromHeader(link)
    path = next
  }
  return collected
}

export function setGithubRepo(repo: GithubRepo): void {
  const login = authLogin()
  picked = repo
  pickedLogin = login
  diagramIndex = null
  writeRepo(login, repo)
  notifyChrome()
}

export function clearGithubRepo(): void {
  const login = pickedLogin || authLogin()
  picked = null
  diagramIndex = null
  writeRepo(login, null)
  notifyChrome()
}

export async function listGithubDiagrams(): Promise<GithubDiagram[]> {
  const { token, repo } = requireRepo()
  try {
    const items = await api<ContentsFile[] | ContentsFile>(
      `/repos/${repo.owner}/${repo.name}/contents/${contentsApiPath(DIAGRAM_FOLDER)}?ref=${encodeURIComponent(repo.branch)}`,
      token,
    )
    const list = Array.isArray(items) ? items : []
    const files = list
      .filter((f) => f.type === 'file' && /\.(md|mmd|markdown)$/i.test(f.name))
      .map((f) => ({ name: f.name.replace(/\.(md|mmd|markdown)$/i, ''), path: f.path, sha: f.sha }))
      .sort((a, b) => a.name.localeCompare(b.name))
    rememberDiagrams(files)
    return files
  } catch (err) {
    if (isNotFound(err)) {
      rememberDiagrams([])
      return []
    }
    throw err
  }
}

export function cachedDiagramNames(): string[] {
  return diagramIndex && diagramIndex.key === repoCacheKey() ? diagramIndex.files.map((file) => file.name) : []
}

export function hasDiagramIndex(): boolean {
  return Boolean(diagramIndex && diagramIndex.key === repoCacheKey())
}

export async function ensureDiagramIndex(): Promise<GithubDiagram[]> {
  if (diagramIndex && diagramIndex.key === repoCacheKey()) return diagramIndex.files
  if (indexLoad) return indexLoad
  indexLoad = listGithubDiagrams().finally(() => {
    indexLoad = null
  })
  return indexLoad
}

export function rememberSavedDiagram(doc: DocumentFile): void {
  if (!doc.github) return
  const files = diagramIndex && diagramIndex.key === repoCacheKey() ? [...diagramIndex.files] : []
  const next: GithubDiagram = {
    name: doc.name.replace(/\.(md|mmd|markdown)$/i, ''),
    path: doc.github.path,
    sha: doc.github.sha,
  }
  const index = files.findIndex((file) => file.path === next.path)
  if (index >= 0) files[index] = next
  else files.push(next)
  rememberDiagrams(files)
}

function rememberDiagrams(files: GithubDiagram[]): void {
  diagramIndex = { key: repoCacheKey(), files }
}

function repoCacheKey(): string {
  const repo = githubRepo()
  return repo ? `${repo.owner}/${repo.name}` : ''
}

export async function loadLastOpenedDiagram(): Promise<DocumentFile | null> {
  const path = lastOpenedPath()
  if (!path) return null
  try {
    return await loadGithubDiagram(path)
  } catch {
    setLastOpenedPath(null)
    return null
  }
}

export async function loadGithubDiagram(path: string): Promise<DocumentFile> {
  const { token, repo } = requireRepo()
  const file = await api<ContentsFile>(
    `/repos/${repo.owner}/${repo.name}/contents/${contentsApiPath(path)}?ref=${encodeURIComponent(repo.branch)}`,
    token,
  )
  if (!file.content) throw new Error('That file has no content')
  return {
    markdown: decodeBase64(file.content),
    name: file.name,
    github: { owner: repo.owner, repo: repo.name, path: file.path, sha: file.sha, branch: repo.branch },
  }
}

export function contentsApiPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

export function githubPathForTitle(title: string): string {
  return `${DIAGRAM_FOLDER}/${fileNameFor(title)}`
}

export function savePathFor(title: string, currentPath?: string): string {
  return currentPath || githubPathForTitle(title)
}

export function nextGithubPath(title: string, currentPath?: string): { path: string; previous?: string } {
  const path = githubPathForTitle(title)
  if (currentPath && currentPath !== path) return { path, previous: currentPath }
  return { path }
}

export async function saveGithubDiagram(doc: {
  markdown: string
  title: string
  path?: string
  sha?: string
  overwrite?: boolean
}): Promise<DocumentFile> {
  const { token, repo } = requireRepo()
  return putGithubFile({
    token,
    repo,
    path: savePathFor(doc.title, doc.path),
    markdown: doc.markdown,
    title: doc.title,
    sha: doc.sha,
    overwrite: doc.overwrite ?? Boolean(doc.path),
  })
}

export async function renameGithubDiagram(doc: {
  markdown: string
  title: string
  path: string
  sha: string
}): Promise<DocumentFile> {
  const { token, repo } = requireRepo()
  const { path, previous } = nextGithubPath(doc.title, doc.path)
  if (!previous) {
    return putGithubFile({
      token,
      repo,
      path,
      markdown: doc.markdown,
      title: doc.title,
      sha: doc.sha,
    })
  }
  const saved = await putGithubFile({
    token,
    repo,
    path,
    markdown: doc.markdown,
    title: doc.title,
    overwrite: false,
  })
  await deleteGithubFile({ token, repo, path: previous, sha: doc.sha, title: doc.title, kind: 'rename' })
  return saved
}

export async function duplicateGithubDiagram(path: string): Promise<DocumentFile> {
  const doc = await loadGithubDiagram(path)
  const existing = await listGithubDiagrams()
  const title = copyName(
    titleFromMarkdown(doc.markdown) ?? titleFromFileName(doc.name),
    existing.map((file) => file.name),
  )
  return saveGithubDiagram({
    markdown: replaceMarkdownTitle(doc.markdown, title),
    title,
  })
}

export async function deleteGithubDiagram(path: string, sha: string): Promise<void> {
  const { token, repo } = requireRepo()
  await deleteGithubFile({
    token,
    repo,
    path,
    sha,
    title: titleFromFileName(path.split('/').pop() || path),
    kind: 'delete',
  })
  forgetDiagram(path)
  if (lastOpenedPath() === path) setLastOpenedPath(null)
}

function forgetDiagram(path: string): void {
  if (!diagramIndex || diagramIndex.key !== repoCacheKey()) return
  rememberDiagrams(diagramIndex.files.filter((file) => file.path !== path))
}

async function putGithubFile(args: {
  token: string
  repo: GithubRepo
  path: string
  markdown: string
  title: string
  sha?: string
  overwrite?: boolean
}): Promise<DocumentFile> {
  const body: Record<string, string> = {
    message: `drawmark: save ${args.title}`,
    content: encodeBase64(args.markdown),
    branch: args.repo.branch,
  }
  if (args.sha) body.sha = args.sha
  try {
    const saved = await api<{ content: { name: string; path: string; sha: string } }>(
      `/repos/${args.repo.owner}/${args.repo.name}/contents/${contentsApiPath(args.path)}`,
      args.token,
      { method: 'PUT', body: JSON.stringify(body) },
    )
    return {
      markdown: args.markdown,
      name: saved.content.name,
      github: {
        owner: args.repo.owner,
        repo: args.repo.name,
        path: saved.content.path,
        sha: saved.content.sha,
        branch: args.repo.branch,
      },
    }
  } catch (err) {
    if ((isUnprocessable(err) || isConflict(err)) && !args.sha && args.overwrite) {
      const latest = await api<ContentsFile>(
        `/repos/${args.repo.owner}/${args.repo.name}/contents/${contentsApiPath(args.path)}?ref=${encodeURIComponent(args.repo.branch)}`,
        args.token,
      )
      return putGithubFile({ ...args, sha: latest.sha, overwrite: false })
    }
    if (isUnprocessable(err) && !args.sha) {
      throw new Error(`${fileNameFor(args.title)} already exists`)
    }
    if (!isConflict(err) || !args.sha) throw err
    const latest = await api<ContentsFile>(
      `/repos/${args.repo.owner}/${args.repo.name}/contents/${contentsApiPath(args.path)}?ref=${encodeURIComponent(args.repo.branch)}`,
      args.token,
    )
    return putGithubFile({ ...args, sha: latest.sha })
  }
}

async function deleteGithubFile(args: {
  token: string
  repo: GithubRepo
  path: string
  sha: string
  title: string
  kind?: 'rename' | 'delete'
}): Promise<void> {
  const action = args.kind === 'delete' ? 'delete' : 'rename'
  const url = `/repos/${args.repo.owner}/${args.repo.name}/contents/${contentsApiPath(args.path)}`
  try {
    await api(url, args.token, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `drawmark: ${action} ${args.title}`,
        sha: args.sha,
        branch: args.repo.branch,
      }),
    })
  } catch (err) {
    if (isNotFound(err)) return
    if (!isConflict(err) && !isUnprocessable(err)) {
      if (args.kind === 'delete') throw new Error('Could not delete that diagram on GitHub')
      throw new Error('Saved under the new name, but the previous file could not be removed')
    }
    let latest: ContentsFile
    try {
      latest = await api<ContentsFile>(
        `${url}?ref=${encodeURIComponent(args.repo.branch)}`,
        args.token,
      )
    } catch (lookup) {
      if (isNotFound(lookup)) return
      throw lookup
    }
    try {
      await api(url, args.token, {
        method: 'DELETE',
        body: JSON.stringify({
          message: `drawmark: ${action} ${args.title}`,
          sha: latest.sha,
          branch: args.repo.branch,
        }),
      })
    } catch (retry) {
      if (isNotFound(retry)) return
      if (args.kind === 'delete') throw new Error('Could not delete that diagram on GitHub')
      throw new Error('Saved under the new name, but the previous file could not be removed')
    }
  }
}

export function githubStatus(): string {
  if (!isSignedIn() && !githubAccessToken()) return 'Sign in to save'
  const repo = githubRepo()
  if (!repo) return 'Pick a repo'
  if (!githubAccessToken()) return 'Sign in to save'
  return `${repo.owner}/${repo.name}`
}

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  if (typeof btoa === 'function') {
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin)
  }
  return nodeBuffer().from(bytes).toString('base64')
}

export function decodeBase64(raw: string): string {
  const b64 = raw.replace(/\s/g, '')
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  }
  return new TextDecoder().decode(nodeBuffer().from(b64, 'base64'))
}

function nodeBuffer(): {
  from: (data: Uint8Array | string, enc?: string) => { toString: (enc: string) => string } & Uint8Array
} {
  const buf = (globalThis as { Buffer?: unknown }).Buffer
  if (!buf) throw new Error('Base64 is not available')
  return buf as {
    from: (data: Uint8Array | string, enc?: string) => { toString: (enc: string) => string } & Uint8Array
  }
}

function requireToken(): string {
  const token = githubAccessToken()
  if (!token) throw new Error('Sign in with GitHub first')
  return token
}

function requireRepo(): { token: string; repo: GithubRepo } {
  const token = requireToken()
  const repo = githubRepo()
  if (!repo) throw new Error('Pick a repository')
  return { token, repo }
}

function readRepo(login: string): GithubRepo | null {
  if (typeof localStorage === 'undefined') return null
  const stored = parseRepo(localStorage.getItem(repoStorageKey(login)))
  if (stored) return stored
  const legacy = parseRepo(localStorage.getItem(REPO_KEY))
  if (!legacy) return null
  if (login) {
    writeRepo(login, legacy)
    localStorage.removeItem(REPO_KEY)
  }
  return legacy
}

function writeRepo(login: string, repo: GithubRepo | null): void {
  if (typeof localStorage === 'undefined') return
  const key = repoStorageKey(login)
  if (repo) localStorage.setItem(key, JSON.stringify(repo))
  else localStorage.removeItem(key)
}

function parseRepo(raw: string | null): GithubRepo | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GithubRepo
    if (!parsed.owner || !parsed.name) return null
    return { owner: parsed.owner, name: parsed.name, branch: parsed.branch || 'main' }
  } catch {
    return null
  }
}

function ensureMigrated(): void {
  if (migrated) return
  migrated = true
  forgetLegacyGithubToken()
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const { data } = await requestJson<T>(path, token, init)
  return data
}

async function requestJson<T>(
  pathOrUrl: string,
  token: string,
  init?: RequestInit,
): Promise<{ data: T; link: string | null }> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${GITHUB_API}${pathOrUrl}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!res.ok) {
    const err = new Error(await errorMessage(res)) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  if (res.status === 204) return { data: undefined as T, link: res.headers.get('Link') }
  return { data: (await res.json()) as T, link: res.headers.get('Link') }
}

async function errorMessage(res: Response): Promise<string> {
  if (res.status === 401) return 'GitHub access expired — sign in again'
  if (res.status === 403) return 'GitHub access was denied'
  if (res.status === 404) return 'Not found in that repository'
  if (res.status === 409) return 'The file changed on GitHub'
  try {
    const body = (await res.json()) as { message?: string }
    if (body.message && !/token|bearer|ghp_|gho_/i.test(body.message)) return body.message
  } catch {
    // Use the status text when the body is not JSON.
  }
  return `GitHub request failed (${res.status})`
}

function isNotFound(err: unknown): boolean {
  return hasStatus(err, 404)
}

function isConflict(err: unknown): boolean {
  return hasStatus(err, 409)
}

function isUnprocessable(err: unknown): boolean {
  return hasStatus(err, 422)
}

function hasStatus(err: unknown, status: number): boolean {
  return Boolean(err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === status)
}
