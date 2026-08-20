import './style.css'
import { applyCanvasTheme } from './canvas/draw.ts'
import { currentTool, fitAll, initPointer, isShapeTool, setTool } from './canvas/pointer.ts'
import { initRenderer } from './canvas/renderer.ts'
import { initTextOverlay } from './canvas/textOverlay.ts'
import { initChrome, showToast, type ChromeAction } from './chrome/chrome.ts'
import { initGate, showGate } from './chrome/gate.ts'
import { openLibrary } from './chrome/library.ts'
import {
  consumeSignedInEvent,
  githubAccessToken,
  initAuth,
  isSignedIn,
  oauthReturnPending,
} from './persist/auth.ts'
import { AUTO_SAVE_MS } from './persist/config.ts'
import { initTheme, resolvedTheme, subscribeTheme } from './persist/theme.ts'
import { createAutoSave } from './persist/autosave.ts'
import { fileStorage } from './persist/file.ts'
import type { DocumentFile } from './persist/file.ts'
import { githubRepo, rememberSavedDiagram, saveGithubDiagram, cachedDiagramNames, ensureDiagramIndex, loadLastOpenedDiagram, setLastOpenedPath } from './persist/github.ts'
import { conflictingName, fileNameFor, titleFromFileName, titleFromMarkdown } from './persist/name.ts'
import { checkpoint, redo, undo } from './scene/history.ts'
import { emptyGraph } from './scene/demo.ts'
import { convertGraph } from './scene/convert.ts'
import {
  applyClipboard,
  decodeClipboard,
  encodeClipboard,
  recalledClip,
  rememberClip,
  sliceSelection,
  writeClipboardText,
} from './scene/clip.ts'
import { isTypingTarget } from './scene/typing.ts'
import {
  applyNodeText,
  cloneGraph,
  diagramName,
  dirty,
  editSeq,
  groupById,
  markDirty,
  markSaved,
  markSavedIf,
  nodeById,
  overlayFocused,
  overlayOpen,
  replaceGraph,
  requestRender,
  scene,
  selectedIds,
  setDirtyHandler,
  setDiagramName,
  setFileName,
  setGithubPath,
  setOverlayOpen,
  setSaving,
  setSelection,
  setDiagramType,
  subscribeChrome,
  deleteSelected,
} from './scene/scene.ts'
import { PALETTE } from './scene/types.ts'
import { rebuildIndex } from './scene/spatial.ts'
import { parseScene, serializeScene } from './worker/client.ts'

type OverlayApi = typeof import('./code/overlay.ts')

const oauthReturn = oauthReturnPending()

let overlayApi: OverlayApi | null = null
let currentFile: DocumentFile | null = null
let parseTimer = 0
let codeWriteGen = 0
let codeHost: HTMLElement | null = null
let saveGate: Promise<void> | null = null
let saveEpoch = 0

const autoSave = createAutoSave({
  delayMs: AUTO_SAVE_MS,
  canSave: () => {
    if (!githubAccessToken() || !githubRepo()) return false
    if (currentFile?.github?.path) return true
    return !conflictingName(diagramName, cachedDiagramNames())
  },
  isDirty: () => dirty,
  save: () => saveToGithub(true),
})

async function loadOverlay(): Promise<OverlayApi> {
  if (overlayApi) return overlayApi
  overlayApi = await import('./code/overlay.ts')
  if (!codeHost) throw new Error('code host missing')
  overlayApi.initOverlay(codeHost, onCodeTyped)
  return overlayApi
}

