import {
  clearPlaceGhost,
  currentTool,
  isShapeTool,
  placeNodeAt,
  resetZoom,
  setPlaceGhostFromScreen,
  setTool,
} from '../canvas/pointer.ts'
import { strokeFor } from '../canvas/draw.ts'
import { worldToScreen } from '../canvas/camera.ts'
import {
  camera,
  classEditorId,
  currentRelation,
  diagramName,
  dirty,
  edgeById,
  githubPath,
  markDirty,
  nodeById,
  overlayOpen,
  saving,
  scene,
  selectedIds,
  setClassEditor,
  setDiagramName,
  setRelation,
  subscribeChrome,
  subscribeRender,
} from '../scene/scene.ts'
import { cachedDiagramNames, ensureDiagramIndex, githubStatus, hasDiagramIndex } from '../persist/github.ts'
import { conflictingName, fileNameFor } from '../persist/name.ts'
import { initLibrary, openLibrary } from './library.ts'
import { showGate } from './gate.ts'
import type { DocumentFile } from '../persist/file.ts'
import { checkpoint } from '../scene/history.ts'
import {
  emptyField,
  emptyMethod,
  joinParsed,
  parsedMembers,
  VISIBILITY,
  type ParsedField,
  type ParsedMethod,
} from '../scene/members.ts'
import {
  DIAGRAM_TYPES,
  KIND_DETAIL,
  KIND_LABEL,
  PALETTE,
  RELATION_PALETTE,
  CARDINALITIES,
  nodeHeight,
  type DiagramType,
  type NodeKind,
  type Tool,
} from '../scene/types.ts'
import { ICONS } from './icons.ts'
import { githubStarBadge } from './star.ts'
import { inspectorModel, inspectorTitle, inspectorVisible, nodePopOpen } from './inspector.ts'
import {
  setThemePreference,
  subscribeTheme,
  themePreference,
  type ThemePreference,
} from '../persist/theme.ts'

const RAIL_TOOLS: { id: Tool; icon: string; word: string; tip: string }[] = [
  { id: 'select', icon: ICONS.select, word: 'Move', tip: 'Move  V' },
  { id: 'hand', icon: ICONS.hand, word: 'Pan', tip: 'Pan  H' },
  { id: 'arrow', icon: ICONS.connect, word: 'Link', tip: 'Link  L' },
]

const TYPE_HINT: Record<DiagramType, { connect: string; place: string }> = {
  class: { connect: 'Drag from a type onto another — it snaps', place: 'Click the canvas to place' },
  sequence: { connect: 'Drag between lifelines — drop anywhere on the column', place: 'Click the canvas to place' },
  er: { connect: 'Drag to set cardinality', place: 'Click the canvas to place' },
  state: { connect: 'Drag a transition', place: 'Click the canvas to place' },
  activity: { connect: 'Drag a flow', place: 'Click the canvas to place' },
  architecture: { connect: 'Drag a call between services', place: 'Click the canvas to place' },
}

export type ChromeAction =
  | 'toggle-code'
  | 'copy'
  | 'copy-clean'
  | 'save'
  | 'duplicate'
  | 'delete'
  | 'new-file'
  | 'discard'
  | 'interrupt-save'
  | { kind: 'type'; value: DiagramType }
  | { kind: 'load'; doc: DocumentFile }
  | { kind: 'upload'; doc: DocumentFile }
  | { kind: 'bind'; doc: DocumentFile }

