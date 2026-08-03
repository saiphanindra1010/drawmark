import { worldToScreen } from './camera.ts'
import { checkpoint } from '../scene/history.ts'
import { applyNodeText, camera, groupById, markDirty, nodeById, requestRender, setClassEditor } from '../scene/scene.ts'
import { COMPARTMENT_KINDS, nodeHeight, type DiagramGroup, type DiagramNode } from '../scene/types.ts'

let input: HTMLTextAreaElement | null = null
let editing: { kind: 'node' | 'group'; id: string } | null = null
let snapshot: { label: string; members?: string[] } | null = null
let onCommit: ((id: string, kind: 'node' | 'group', value: string) => void) | null = null

export function initTextOverlay(
  el: HTMLTextAreaElement,
  commit: (id: string, kind: 'node' | 'group', value: string) => void,
): void {
  input = el
  onCommit = commit
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      finish(false)
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      finish(true)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !isCompartmentEdit()) {
      e.preventDefault()
      finish(true)
    }
  })
  el.addEventListener('input', () => liveApply())
  el.addEventListener('blur', () => finish(true))
}

export function isEditing(): boolean {
  return editing !== null
}

export function editingId(): string | null {
  return editing?.id ?? null
}

export function startEdit(target: DiagramNode | DiagramGroup, kind: 'node' | 'group'): void {
  if (kind === 'node' && COMPARTMENT_KINDS.includes((target as DiagramNode).kind)) {
    setClassEditor(target.id)
    const focusName = (): void => {
      document.getElementById('insp-name')?.focus()
    }
    window.addEventListener('pointerup', focusName, { once: true })
    window.setTimeout(focusName, 0)
    return
  }
  if (!input) return
  editing = { kind, id: target.id }
  snapshot =
    kind === 'node' && 'members' in target
      ? { label: target.label, members: target.members ? [...target.members] : undefined }
      : { label: target.label }
  checkpoint()
  if (kind === 'node') {
    const node = target as DiagramNode
    if (COMPARTMENT_KINDS.includes(node.kind)) {
      input.value = [node.label, ...(node.members ?? [])].join('\n')
      input.classList.add('compartment')
    } else {
      input.value = node.label
      input.classList.remove('compartment')
    }
  } else {
    input.value = target.label
    input.classList.remove('compartment')
  }
  input.hidden = false
  position(target, isCompartmentEdit())
  input.focus()
  const breakAt = input.value.indexOf('\n')
  if (breakAt === -1) input.select()
  else input.setSelectionRange(0, breakAt)
  requestRender()
}

export function layoutEdit(target: DiagramNode | DiagramGroup): void {
  if (!editing || editing.id !== target.id) return
  position(target, isCompartmentEdit())
}

function isCompartmentEdit(): boolean {
  if (!editing || editing.kind !== 'node') return false
  const node = nodeById(editing.id)
  return Boolean(node && COMPARTMENT_KINDS.includes(node.kind))
}

function liveApply(): void {
  if (!editing || !input) return
  if (editing.kind === 'node') {
    const n = nodeById(editing.id)
    if (n) {
      applyNodeText(n, input.value)
      layoutEdit(n)
    }
  } else {
    const g = groupById(editing.id)
    if (g) {
      g.label = input.value.split('\n')[0] ?? g.label
    }
  }
  markDirty()
}

function position(target: DiagramNode | DiagramGroup, tall = false): void {
  if (!input) return
  const cam = camera()
  const p = worldToScreen(cam, target.x, target.y)
  input.style.left = `${p.x}px`
  input.style.top = `${p.y}px`
  input.style.width = `${Math.max(80, target.w * cam.zoom)}px`
  const h = tall ? Math.max(target.h * cam.zoom, 72) : Math.max(target.h * cam.zoom, 28)
  input.style.height = `${h}px`
  input.style.fontSize = `${Math.max(12, 13 * cam.zoom)}px`
}

function finish(commit: boolean): void {
  if (!editing || !input) return
  const current = editing
  const value = input.value
  editing = null
  input.hidden = true
  input.classList.remove('compartment')
  if (!commit && snapshot) {
    restore(current.id, current.kind, snapshot)
    snapshot = null
    markDirty()
    return
  }
  snapshot = null
  if (onCommit) onCommit(current.id, current.kind, value)
  requestRender()
}

function restore(id: string, kind: 'node' | 'group', original: { label: string; members?: string[] }): void {
  if (kind === 'node') {
    const n = nodeById(id)
    if (!n) return
    n.label = original.label
    n.members = original.members ? [...original.members] : original.members
    n.h = nodeHeight(n)
    return
  }
  const g = groupById(id)
  if (g) g.label = original.label
}
