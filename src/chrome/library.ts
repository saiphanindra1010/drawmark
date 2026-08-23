import type { DocumentFile } from '../persist/file.ts'
import { fileStorage } from '../persist/file.ts'
import { supabaseConfigured } from '../persist/config.ts'
import { authLogin, githubAccessToken, isSignedIn, signInWithGithub, signOut } from '../persist/auth.ts'
import {
  clearGithubRepo,
  deleteGithubDiagram,
  duplicateGithubDiagram,
  githubRepo,
  githubStatus,
  listGithubDiagrams,
  listGithubRepos,
  loadGithubDiagram,
  renameGithubDiagram,
  setGithubRepo,
  type GithubDiagram,
  type GithubRepo,
} from '../persist/github.ts'
import { conflictingName, fileNameFor, replaceMarkdownTitle, titleFromFileName } from '../persist/name.ts'
import { subscribeChrome, githubPath } from '../scene/scene.ts'
import { ICONS } from './icons.ts'

export type LibraryHooks = {
  load: (doc: DocumentFile) => void
  upload: (doc: DocumentFile) => void
  newFile: () => void
  currentPath?: () => string | null
  bind: (doc: DocumentFile) => void
  discard: () => Promise<void>
  interruptSave: () => Promise<void>
}

const PAGE_HASH = '#diagrams'

let root: HTMLElement | null = null
let hooks: LibraryHooks | null = null
let open = false
let filter = ''
let errorText = ''
let loading = false
let busy = ''
let dialog: { kind: 'rename'; file: GithubDiagram; value: string } | { kind: 'delete'; file: GithubDiagram } | null = null
let repos: GithubRepo[] = []
let diagrams: GithubDiagram[] = []
let hiddenPaths = new Set<string>()
let loadGen = 0
let reposLoaded = false
let diagramsLoaded = false
let authKey = ''
let hashBound = false

export function initLibrary(host: HTMLElement, next: LibraryHooks): void {
  root = host
  hooks = next
  host.className = 'library-scrim'
  host.hidden = true
  host.addEventListener('click', (e) => {
    if (e.target === host) closeLibrary()
  })
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return
    if (dialog) {
      e.preventDefault()
      closeDialog()
      return
    }
    closeLibrary()
  })
  subscribeChrome(() => {
    if (!open) return
    const nextKey = `${Boolean(githubAccessToken())}|${githubRepo()?.name ?? ''}|${authLogin()}`
    if (nextKey === authKey) {
      if (!dialog) paint()
      return
    }
    authKey = nextKey
    void refresh()
  })
  if (!hashBound) {
    hashBound = true
    window.addEventListener('hashchange', onHashChange)
  }
}

export function openLibrary(): void {
  if (open) {
    void refresh()
    return
  }
  open = true
  filter = ''
  errorText = ''
  busy = ''
  dialog = null
  repos = []
  diagrams = []
  reposLoaded = false
  diagramsLoaded = false
  authKey = `${Boolean(githubAccessToken())}|${githubRepo()?.name ?? ''}|${authLogin()}`
  if (root) root.hidden = false
  if (!isDiagramsHash()) location.hash = PAGE_HASH.slice(1)
  void refresh()
}

export function closeLibrary(): void {
  open = false
  dialog = null
  if (root) root.hidden = true
  if (isDiagramsHash()) {
    history.replaceState(null, '', `${location.pathname}${location.search}`)
  }
}

function isDiagramsHash(): boolean {
  return location.hash === PAGE_HASH || location.hash === '#/diagrams'
}

function onHashChange(): void {
  if (isDiagramsHash()) openLibrary()
  else if (open) closeLibrary()
}