export function initChrome(onAction: (action: ChromeAction) => void | Promise<void>): void {
  const modes = must('modes')
  const actions = must('actions')
  const rail = must('rail')
  const inspector = must('inspector')
  const nodePop = must('node-pop')
  const zoom = must('zoom')
  const hint = must('hint')
  const codeHead = document.getElementById('code-head')
  const library = document.getElementById('library')
  if (library) {
    initLibrary(library, {
      load: (doc) => onAction({ kind: 'load', doc }),
      upload: (doc) => onAction({ kind: 'upload', doc }),
      newFile: () => onAction('new-file'),
      discard: () => Promise.resolve(onAction('discard')),
      interruptSave: () => Promise.resolve(onAction('interrupt-save')),
      bind: (doc) => onAction({ kind: 'bind', doc }),
    })
  }

  buildModes(modes)
  buildActions(actions, onAction)
  buildSidebar(rail, onAction)
  zoom.addEventListener('click', () => resetZoom())
  zoom.title = 'Reset to 100%'

  if (codeHead) {
    codeHead.innerHTML = ''
    const title = document.createElement('div')
    title.className = 'code-title'
    title.textContent = 'Mermaid'
    const row = document.createElement('div')
    row.className = 'code-actions'
    row.append(iconBtn(ICONS.copy, 'Copy', () => onAction('copy')))
    row.append(iconBtn(ICONS.copy, 'Clean copy', () => onAction('copy-clean')))
    row.append(iconBtn(ICONS.hide, 'Hide  `', () => onAction('toggle-code')))
    codeHead.append(title, row)
  }

  let lastType: DiagramType | null = null
  let lastSelection = ''

  const paint = (): void => {
    if (lastType !== scene.diagramType) {
      lastType = scene.diagramType
      renderTypeLists(rail)
    }

    syncTypeTrigger(rail)
    for (const b of rail.querySelectorAll<HTMLButtonElement>('.type-item')) {
      b.classList.toggle('active', b.dataset.type === scene.diagramType)
    }
    for (const b of rail.querySelectorAll<HTMLButtonElement>('.rail-btn, .shape-item')) {
      b.classList.toggle('active', b.dataset.tool === currentTool || b.dataset.kind === currentTool)
    }
    for (const b of rail.querySelectorAll<HTMLButtonElement>('.chip')) {
      b.classList.toggle('active', b.dataset.rel === currentRelation)
    }

    document.getElementById('code-btn')?.classList.toggle('active', overlayOpen)
    const nameInput = document.getElementById('diagram-name')
    if (nameInput instanceof HTMLInputElement && document.activeElement !== nameInput) {
      nameInput.value = diagramName
    }
    paintSaveStatus()
    const repoLabel = githubStatus()
    if (repoLabel !== 'Sign in to save' && repoLabel !== 'Pick a repo' && !hasDiagramIndex()) {
      void ensureDiagramIndex()
        .then(() => paintSaveStatus())
        .catch(() => undefined)
    }

    inspector.style.right = overlayOpen ? '424px' : '12px'

    const selKey = `${[...selectedIds].sort().join(',')}|${classEditorId ?? ''}`
    if (selKey !== lastSelection) {
      lastSelection = selKey
      renderInspector(inspector, onAction)
      renderNodePop(nodePop, onAction)
    }

    const model = inspectorModel(selectedIds, scene.nodes, scene.groups, scene.edges)
    const beside = nodePopOpen(model, classEditorId)
    nodePop.hidden = !beside
    inspector.hidden = beside || !inspectorVisible(model) || (model.mode === 'node' && model.memberEdit !== 'none')
    if (beside && model.mode === 'node') positionNodePop(nodePop, model.id)

    hint.textContent = hintText()
    hint.classList.toggle('visible', Boolean(hintText()))
    zoom.textContent = `${Math.round(camera().zoom * 100)}%`
  }

  nodePop.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    setClassEditor(null)
  })

  subscribeChrome(paint)
  subscribeRender(() => {
    zoom.textContent = `${Math.round(camera().zoom * 100)}%`
    const model = inspectorModel(selectedIds, scene.nodes, scene.groups, scene.edges)
    if (nodePopOpen(model, classEditorId) && model.mode === 'node') positionNodePop(nodePop, model.id)
  })
  subscribeTheme(() => {
    syncThemeControl()
    renderTypeLists(rail)
  })
  paint()
}

function buildModes(modes: HTMLElement): void {
  modes.innerHTML = ''
  modes.hidden = true
}

function buildActions(actions: HTMLElement, onAction: (action: ChromeAction) => void): void {
  actions.innerHTML = ''
  actions.className = 'panel actions'

  const name = document.createElement('input')
  name.id = 'diagram-name'
  name.className = 'diagram-name'
  name.type = 'text'
  name.placeholder = 'Untitled'
  name.spellcheck = false
  name.autocomplete = 'off'
  name.value = diagramName
  name.addEventListener('input', () => {
    setDiagramName(name.value.trim() ? name.value : 'Untitled')
    markDirty()
    paintSaveStatus()
  })
  name.addEventListener('change', () => {
    if (name.value.trim()) return
    setDiagramName('Untitled')
    name.value = 'Untitled'
    paintSaveStatus()
  })
  actions.append(name)

  const status = document.createElement('span')
  status.id = 'save-status'
  status.className = 'save-status'
  actions.append(status)

  const auth = document.createElement('button')
  auth.type = 'button'
  auth.id = 'auth-btn'
  auth.className = 'save-status-signin'
  auth.hidden = true
  auth.addEventListener('click', () => showGate())
  actions.append(auth)

  const create = textAction('New', 'New blank diagram', () => onAction('new-file'))
  create.id = 'new-btn'
  actions.append(create)
  const diagrams = textAction('Diagrams', 'Open diagrams  ⌘O', () => openLibrary())
  diagrams.id = 'diagrams-btn'
  actions.append(diagrams)
  const code = textAction('Code', 'Show Mermaid  `', () => onAction('toggle-code'))
  code.id = 'code-btn'
  actions.append(code)
}