function mount(): void {
  initTheme()
  applyCanvasTheme(resolvedTheme())
  subscribeTheme(() => {
    applyCanvasTheme(resolvedTheme())
    requestRender()
  })
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) throw new Error('#app missing')
  app.innerHTML = `
    <canvas id="world"></canvas>
    <canvas id="overlay"></canvas>
    <nav id="modes"></nav>
    <div id="actions"></div>
    <aside id="rail"></aside>
    <aside id="node-pop" hidden></aside>
    <aside id="inspector" hidden></aside>
    <button id="zoom" type="button">100%</button>
    <footer id="hint"></footer>
    <section id="code-panel" hidden>
      <header id="code-head"></header>
      <div id="code-host"></div>
      <div id="code-error" hidden></div>
    </section>
    <textarea id="text-edit" hidden></textarea>
    <div id="library" hidden></div>
    <div id="gate" hidden></div>
    <div id="toast" hidden></div>
  `

  const world = document.querySelector<HTMLCanvasElement>('#world')!
  const overlay = document.querySelector<HTMLCanvasElement>('#overlay')!
  codeHost = document.querySelector<HTMLElement>('#code-host')!
  const textEdit = document.querySelector<HTMLTextAreaElement>('#text-edit')!

  replaceGraph(emptyGraph('class'), false)
  markSaved()
  rebuildIndex()
  initRenderer(world, overlay)
  initPointer(overlay)
  initTextOverlay(textEdit, (id, kind, value) => {
    if (kind === 'node') {
      const n = nodeById(id)
      if (n) applyNodeText(n, value)
    } else {
      const g = groupById(id)
      if (g) g.label = value
    }
    markDirty()
    void syncCode()
  })
  initChrome(onChrome)
  const gate = document.getElementById('gate')
  if (gate) initGate(gate)
  subscribeChrome(syncPanel)
  setDirtyHandler(() => autoSave.noteChange())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void autoSave.flush()
  })
  window.addEventListener('pagehide', () => {
    void autoSave.flush()
  })
  void initAuth()
    .then(async (message) => {
      stripDiagramsHash()
      const justSignedIn = consumeSignedInEvent()
      const signed = isSignedIn()
      const repo = githubRepo()
      if (signed && repo && githubAccessToken()) {
        lastRepoKey = `${repo.owner}/${repo.name}`
        await restoreLastDiagram()
        return
      }
      if (oauthReturn || justSignedIn || (signed && !repo)) {
        showGate(message)
      }
    })
    .catch(() => {
      showToast('Sign-in restore failed')
    })
  window.addEventListener('pointerup', (e) => {
    if (!overlayOpen) return
    const target = e.target
    if (target instanceof Element && target.closest('#rail, #actions, #modes, #library, #gate, #inspector, #node-pop')) {
      return
    }
    void syncCode()
  })
  window.addEventListener('keydown', onGlobalKeys)
  document.addEventListener('copy', onCopy)
  document.addEventListener('cut', onCut)
  document.addEventListener('paste', onPaste)
  fitAll()
}

let lastRepoKey = ''

function syncPanel(): void {
  const panel = document.getElementById('code-panel')
  if (panel) panel.hidden = !overlayOpen
  const repo = githubRepo()
  const repoKey = repo ? `${repo.owner}/${repo.name}` : ''
  if (repoKey === lastRepoKey) return
  const previous = lastRepoKey
  lastRepoKey = repoKey
  if (!repoKey || !githubAccessToken()) return
  if (previous && dirty) {
    void autoSave.flush().then(() => restoreLastDiagram())
    return
  }
  void restoreLastDiagram()
}

function codeFocused(): boolean {
  return document.activeElement?.closest('#code-panel') !== null
}

async function syncCode(): Promise<string> {
  if (!overlayOpen) return ''
  const text = await serializeScene(cloneGraph())
  const api = await loadOverlay()
  if (!codeFocused()) api.setOverlayText(text)
  return text
}

function ignoreCodeParse(): void {
  codeWriteGen += 1
  window.clearTimeout(parseTimer)
}