async function refresh(): Promise<void> {
  if (!open || !root) return
  const gen = ++loadGen
  const token = githubAccessToken()
  const repo = githubRepo()
  if (token && repo && !diagramsLoaded) {
    loading = true
    paint()
    try {
      applyListedDiagrams(await listGithubDiagrams())
      diagramsLoaded = true
    } catch (err) {
      errorText = safeError(err)
    } finally {
      loading = false
    }
    if (gen !== loadGen) return
  }
  if (token && !repo && !reposLoaded) {
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

function paint(): void {
  if (!root || !open) return
  root.innerHTML = ''
  const card = document.createElement('div')
  card.className = 'panel library-card'
  card.addEventListener('click', (e) => e.stopPropagation())

  const head = document.createElement('header')
  head.className = 'library-head'
  const title = document.createElement('div')
  title.className = 'library-title'
  title.textContent = githubRepo() ? 'Diagrams' : 'Choose a repository'
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'library-close'
  close.textContent = 'Back to editor'
  close.title = 'Back to editor'
  close.addEventListener('click', () => closeLibrary())
  head.append(title, close)
  card.append(head)

  if (errorText) {
    const err = document.createElement('p')
    err.className = 'library-error'
    err.textContent = errorText
    card.append(err)
  }
  if (busy) card.append(statusLine(busy))

  const token = githubAccessToken()
  if (!token) {
    card.append(authPane())
  } else if (!githubRepo()) {
    card.append(repoPane())
  } else {
    card.append(diagramPane())
  }

  root.append(card)
  if (dialog) root.append(dialogFrame())
}

function closeDialog(): void {
  dialog = null
  paint()
}

function authPane(): HTMLElement {
  const pane = document.createElement('div')
  pane.className = 'library-body'
  const copy = document.createElement('p')
  copy.className = 'library-copy'
  if (!supabaseConfigured()) {
    copy.textContent = 'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server.'
    pane.append(copy)
  } else if (isSignedIn() && !githubAccessToken()) {
    copy.textContent = 'GitHub access expired. Sign in again to save.'
    pane.append(copy)
    pane.append(githubSignInBtn(() => void onSignIn()))
  } else {
    copy.textContent = 'Sign in to save diagrams as markdown in your GitHub repo.'
    pane.append(copy)
    pane.append(githubSignInBtn(() => void onSignIn()))
  }
  pane.append(textBtn('Upload from computer', () => void onUploadFromComputer()))
  return pane
}

function repoPane(): HTMLElement {
  const pane = document.createElement('div')
  pane.className = 'library-body'
  const who = document.createElement('p')
  who.className = 'library-copy'
  who.textContent = `Signed in as ${authLogin() || 'GitHub'}. Pick the repo that should hold drawmark/*.md.`
  pane.append(who)
  pane.append(filterInput('Filter repositories'))
  if (loading) pane.append(statusLine('Loading repositories…'))
  const q = filter.trim().toLowerCase()
  const list = document.createElement('div')
  list.className = 'library-list'
  for (const repo of repos) {
    const label = `${repo.owner}/${repo.name}`
    if (q && !label.toLowerCase().includes(q)) continue
    list.append(
      rowBtn(label, repo.branch, () => {
        setGithubRepo(repo)
        diagrams = []
        diagramsLoaded = false
        filter = ''
        errorText = ''
        authKey = `${Boolean(githubAccessToken())}|${repo.name}|${authLogin()}`
        hiddenPaths = new Set()
        void refresh()
      }),
    )
  }
  pane.append(list)
  pane.append(footerActions(true))
  return pane
}

function diagramPane(): HTMLElement {
  const pane = document.createElement('div')
  pane.className = 'library-body'
  const repo = githubRepo()
  const who = document.createElement('p')
  who.className = 'library-copy'
  who.textContent = repo ? `${repo.owner}/${repo.name} · drawmark/` : githubStatus()
  const hint = document.createElement('p')
  hint.className = 'library-copy'
  hint.textContent =
    'Open a diagram to edit it. Duplicate makes a new GitHub file. Rename changes the filename; editor saves keep updating the same file.'
  pane.append(who, hint)
  pane.append(filterInput('Filter diagrams'))
  const actions = document.createElement('div')
  actions.className = 'library-toolbar'
  const create = document.createElement('button')
  create.type = 'button'
  create.className = 'library-primary'
  create.textContent = 'New diagram'
  create.addEventListener('click', () => onNewDiagram())
  actions.append(create)
  actions.append(textBtn('Upload from computer', () => void onUploadFromComputer()))
  pane.append(actions)
  if (loading) pane.append(statusLine('Loading diagrams…'))
  const q = filter.trim().toLowerCase()
  const list = document.createElement('div')
  list.className = 'library-list'
  const current = hooks?.currentPath?.() ?? githubPath
  for (const file of visibleDiagrams()) {
    if (q && !file.name.toLowerCase().includes(q)) continue
    list.append(diagramRow(file, file.path === current))
  }
  if (!loading && visibleDiagrams().length === 0) {
    list.append(statusLine('No markdown files in drawmark/ yet. Click New diagram to start one.'))
  }
  pane.append(list)
  pane.append(footerActions(false))
  return pane
}

function diagramRow(file: GithubDiagram, isOpen: boolean): HTMLElement {
  const row = document.createElement('div')
  row.className = `library-item${isOpen ? ' open' : ''}`

  const main = document.createElement('button')
  main.type = 'button'
  main.className = 'library-item-main'
  const name = document.createElement('span')
  name.className = 'library-row-name'
  name.textContent = isOpen ? `${file.name} · open` : file.name
  const meta = document.createElement('span')
  meta.className = 'library-row-detail'
  meta.textContent = file.path
  main.append(name, meta)
  main.addEventListener('click', () => void onOpenDiagram(file.path))

  const actions = document.createElement('div')
  actions.className = 'library-item-actions'
  actions.append(miniBtn('Open', () => void onOpenDiagram(file.path)))
  actions.append(miniBtn('Duplicate', () => void onDuplicate(file.path)))
  actions.append(
    miniBtn('Rename', () => {
      dialog = { kind: 'rename', file, value: titleFromFileName(file.name) }
      paint()
    }),
  )
  actions.append(
    miniBtn('Delete', () => {
      dialog = { kind: 'delete', file }
      paint()
    }, true),
  )
  row.append(main, actions)
  return row
}

function dialogFrame(): HTMLElement {
  const scrim = document.createElement('div')
  scrim.className = 'library-modal-scrim'
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim && !busy) closeDialog()
  })
  const modal = document.createElement('div')
  modal.className = 'panel library-modal'
  modal.addEventListener('click', (e) => e.stopPropagation())
  if (dialog?.kind === 'rename') modal.append(renameDialog(dialog.file, dialog.value))
  if (dialog?.kind === 'delete') modal.append(deleteDialog(dialog.file))
  scrim.append(modal)
  return scrim
}