let toastTimer = 0

function textAction(label: string, tip: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'text-action'
  b.textContent = label
  b.title = tip
  b.addEventListener('click', onClick)
  return b
}

function paintSaveStatus(): void {
  const status = document.getElementById('save-status')
  const auth = document.getElementById('auth-btn')
  const name = document.getElementById('diagram-name')
  if (!(status instanceof HTMLElement) || !(auth instanceof HTMLButtonElement) || !(name instanceof HTMLInputElement)) return
  const conflict = conflictingName(diagramName, cachedDiagramNames(), githubPath ?? undefined)
  const label = githubStatus()
  name.classList.toggle('conflict', Boolean(conflict))

  const needsAuth = label === 'Sign in to save' || label === 'Pick a repo'
  auth.hidden = !needsAuth
  status.hidden = needsAuth
  if (needsAuth) {
    if (auth.dataset.key !== label) {
      auth.dataset.key = label
      auth.replaceChildren()
      if (label === 'Sign in to save') {
        auth.insertAdjacentHTML('afterbegin', ICONS.github)
        const text = document.createElement('span')
        text.textContent = 'Sign in to save'
        auth.append(text)
      } else {
        auth.textContent = 'Pick a repo'
      }
    }
    name.title = 'Diagram name'
    return
  }

  status.classList.remove('error', 'busy')
  let text = 'Saved'
  if (conflict) {
    text = `${fileNameFor(diagramName)} already exists`
    status.classList.add('error')
    name.title = text
  } else {
    name.title = 'Diagram name'
    if (saving) {
      text = 'Saving…'
      status.classList.add('busy')
    } else if (dirty) {
      text = 'Unsaved'
    }
  }
  if (status.textContent !== text) status.textContent = text
}

export function showToast(text: string): void {
  const el = document.getElementById('toast')
  if (!el) return
  el.hidden = false
  el.textContent = text
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    el.hidden = true
  }, 4200)
}

function buildSidebar(rail: HTMLElement, onAction: (action: ChromeAction) => void): void {
  rail.innerHTML = ''
  rail.className = 'panel sidebar'
  const brand = document.createElement('div')
  brand.className = 'brand'
  brand.innerHTML = `<span class="brand-mark"></span><span class="brand-name">Drawmark</span>`
  brand.append(themePicker())
  rail.append(brand)
  rail.append(githubStarBadge())
  rail.append(sectionLabel('Diagram'))
  rail.append(typeDropdown(onAction))

  const body = document.createElement('div')
  body.className = 'side-body'
  rail.append(body)

  body.append(sectionLabel('Tools'))
  const tools = document.createElement('div')
  tools.className = 'tool-list'
  for (const t of RAIL_TOOLS) {
    tools.append(railBtn(t.icon, t.word, t.tip, () => setTool(t.id), t.id))
  }
  const extra = document.createElement('div')
  extra.id = 'rail-extra'
  extra.className = 'rail-extra'
  tools.append(extra)
  body.append(tools)

  body.append(sectionLabel('Add'))
  const shapes = document.createElement('div')
  shapes.id = 'side-shapes'
  shapes.className = 'shape-list'
  body.append(shapes)

  body.append(sectionLabel('Link'))
  const links = document.createElement('div')
  links.id = 'side-links'
  links.className = 'rel-list'
  body.append(links)
}

function typeDropdown(onAction: (action: ChromeAction) => void): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'type-wrap'
  wrap.id = 'side-types'

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'type-trigger'
  trigger.id = 'type-trigger'
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')

  const menu = document.createElement('div')
  menu.className = 'type-menu'
  menu.setAttribute('role', 'listbox')
  for (const t of DIAGRAM_TYPES) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'type-item'
    item.dataset.type = t.id
    item.setAttribute('role', 'option')
    item.innerHTML = `<span class="type-item-name">${t.label}</span><span class="type-item-detail">${t.detail}</span>`
    item.addEventListener('click', () => {
      closeTypeMenu(wrap)
      if (t.id === scene.diagramType) return
      onAction({ kind: 'type', value: t.id })
    })
    menu.append(item)
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleTypeMenu(wrap)
  })
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target as Node)) closeTypeMenu(wrap)
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTypeMenu(wrap)
  })

  wrap.append(trigger, menu)
  return wrap
}

