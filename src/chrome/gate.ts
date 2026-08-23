import { supabaseConfigured } from '../persist/config.ts'
import {
  authError,
  authLogin,
  clearRepoPickPrompt,
  githubAccessToken,
  isSignedIn,
  signInWithGithub,
} from '../persist/auth.ts'
import { githubRepo, listGithubRepos, setGithubRepo, type GithubRepo } from '../persist/github.ts'
import { ICONS } from './icons.ts'

let root: HTMLElement | null = null
let requested = false
let dismissed = false
let errorText = ''
let loading = false
let filter = ''
let repos: GithubRepo[] = []
let reposLoaded = false
let loadGen = 0

export function initGate(host: HTMLElement): void {
  root = host
  host.id = 'gate'
  host.className = 'gate'
  host.hidden = true
}

export function showGate(message?: string): void {
  requested = true
  dismissed = false
  errorText = message ?? authError()
  reposLoaded = false
  repos = []
  void syncGate()
}

export function hideGate(): void {
  requested = false
  dismissed = true
  clearRepoPickPrompt()
  hideFrame()
}

export function gateOpen(): boolean {
  return Boolean(root && !root.hidden)
}

async function syncGate(): Promise<void> {
  if (!root) return
  const token = githubAccessToken()
  const signedIn = isSignedIn()
  const repo = githubRepo()
  const pickingRepo = signedIn && !repo && !dismissed
  if (!requested && !pickingRepo) {
    hideFrame()
    return
  }
  root.hidden = false
  if (signedIn && token && !reposLoaded && !loading) {
    const gen = ++loadGen
    loading = true
    paint()
    try {
      repos = await listGithubRepos()
      reposLoaded = true
    } catch (err) {
      errorText = safeError(err)
    } finally {
      loading = false
    }
    if (gen !== loadGen) return
  }
  paint()
}

function hideFrame(): void {
  if (!root) return
  root.hidden = true
  root.innerHTML = ''
}

function paint(): void {
  if (!root || root.hidden) return
  root.innerHTML = ''
  const card = document.createElement('div')
  card.className = 'gate-card'
  const brand = document.createElement('div')
  brand.className = 'gate-brand'
  brand.innerHTML = `<span class="brand-mark"></span><span class="brand-name">Drawmark</span>`
  card.append(brand)

  const title = document.createElement('h1')
  title.className = 'gate-title'
  const copy = document.createElement('p')
  copy.className = 'gate-copy'

  if (errorText) {
    const err = document.createElement('p')
    err.className = 'gate-error'
    err.textContent = errorText
    card.append(err)
  }

  if (!isSignedIn()) {
    title.textContent = 'Sign in to save'
    copy.textContent = 'Save diagrams as markdown in your GitHub repo.'
    card.append(title, copy)
    if (!supabaseConfigured()) {
      const setup = document.createElement('p')
      setup.className = 'gate-error'
      setup.textContent = 'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server.'
      card.append(setup)
    }
    card.append(githubBtn('Sign in to save', () => void onSignIn()))
    card.append(textBtn('Not now', hideGate))
    root.append(card)
    return
  }

  title.textContent = 'Choose a repository'
  if (!githubAccessToken()) {
    copy.textContent = `Signed in as ${authLogin() || 'GitHub'}, but GitHub did not grant repo access. Sign in again and allow repository access. In Supabase → GitHub provider, additional scopes must include repo.`
    card.append(title, copy)
    card.append(githubBtn('Sign in to save', () => void onSignIn()))
    card.append(textBtn('Not now', hideGate))
    root.append(card)
    return
  }

  copy.textContent = `Signed in as ${authLogin() || 'GitHub'}. Files go in drawmark/*.md.`
  card.append(title, copy)
  card.append(filterInput())
  if (loading) {
    const status = document.createElement('p')
    status.className = 'gate-copy'
    status.textContent = 'Loading repositories…'
    card.append(status)
  }
  const list = document.createElement('div')
  list.className = 'gate-list'
  const q = filter.trim().toLowerCase()
  for (const repo of repos) {
    const label = `${repo.owner}/${repo.name}`
    if (q && !label.toLowerCase().includes(q)) continue
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'gate-row'
    const name = document.createElement('span')
    name.className = 'gate-row-name'
    name.textContent = label
    const detail = document.createElement('span')
    detail.className = 'gate-row-detail'
    detail.textContent = repo.branch
    row.append(name, detail)
    row.addEventListener('click', () => {
      setGithubRepo(repo)
      hideGate()
    })
    list.append(row)
  }
  card.append(list)
  card.append(textBtn('Not now', hideGate))
  root.append(card)
}

function githubBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'gate-github'
  b.innerHTML = ICONS.github
  const text = document.createElement('span')
  text.textContent = label
  b.append(text)
  b.addEventListener('click', onClick)
  return b
}

function textBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'gate-skip'
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function filterInput(): HTMLInputElement {
  const input = document.createElement('input')
  input.className = 'gate-filter'
  input.type = 'search'
  input.placeholder = 'Filter repositories'
  input.value = filter
  input.spellcheck = false
  input.addEventListener('input', () => {
    filter = input.value
    const pos = input.selectionStart ?? filter.length
    paint()
    const next = root?.querySelector<HTMLInputElement>('.gate-filter')
    if (next) {
      next.focus()
      next.setSelectionRange(pos, pos)
    }
  })
  return input
}

async function onSignIn(): Promise<void> {
  errorText = ''
  try {
    await signInWithGithub()
  } catch (err) {
    errorText = safeError(err)
    paint()
  }
}

function safeError(err: unknown): string {
  if (err instanceof Error && err.message && !/token|bearer|ghp_|gho_/i.test(err.message)) return err.message
  return 'Sign-in failed'
}