function onCodeTyped(text: string): void {
  const gen = codeWriteGen
  window.clearTimeout(parseTimer)
  parseTimer = window.setTimeout(async () => {
    if (gen !== codeWriteGen) return
    const result = await parseScene(text)
    if (gen !== codeWriteGen) return
    const api = await loadOverlay()
    if ('error' in result) {
      api.showOverlayError(result.error)
      return
    }
    api.showOverlayError(null)
    checkpoint()
    replaceGraph(result.graph, true)
    rebuildIndex()
  }, 220)
}

async function onChrome(action: ChromeAction): Promise<void> {
  if (typeof action === 'object' && action.kind === 'type') {
    if (action.value === scene.diagramType) return
    ignoreCodeParse()
    checkpoint()
    setDiagramType(action.value)
    syncToolForType()
    if (overlayOpen) await syncCode()
    ignoreCodeParse()
    return
  }
  if (action === 'toggle-code') {
    const api = await loadOverlay()
    api.toggleOverlay()
    if (overlayOpen) await syncCode()
    return
  }
  if (action === 'copy' || action === 'copy-clean') {
    const text = await serializeScene(cloneGraph(), { clean: action === 'copy-clean' })
    await writeClipboardText(text)
    return
  }
  if (typeof action === 'object' && action.kind === 'upload') {
    try {
      await applyAndSaveUpload(action.doc)
    } catch (err) {
      if (isAbort(err)) return
      showToast(safeError(err))
    }
    return
  }
  if (typeof action === 'object' && action.kind === 'load') {
    await applyDocument(action.doc)
    return
  }
  if (typeof action === 'object' && action.kind === 'bind') {
    bindFile(action.doc)
    setDiagramName(titleFromMarkdown(action.doc.markdown) ?? titleFromFileName(action.doc.name))
    return
  }
  if (action === 'new-file') {
    if (dirty) {
      if (githubAccessToken() && githubRepo()) await autoSave.flush()
      if (dirty && !window.confirm('This diagram has unsaved changes. Start a new one anyway?')) return
    }
    startBlankDiagram()
    showToast('New diagram')
    return
  }
  if (action === 'interrupt-save') {
    autoSave.abandon()
    saveEpoch += 1
    if (saveGate) await saveGate
    return
  }
  if (action === 'discard') {
    autoSave.abandon()
    saveEpoch += 1
    startBlankDiagram()
    if (saveGate) await saveGate
    return
  }
  if (action === 'save') await saveFile()
  if (action === 'duplicate') {
    duplicateSelection()
    return
  }
  if (action === 'delete') {
    checkpoint()
    deleteSelected()
    rebuildIndex()
    if (overlayOpen) await syncCode()
  }
}

async function applyDocument(doc: DocumentFile): Promise<boolean> {
  bindFile(doc)
  setDiagramName(titleFromMarkdown(doc.markdown) ?? titleFromFileName(doc.name))
  const result = await parseScene(doc.markdown)
  if ('error' in result) {
    const api = await loadOverlay()
    setOverlayOpen(true)
    api.setOverlayText(doc.markdown)
    api.showOverlayError(result.error)
    return false
  }
  replaceGraph(result.graph, false)
  rebuildIndex()
  markSaved()
  fitAll()
  await syncCode()
  return true
}

async function applyAndSaveUpload(doc: DocumentFile): Promise<void> {
  const title = titleFromMarkdown(doc.markdown) ?? titleFromFileName(doc.name)
  await applyDocument({ markdown: doc.markdown, name: doc.name })
  if (!githubAccessToken() || !githubRepo()) {
    markDirty()
    showToast('Pick a repository to store this diagram on GitHub')
    if (isSignedIn()) showGate()
    return
  }
  try {
    await ensureDiagramIndex()
  } catch {
    // Cached names are enough for a best-effort warning.
  }
  const repo = githubRepo()
  if (conflictingName(title, cachedDiagramNames())) {
    showToast(`${fileNameFor(title)} already exists — updating that file`)
  }
  currentFile = await saveGithubDiagram({
    markdown: doc.markdown,
    title,
    overwrite: true,
  })
  bindFile(currentFile)
  rememberSavedDiagram(currentFile)
  markSaved()
  if (repo) showToast(`Saved to ${repo.owner}/${repo.name}`)
}