function toggleTypeMenu(wrap: HTMLElement): void {
  if (wrap.classList.contains('open')) closeTypeMenu(wrap)
  else openTypeMenu(wrap)
}

function openTypeMenu(wrap: HTMLElement): void {
  wrap.classList.add('open')
  wrap.querySelector('#type-trigger')?.setAttribute('aria-expanded', 'true')
}

function closeTypeMenu(wrap: HTMLElement): void {
  wrap.classList.remove('open')
  wrap.querySelector('#type-trigger')?.setAttribute('aria-expanded', 'false')
}

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: keyof typeof ICONS }[] = [
  { id: 'system', label: 'System', icon: 'themeSystem' },
  { id: 'light', label: 'Light', icon: 'themeLight' },
  { id: 'dark', label: 'Dark', icon: 'themeDark' },
]

function themeIcon(pref: ThemePreference): string {
  const option = THEME_OPTIONS.find((item) => item.id === pref) ?? THEME_OPTIONS[0]!
  return ICONS[option.icon]
}

function themePicker(): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'theme-wrap'
  wrap.id = 'theme-wrap'

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'theme-btn'
  trigger.id = 'theme-btn'
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.title = 'Theme'
  trigger.innerHTML = themeIcon(themePreference())

  const menu = document.createElement('div')
  menu.className = 'theme-menu'
  menu.setAttribute('role', 'listbox')
  for (const option of THEME_OPTIONS) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'theme-item'
    item.dataset.theme = option.id
    item.setAttribute('role', 'option')
    item.innerHTML = `${ICONS[option.icon]}<span>${option.label}</span>`
    item.classList.toggle('active', option.id === themePreference())
    item.addEventListener('click', () => {
      closeThemeMenu(wrap)
      setThemePreference(option.id)
    })
    menu.append(item)
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    if (wrap.classList.contains('open')) closeThemeMenu(wrap)
    else {
      wrap.classList.add('open')
      trigger.setAttribute('aria-expanded', 'true')
    }
  })
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target as Node)) closeThemeMenu(wrap)
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeThemeMenu(wrap)
  })

  wrap.append(trigger, menu)
  return wrap
}

function closeThemeMenu(wrap: HTMLElement): void {
  wrap.classList.remove('open')
  wrap.querySelector('#theme-btn')?.setAttribute('aria-expanded', 'false')
}

function syncThemeControl(): void {
  const pref = themePreference()
  const trigger = document.getElementById('theme-btn')
  if (trigger) {
    trigger.innerHTML = themeIcon(pref)
    trigger.title = `Theme: ${pref[0]!.toUpperCase()}${pref.slice(1)}`
  }
  for (const item of document.querySelectorAll<HTMLButtonElement>('.theme-item')) {
    item.classList.toggle('active', item.dataset.theme === pref)
  }
}

function syncTypeTrigger(rail: HTMLElement): void {
  const trigger = rail.querySelector('#type-trigger')
  if (!trigger) return
  const t = DIAGRAM_TYPES.find((d) => d.id === scene.diagramType)
  trigger.innerHTML = `<span class="type-trigger-name">${t?.label ?? 'Class'}</span><span class="type-trigger-detail">${t?.detail ?? ''}</span>`
}

function renderTypeLists(rail: HTMLElement): void {
  const extra = rail.querySelector('#rail-extra')
  if (extra) {
    extra.innerHTML = ''
    if (scene.diagramType === 'sequence') {
      extra.append(railBtn(ICONS.frame, 'If', 'If frame', () => setTool('alt'), 'alt'))
      extra.append(railBtn(ICONS.loop, 'Repeat', 'Repeat', () => setTool('loop'), 'loop'))
      extra.append(railBtn(ICONS.opt, 'Optional', 'Optional', () => setTool('opt'), 'opt'))
    } else if (scene.diagramType === 'architecture' || scene.diagramType === 'class') {
      extra.append(railBtn(ICONS.group, scene.diagramType === 'class' ? 'Package' : 'Group', scene.diagramType === 'class' ? 'Package  G' : 'Group  G', () => setTool('group'), 'group'))
    }
    extra.classList.toggle('empty', extra.childElementCount === 0)
  }

  const shapes = rail.querySelector('#side-shapes')
  if (shapes) {
    shapes.innerHTML = ''
    for (const kind of PALETTE[scene.diagramType]) {
      shapes.append(shapeItem(kind))
    }
  }

  const links = rail.querySelector('#side-links')
  if (links) {
    links.innerHTML = ''
    for (const r of RELATION_PALETTE[scene.diagramType]) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chip'
      b.dataset.rel = r.id
      b.textContent = r.label
      b.addEventListener('click', () => {
        setRelation(r.id)
        setTool('arrow')
      })
      links.append(b)
    }
  }
}