function renameDialog(file: GithubDiagram, value: string): HTMLElement {
  const box = document.createElement('div')
  box.className = 'library-modal-body'
  const title = document.createElement('h2')
  title.className = 'library-modal-title'
  title.textContent = 'Rename diagram'
  const copy = document.createElement('p')
  copy.className = 'library-copy'
  copy.textContent = `This changes the GitHub file name. Saves will keep using the new file.`
  const input = document.createElement('input')
  input.className = 'library-filter'
  input.type = 'text'
  input.value = value
  input.spellcheck = false
  input.autocomplete = 'off'
  const preview = document.createElement('p')
  preview.className = 'library-copy'
  const warn = document.createElement('p')
  warn.className = 'library-rename-warn'
  const syncPreview = (): void => {
    if (dialog?.kind === 'rename') dialog.value = input.value
    const next = input.value.trim()
    preview.textContent = next ? `Will save as ${fileNameFor(next)}` : 'Enter a name'
    const conflict = next ? conflictingName(next, visibleDiagrams().map((item) => item.name), file.path) : null
    warn.hidden = !conflict
    warn.textContent = conflict ? `${fileNameFor(next)} already exists` : ''
  }
  syncPreview()
  input.addEventListener('input', syncPreview)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void onRename(file, input.value)
    }
  })
  const actions = document.createElement('div')
  actions.className = 'library-modal-actions'
  const cancel = miniBtn('Cancel', () => closeDialog())
  cancel.disabled = Boolean(busy)
  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'library-primary'
  save.textContent = busy ? 'Renaming…' : 'Rename'
  save.disabled = Boolean(busy)
  save.addEventListener('click', () => void onRename(file, input.value))
  actions.append(cancel, save)
  box.append(title, copy, input, preview, warn, actions)
  queueMicrotask(() => {
    input.focus()
    input.select()
  })
  return box
}