async function saveFile(): Promise<void> {
  autoSave.cancel()
  if (isSignedIn() && (!githubAccessToken() || !githubRepo())) {
    showGate()
    showToast(githubRepo() ? 'Sign in again to save to GitHub' : 'Pick a repository to save')
    return
  }
  if (githubAccessToken() && githubRepo()) {
    await saveToGithub(false)
    return
  }
  const title = diagramName.trim() || 'Untitled'
  const markdown = await serializeScene(cloneGraph(), { markdown: true, title })
  try {
    currentFile = await fileStorage.save({
      markdown,
      name: currentFile?.name ?? fileNameFor(title),
      handle: currentFile?.handle,
    })
    bindFile(currentFile)
    markSaved()
  } catch (err) {
    showToast(safeError(err))
  }
}

async function saveToGithub(quiet: boolean): Promise<boolean> {
  if (!githubAccessToken() || !githubRepo()) return false
  while (saveGate) await saveGate
  if (!githubAccessToken() || !githubRepo()) return false
  if (quiet && !dirty) return true
  const epoch = saveEpoch

  let release = (): void => undefined
  saveGate = new Promise((resolve) => {
    release = resolve
  })
  setSaving(true)
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (epoch !== saveEpoch) return false
      if (quiet && !dirty) return true
      const title = diagramName.trim() || 'Untitled'
      if (!currentFile?.github?.path) {
        try {
          await ensureDiagramIndex()
        } catch {
          // Use whatever names we already know; GitHub will still reject a clash.
        }
        if (conflictingName(title, cachedDiagramNames())) {
          if (!quiet) showToast(`${fileNameFor(title)} already exists`)
          return false
        }
      }
      const seq = editSeq
      const path = currentFile?.github?.path
      const sha = currentFile?.github?.sha
      const markdown = await serializeScene(cloneGraph(), { markdown: true, title })
      if (epoch !== saveEpoch) return false
      currentFile = await saveGithubDiagram({
        markdown,
        title,
        path,
        sha,
        overwrite: Boolean(path),
      })
      if (epoch !== saveEpoch) return false
      bindFile(currentFile)
      rememberSavedDiagram(currentFile)
      markSavedIf(seq)
      if (!dirty) return true
    }
    return !dirty
  } catch (err) {
    if (!quiet || !/already exists/i.test(safeError(err))) showToast(safeError(err))
    return false
  } finally {
    setSaving(false)
    saveGate = null
    release()
  }
}

function bindFile(doc: DocumentFile): void {
  currentFile = doc
  setFileName(doc.name)
  setGithubPath(doc.github?.path ?? null)
  if (doc.github?.path) setLastOpenedPath(doc.github.path)
}

function startBlankDiagram(): void {
  currentFile = null
  setFileName(null)
  setGithubPath(null)
  setDiagramName('Untitled')
  replaceGraph(emptyGraph(scene.diagramType), false)
  rebuildIndex()
  markSaved()
  fitAll()
  if (overlayOpen) void syncCode()
}

function syncToolForType(): void {
  const type = scene.diagramType
  if (isShapeTool(currentTool) && !PALETTE[type].includes(currentTool)) {
    setTool('select')
    return
  }
  if ((currentTool === 'alt' || currentTool === 'loop' || currentTool === 'opt') && type !== 'sequence') {
    setTool('select')
    return
  }
  if (currentTool === 'group' && type !== 'class' && type !== 'architecture') setTool('select')
}

async function restoreLastDiagram(): Promise<boolean> {
  const doc = await loadLastOpenedDiagram()
  if (!doc) return false
  await applyDocument(doc)
  return true
}