function shapeItem(kind: NodeKind): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'shape-item'
  b.dataset.kind = kind
  const thumb = document.createElement('span')
  thumb.className = 'thumb'
  thumb.style.borderColor = strokeFor(kind)
  const copy = document.createElement('span')
  copy.className = 'shape-copy'
  const name = document.createElement('span')
  name.className = 'shape-item-name'
  name.textContent = KIND_LABEL[kind]
  const detail = document.createElement('span')
  detail.className = 'shape-item-detail'
  detail.textContent = KIND_DETAIL[kind]
  copy.append(name, detail)
  b.append(thumb, copy)
  let suppressClick = false
  b.addEventListener('click', (e) => {
    if (suppressClick) {
      e.preventDefault()
      suppressClick = false
      return
    }
    setTool(kind)
  })
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    b.setPointerCapture(e.pointerId)
    const sx = e.clientX
    const sy = e.clientY
    let dragged = false
    const onMove = (ev: PointerEvent): void => {
      if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
        dragged = true
        suppressClick = true
        setTool(kind)
      }
      if (dragged) setPlaceGhostFromScreen(ev.clientX, ev.clientY, kind)
    }
    const onUp = (ev: PointerEvent): void => {
      b.removeEventListener('pointermove', onMove)
      b.removeEventListener('pointerup', onUp)
      clearPlaceGhost()
      if (dragged) {
        const top = document.elementFromPoint(ev.clientX, ev.clientY)
        if (top?.id === 'overlay' || top?.id === 'world') placeNodeAt(kind, ev.clientX, ev.clientY)
        else setTool('select')
      }
    }
    b.addEventListener('pointermove', onMove)
    b.addEventListener('pointerup', onUp)
  })
  return b
}

function renderInspector(el: HTMLElement, onAction: (action: ChromeAction) => void): void {
  const model = inspectorModel(selectedIds, scene.nodes, scene.groups, scene.edges)
  el.innerHTML = ''
  el.className = 'panel inspector'
  if (!inspectorVisible(model)) return

  const title = document.createElement('div')
  title.className = 'insp-title'
  title.textContent = inspectorTitle(model)
  el.append(title)

  if (model.mode === 'multi') {
    const hint = document.createElement('div')
    hint.className = 'insp-hint'
    hint.textContent = 'Shift-click to add or remove'
    el.append(hint)
    el.append(inspectorActions(onAction, true))
    return
  }
  if (model.mode === 'hidden') return

  if (model.mode === 'node' && model.memberEdit !== 'none') return

  if (model.mode === 'node') {
    el.append(fieldLabel('Name'))
    const name = document.createElement('input')
    name.type = 'text'
    name.id = 'insp-name'
    name.className = 'insp-input'
    name.value = model.label
    name.placeholder = 'Name'
    name.addEventListener('focus', () => checkpoint())
    name.addEventListener('input', () => {
      const n = nodeById(model.id)
      if (!n) return
      n.label = name.value
      markDirty()
    })
    name.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const first = el.querySelector<HTMLInputElement>('.member-row input')
      if (first) first.focus()
    })
    el.append(name)
    if (model.memberEdit === 'class') el.append(classMembers(model.id, model.fields, model.methods))
    else if (model.memberEdit === 'enum') el.append(simpleMembers(model.id, 'Values', model.fields.concat(model.methods)))
    else if (model.memberEdit === 'entity') el.append(simpleMembers(model.id, 'Attributes', model.fields.concat(model.methods)))
  }

  if (model.mode === 'edge') {
    const rels = RELATION_PALETTE[scene.diagramType]
    const list = document.createElement('div')
    list.className = 'insp-chips'
    for (const r of rels) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chip'
      b.textContent = r.label
      b.classList.toggle('active', r.id === model.relation)
      b.addEventListener('click', () => {
        const edge = edgeById(model.id)
        if (!edge) return
        checkpoint()
        edge.relation = r.id
        setRelation(r.id)
        markDirty()
        b.parentElement?.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b))
      })
      list.append(b)
    }
    el.append(fieldLabel('Relation'), list)
  }

  if (model.mode === 'edge' && scene.diagramType === 'class') {
    el.append(fieldLabel('From'), cardRow(model.id, 'fromCard', model.fromCard))
    el.append(fieldLabel('To'), cardRow(model.id, 'toCard', model.toCard))
  }

  if (model.mode === 'edge') {
    el.append(fieldLabel('Label'))
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'insp-input'
    input.value = model.label
    input.placeholder = 'Optional'
    input.addEventListener('focus', () => checkpoint())
    input.addEventListener('input', () => {
      const edge = edgeById(model.id)
      if (edge) {
        edge.label = input.value
        markDirty()
      }
    })
    el.append(input)
  }

  const hint = document.createElement('div')
  hint.className = 'insp-hint'
  if (model.mode === 'node' && model.memberEdit !== 'none') {
    hint.textContent = 'Enter moves to the next field'
  } else if (model.mode === 'node') hint.textContent = 'Click again or press Enter to type on the shape'
  else if (model.mode === 'edge') hint.textContent = 'Click a shape if you want to move it'
  else hint.textContent = 'Drag to move'
  el.append(hint)
  el.append(inspectorActions(onAction, model.mode !== 'edge'))
}