function deleteDialog(file: GithubDiagram): HTMLElement {
  const box = document.createElement('div')
  box.className = 'library-modal-body'
  const title = document.createElement('h2')
  title.className = 'library-modal-title'
  title.textContent = 'Delete diagram'
  const copy = document.createElement('p')
  copy.className = 'library-copy'
  copy.textContent = `Delete “${titleFromFileName(file.name)}” from GitHub? This cannot be undone.`
  const actions = document.createElement('div')
  actions.className = 'library-modal-actions'
  const cancel = miniBtn('Cancel', () => closeDialog())
  cancel.disabled = Boolean(busy)
  const del = document.createElement('button')
  del.type = 'button'
  del.className = 'library-danger'
  del.textContent = busy ? 'Deleting…' : 'Delete'
  del.disabled = Boolean(busy)
  del.addEventListener('click', () => void onDelete(file))
  actions.append(cancel, del)
  box.append(title, copy, actions)
  queueMicrotask(() => del.focus())
  return box
}

function footerActions(pickingRepo: boolean): HTMLElement {
  const row = document.createElement('div')
  row.className = 'library-footer'
  if (pickingRepo) {
    row.append(textBtn('Upload from computer', () => void onUploadFromComputer()))
  }
  if (!pickingRepo) {
    row.append(
      textBtn('Change repo', () => {
        clearGithubRepo()
        diagrams = []
        repos = []
        diagramsLoaded = false
        reposLoaded = false
        hiddenPaths = new Set()
        filter = ''
        errorText = ''
        authKey = `${Boolean(githubAccessToken())}||${authLogin()}`
        void refresh()
      }),
    )
  }
  row.append(
    textBtn('Sign out', () => {
      void onSignOut()
    }),
  )
  return row
}

function filterInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input')
  input.className = 'library-filter'
  input.type = 'search'
  input.placeholder = placeholder
  input.value = filter
  input.spellcheck = false
  input.addEventListener('input', () => {
    filter = input.value
    const pos = input.selectionStart ?? filter.length
    paint()
    const next = root?.querySelector<HTMLInputElement>('.library-filter')
    if (next) {
      next.focus()
      next.setSelectionRange(pos, pos)
    }
  })
  return input
}

function githubSignInBtn(onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'gate-github'
  b.innerHTML = ICONS.github
  const text = document.createElement('span')
  text.textContent = 'Sign in to save'
  b.append(text)
  b.addEventListener('click', onClick)
  return b
}

function textBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'library-text'
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function miniBtn(label: string, onClick: () => void, danger = false): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = danger ? 'library-mini danger' : 'library-mini'
  b.textContent = label
  b.disabled = Boolean(busy)
  b.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return b
}

function rowBtn(title: string, detail: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'library-row'
  const name = document.createElement('span')
  name.className = 'library-row-name'
  name.textContent = title
  const meta = document.createElement('span')
  meta.className = 'library-row-detail'
  meta.textContent = detail
  b.append(name, meta)
  b.addEventListener('click', onClick)
  return b
}

function statusLine(text: string): HTMLParagraphElement {
  const p = document.createElement('p')
  p.className = 'library-copy'
  p.textContent = text
  return p
}

function onNewDiagram(): void {
  closeLibrary()
  hooks?.newFile()
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

async function onSignOut(): Promise<void> {
  errorText = ''
  repos = []
  diagrams = []
  reposLoaded = false
  diagramsLoaded = false
  try {
    await signOut()
  } catch (err) {
    errorText = safeError(err)
  }
  closeLibrary()
}

async function onUploadFromComputer(): Promise<void> {
  errorText = ''
  try {
    const doc = await fileStorage.open()
    closeLibrary()
    hooks?.upload({ markdown: doc.markdown, name: doc.name })
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || /aborted|cancel/i.test(err.message))) return
    errorText = safeError(err)
    paint()
  }
}