function stripDiagramsHash(): void {
  if (location.hash === '#diagrams' || location.hash === '#/diagrams') {
    history.replaceState(null, '', `${location.pathname}${location.search}`)
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /aborted|cancel/i.test(err.message))
}

function safeError(err: unknown): string {
  if (err instanceof Error && err.message && !/token|bearer|ghp_|gho_/i.test(err.message)) return err.message
  return 'Save failed'
}

function onGlobalKeys(e: KeyboardEvent): void {
  const typing = isTypingTarget(e.target) || overlayFocused
  const meta = e.metaKey || e.ctrlKey
  if (meta && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void saveFile()
    return
  }
  if (typing) return
  if (meta && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
    rebuildIndex()
    if (overlayOpen) void syncCode()
    return
  }
  if (meta && e.key.toLowerCase() === 'o') {
    e.preventDefault()
    openLibrary()
    return
  }
  if (meta && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    duplicateSelection()
    return
  }
  if (meta && e.key.toLowerCase() === 'v') {
    scheduleMemoryPaste()
    return
  }
  if ((e.key === '`' && !codeFocused()) || (meta && e.key.toLowerCase() === 'e')) {
    e.preventDefault()
    void onChrome('toggle-code')
  }
}

let pasteFromEvent = false

function scheduleMemoryPaste(): void {
  pasteFromEvent = false
  window.setTimeout(() => {
    if (pasteFromEvent) return
    const text = recalledClip()
    if (text) {
      void pasteClipboardText(text)
      return
    }
    const read = navigator.clipboard?.readText
    if (!read) return
    void read
      .call(navigator.clipboard)
      .then((value) => {
        if (value) void pasteClipboardText(value)
      })
      .catch(() => undefined)
  }, 0)
}

function onCopy(e: ClipboardEvent): void {
  if (isTypingTarget(e.target) || overlayFocused) return
  const text = selectionClipboardText()
  if (!text) return
  rememberClip(text)
  if (e.clipboardData) {
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
    return
  }
  void writeClipboardText(text)
}

function onCut(e: ClipboardEvent): void {
  if (isTypingTarget(e.target) || overlayFocused) return
  const text = selectionClipboardText()
  if (!text) return
  rememberClip(text)
  if (e.clipboardData) {
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
  } else {
    void writeClipboardText(text)
  }
  checkpoint()
  deleteSelected()
  rebuildIndex()
  if (overlayOpen) void syncCode()
}

function onPaste(e: ClipboardEvent): void {
  if (isTypingTarget(e.target) || overlayFocused) return
  const text = e.clipboardData?.getData('text/plain')
  if (!text) return
  pasteFromEvent = true
  rememberClip(text)
  e.preventDefault()
  void pasteClipboardText(text)
}

function selectionClipboardText(): string | null {
  const clip = sliceSelection(selectedIds, scene)
  if (!clip) return null
  return encodeClipboard(clip)
}

async function pasteClipboardText(text: string): Promise<void> {
  const clip = decodeClipboard(text)
  if (clip) {
    checkpoint()
    const ids = applyClipboard(convertGraph(clip, scene.diagramType))
    if (!ids.length) return
    setSelection(ids)
    markDirty()
    rebuildIndex()
    requestRender()
    if (overlayOpen) await syncCode()
    return
  }
  const result = await parseScene(text)
  if ('error' in result || result.graph.nodes.length + result.graph.groups.length === 0) return
  checkpoint()
  const ids = applyClipboard(result.graph)
  if (!ids.length) return
  setSelection(ids)
  markDirty()
  rebuildIndex()
  requestRender()
  if (overlayOpen) await syncCode()
}

function duplicateSelection(): void {
  const clip = sliceSelection(selectedIds, scene)
  if (!clip) return
  checkpoint()
  const created = applyClipboard(clip)
  if (!created.length) return
  setSelection(created)
  markDirty()
  rebuildIndex()
  requestRender()
}

mount()