function renderNodePop(el: HTMLElement, _onAction: (action: ChromeAction) => void): void {
  const model = inspectorModel(selectedIds, scene.nodes, scene.groups, scene.edges)
  el.innerHTML = ''
  el.className = 'panel node-pop'
  if (!nodePopOpen(model, classEditorId) || model.mode !== 'node') return

  const head = document.createElement('div')
  head.className = 'pop-head'
  const name = document.createElement('input')
  name.type = 'text'
  name.id = 'insp-name'
  name.className = 'insp-input pop-name'
  name.value = model.label
  name.placeholder = 'Name'
  name.addEventListener('focus', () => checkpoint())
  name.addEventListener('input', () => {
    const n = nodeById(model.id)
    if (!n) return
    n.label = name.value
    markDirty()
  })
  name.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    el.querySelector<HTMLInputElement>('.member-row input')?.focus()
  })
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'member-x'
  close.textContent = '×'
  close.title = 'Close'
  close.addEventListener('click', () => setClassEditor(null))
  head.append(name, close)
  el.append(head)
  if (model.memberEdit === 'class') el.append(classMembers(model.id, model.fields, model.methods))
  else if (model.memberEdit === 'enum') el.append(simpleMembers(model.id, 'Values', model.fields.concat(model.methods)))
  else if (model.memberEdit === 'entity') el.append(simpleMembers(model.id, 'Attributes', model.fields.concat(model.methods)))
}

function positionNodePop(el: HTMLElement, nodeId: string): void {
  const node = nodeById(nodeId)
  if (!node || el.hidden) return
  const cam = camera()
  const topLeft = worldToScreen(cam, node.x + node.w, node.y)
  const gap = 12
  const width = el.offsetWidth || 320
  const height = el.offsetHeight || 240
  let left = topLeft.x + gap
  let top = topLeft.y
  if (left + width > window.innerWidth - 12) {
    const leftSide = worldToScreen(cam, node.x, node.y)
    left = leftSide.x - width - gap
  }
  left = Math.max(268, Math.min(left, window.innerWidth - width - 12))
  top = Math.max(12, Math.min(top, window.innerHeight - Math.min(height, window.innerHeight - 24) - 12))
  el.style.left = `${Math.round(left)}px`
  el.style.top = `${Math.round(top)}px`
}