async function onOpenDiagram(path: string): Promise<void> {
  errorText = ''
  busy = 'Opening…'
  paint()
  try {
    const doc = await loadGithubDiagram(path)
    closeLibrary()
    hooks?.load(doc)
  } catch (err) {
    errorText = safeError(err)
    busy = ''
    paint()
  }
}

async function onDuplicate(path: string): Promise<void> {
  errorText = ''
  busy = 'Duplicating…'
  paint()
  try {
    const doc = await duplicateGithubDiagram(path)
    closeLibrary()
    hooks?.load(doc)
  } catch (err) {
    errorText = safeError(err)
    busy = ''
    diagramsLoaded = false
    void refresh()
  }
}

async function onRename(file: GithubDiagram, raw: string): Promise<void> {
  const title = raw.trim()
  if (!title) return
  const conflict = conflictingName(
    title,
    visibleDiagrams().map((item) => item.name),
    file.path,
  )
  if (conflict) {
    errorText = `${fileNameFor(title)} already exists`
    if (dialog?.kind === 'rename') dialog.value = raw
    paint()
    return
  }
  errorText = ''
  busy = 'Renaming…'
  paint()
  try {
    const doc = await loadGithubDiagram(file.path)
    const markdown = replaceMarkdownTitle(doc.markdown, title)
    const saved = await renameGithubDiagram({
      markdown,
      title,
      path: file.path,
      sha: doc.github?.sha || file.sha,
    })
    if (hooks?.currentPath?.() === file.path || githubPath === file.path) hooks?.bind(saved)
    if (saved.github && saved.github.path !== file.path) hiddenPaths.add(file.path)
    replaceDiagram(file.path, {
      name: saved.name.replace(/\.(md|mmd|markdown)$/i, ''),
      path: saved.github?.path ?? file.path,
      sha: saved.github?.sha ?? file.sha,
    })
    dialog = null
    busy = ''
    paint()
  } catch (err) {
    errorText = safeError(err)
    busy = ''
    paint()
  }
}

async function onDelete(file: GithubDiagram): Promise<void> {
  const current = (hooks?.currentPath?.() ?? githubPath) === file.path
  errorText = ''
  hiddenPaths.add(file.path)
  diagrams = diagrams.filter((item) => item.path !== file.path)
  dialog = null
  busy = ''
  paint()
  try {
    if (current) await hooks?.interruptSave()
    await deleteGithubDiagram(file.path, file.sha)
    if (current) await hooks?.discard()
  } catch (err) {
    hiddenPaths.delete(file.path)
    if (!diagrams.some((item) => item.path === file.path)) {
      diagrams = [...diagrams, file].sort((a, b) => a.name.localeCompare(b.name))
    }
    errorText = safeError(err)
    paint()
  }
}

function visibleDiagrams(): GithubDiagram[] {
  return diagrams.filter((file) => !hiddenPaths.has(file.path))
}

function applyListedDiagrams(files: GithubDiagram[]): void {
  const listed = new Set(files.map((file) => file.path))
  for (const path of [...hiddenPaths]) {
    if (!listed.has(path)) hiddenPaths.delete(path)
  }
  diagrams = files.filter((file) => !hiddenPaths.has(file.path))
}

function replaceDiagram(previousPath: string, next: GithubDiagram): void {
  diagrams = diagrams.filter((file) => file.path !== previousPath && file.path !== next.path)
  diagrams.push(next)
  diagrams.sort((a, b) => a.name.localeCompare(b.name))
}

function safeError(err: unknown): string {
  if (err instanceof Error && err.message && !/token|bearer|ghp_|gho_/i.test(err.message)) return err.message
  return 'Something went wrong'
}