function classMembers(nodeId: string, fieldLines: string[], methodLines: string[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'member-editor'
  const parsed = parsedMembers([...fieldLines, ...methodLines])
  const fields = document.createElement('div')
  fields.className = 'member-list'
  fields.dataset.list = 'fields'
  for (const f of parsed.fields) fields.append(fieldRow(nodeId, f))
  wrap.append(
    sectionAdd('Fields', 'Add field', () => {
      const row = fieldRow(nodeId, emptyField())
      fields.append(row)
      row.querySelector<HTMLInputElement>('[data-nav="name"]')?.focus()
    }),
    fields,
  )
  const methods = document.createElement('div')
  methods.className = 'member-list'
  methods.dataset.list = 'methods'
  for (const m of parsed.methods) methods.append(methodRow(nodeId, m))
  wrap.append(
    sectionAdd('Methods', 'Add method', () => {
      const row = methodRow(nodeId, emptyMethod())
      methods.append(row)
      row.querySelector<HTMLInputElement>('[data-nav="name"]')?.focus()
    }),
    methods,
  )
  wrap.addEventListener('input', () => writeMembers(nodeId, wrap))
  wrap.addEventListener('change', () => writeMembers(nodeId, wrap))
  return wrap
}

function simpleMembers(nodeId: string, label: string, lines: string[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'member-editor'
  const list = document.createElement('div')
  list.className = 'member-list'
  const rows = lines.map((line) => parsedMembers([line]).fields[0] ?? { ...emptyField(), name: line })
  for (const f of rows) list.append(nameRow(nodeId, f))
  wrap.append(
    sectionAdd(label, 'Add', () => {
      const row = nameRow(nodeId, emptyField())
      list.append(row)
      row.querySelector<HTMLInputElement>('input')?.focus()
    }),
    list,
  )
  wrap.addEventListener('input', () => writeMembers(nodeId, wrap))
  return wrap
}

function fieldRow(nodeId: string, field: ParsedField): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'member-row'
  row.dataset.kind = 'field'
  row.append(
    visSelect(field.visibility),
    miniInput('name', field.name, 'name'),
    miniInput('type', field.type, 'type'),
    flagBtn(nodeId, row, 'static', field.isStatic, 'Static'),
    removeBtn(row, nodeId),
  )
  bindEnter(row, nodeId, ['name', 'type'])
  return row
}

function methodRow(nodeId: string, method: ParsedMethod): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'member-row method'
  row.dataset.kind = 'method'
  row.append(
    visSelect(method.visibility),
    miniInput('name', method.name, 'name'),
    miniInput('params', method.params, 'args'),
    miniInput('returns', method.returns, 'returns'),
    flagBtn(nodeId, row, 'static', method.isStatic, 'Static'),
    flagBtn(nodeId, row, 'abstract', method.isAbstract, 'Abstract'),
    removeBtn(row, nodeId),
  )
  bindEnter(row, nodeId, ['name', 'params', 'returns'])
  return row
}

function nameRow(nodeId: string, field: ParsedField): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'member-row'
  row.dataset.kind = 'field'
  row.append(miniInput('name', field.name, 'name'), removeBtn(row, nodeId))
  bindEnter(row, nodeId, ['name'])
  return row
}

function visSelect(value: ParsedField['visibility']): HTMLSelectElement {
  const sel = document.createElement('select')
  sel.className = 'insp-select'
  for (const v of VISIBILITY) {
    const opt = document.createElement('option')
    opt.value = v.id
    opt.textContent = v.label
    sel.append(opt)
  }
  sel.value = value
  sel.title = 'Visibility'
  return sel
}

function miniInput(nav: string, value: string, placeholder: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'insp-input mini'
  input.dataset.nav = nav
  input.value = value
  input.placeholder = placeholder
  input.spellcheck = false
  input.addEventListener('focus', () => checkpoint())
  return input
}

function flagBtn(nodeId: string, row: HTMLElement, flag: string, on: boolean, label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'flag-chip'
  b.dataset.flag = flag
  b.classList.toggle('active', on)
  b.textContent = label
  b.addEventListener('click', () => {
    b.classList.toggle('active')
    const editor = row.closest('.member-editor')
    if (editor) writeMembers(nodeId, editor)
  })
  return b
}

function removeBtn(row: HTMLDivElement, nodeId: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'member-x'
  b.textContent = '×'
  b.title = 'Remove'
  b.addEventListener('click', () => {
    const editor = row.closest('.member-editor')
    row.remove()
    if (editor) writeMembers(nodeId, editor)
  })
  return b
}

function sectionAdd(label: string, title: string, onClick: () => void): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'insp-section'
  row.append(fieldLabel(label))
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'member-add-inline'
  b.textContent = '+'
  b.title = title
  b.addEventListener('click', onClick)
  row.append(b)
  return row
}

function bindEnter(row: HTMLDivElement, nodeId: string, order: string[]): void {
  row.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const nav = (e.target as HTMLElement).dataset.nav
    if (!nav) return
    e.preventDefault()
    const nextNav = order[order.indexOf(nav) + 1]
    if (nextNav) {
      row.querySelector<HTMLInputElement>(`[data-nav="${nextNav}"]`)?.focus()
      return
    }
    const list = row.parentElement
    if (!list) return
    const sibling = row.nextElementSibling?.querySelector<HTMLInputElement>('[data-nav="name"]')
    if (sibling) {
      sibling.focus()
      return
    }
    const extra =
      order.length === 1
        ? nameRow(nodeId, emptyField())
        : row.dataset.kind === 'method'
          ? methodRow(nodeId, emptyMethod())
          : fieldRow(nodeId, emptyField())
    list.append(extra)
    extra.querySelector<HTMLInputElement>('[data-nav="name"]')?.focus()
  })
}

function writeMembers(nodeId: string, editor: Element): void {
  const n = nodeById(nodeId)
  if (!n) return
  const fields: ParsedField[] = []
  const methods: ParsedMethod[] = []
  for (const row of editor.querySelectorAll<HTMLDivElement>('.member-row')) {
    const vis = (row.querySelector('select')?.value as ParsedField['visibility'] | undefined) ?? 'public'
    const name = val(row, 'name')
    if (row.dataset.kind === 'method') {
      methods.push({
        kind: 'method',
        visibility: vis,
        isStatic: Boolean(row.querySelector('[data-flag="static"]')?.classList.contains('active')),
        isAbstract: Boolean(row.querySelector('[data-flag="abstract"]')?.classList.contains('active')),
        name,
        params: val(row, 'params'),
        returns: val(row, 'returns'),
      })
    } else {
      fields.push({
        kind: 'field',
        visibility: vis,
        isStatic: Boolean(row.querySelector('[data-flag="static"]')?.classList.contains('active')),
        name,
        type: val(row, 'type'),
      })
    }
  }
  n.members = joinParsed(fields, methods)
  n.h = nodeHeight(n)
  markDirty()
}

function val(row: HTMLElement, nav: string): string {
  return row.querySelector<HTMLInputElement>(`[data-nav="${nav}"]`)?.value.trim() ?? ''
}

function cardRow(edgeId: string, end: 'fromCard' | 'toCard', current?: string): HTMLDivElement {
  const list = document.createElement('div')
  list.className = 'insp-chips'
  for (const card of CARDINALITIES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = card
    b.classList.toggle('active', card === current)
    b.addEventListener('click', () => {
      const edge = edgeById(edgeId)
      if (!edge) return
      checkpoint()
      edge[end] = edge[end] === card ? undefined : card
      list.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b && edge[end] === card))
      markDirty()
    })
    list.append(b)
  }
  return list
}

function inspectorActions(onAction: (action: ChromeAction) => void, duplicate: boolean): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'insp-actions'
  if (duplicate) {
    const dup = document.createElement('button')
    dup.type = 'button'
    dup.className = 'insp-btn'
    dup.textContent = 'Duplicate'
    dup.addEventListener('click', () => onAction('duplicate'))
    row.append(dup)
  }
  const del = document.createElement('button')
  del.type = 'button'
  del.className = 'insp-btn danger'
  del.textContent = 'Delete'
  del.addEventListener('click', () => onAction('delete'))
  row.append(del)
  return row
}

function fieldLabel(text: string): HTMLDivElement {
  const d = document.createElement('div')
  d.className = 'insp-label'
  d.textContent = text
  return d
}

function sectionLabel(text: string): HTMLDivElement {
  const d = document.createElement('div')
  d.className = 'section-label'
  d.textContent = text
  return d
}

function hintText(): string {
  if (currentTool === 'arrow') return TYPE_HINT[scene.diagramType].connect
  if (currentTool === 'alt' || currentTool === 'loop' || currentTool === 'opt' || currentTool === 'group') {
    return 'Drag on the canvas to draw a frame'
  }
  if (isShapeTool(currentTool)) return `${TYPE_HINT[scene.diagramType].place} ${KIND_LABEL[currentTool].toLowerCase()}`
  if (selectedIds.size) {
    return scene.diagramType === 'class'
      ? classEditorId
        ? 'Enter goes to the next field · Esc closes'
        : 'Double-click a class to edit · Drag to move'
      : 'Click again or press Enter to type · Drag to move'
  }
  if (scene.nodes.length) return 'Click a shape to select it · Drag empty canvas to select several'
  return ''
}

function railBtn(icon: string, word: string, tip: string, onClick: () => void, tool: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'rail-btn'
  b.title = tip
  b.dataset.tool = tool
  b.innerHTML = icon
  const lab = document.createElement('span')
  lab.textContent = word
  b.append(lab)
  b.addEventListener('click', onClick)
  return b
}

function iconBtn(icon: string, tip: string, onClick: () => void, tool?: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'icon-btn'
  b.dataset.tooltip = tip
  b.title = tip
  if (tool) b.dataset.tool = tool
  b.innerHTML = icon
  b.addEventListener('click', onClick)
  return b
}

function must(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} missing`)
  return el
}
