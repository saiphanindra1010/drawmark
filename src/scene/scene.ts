import { nextId } from './ids.ts'
import {
  COMPARTMENT_KINDS,
  DEFAULT_RELATION,
  KIND_LABEL,
  NODE_SIZES,
  nodeHeight,
  type Camera,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type DiagramType,
  type EdgeRelation,
  type GroupKind,
  type NodeKind,
  type Scene,
  type SceneGraph,
} from './types.ts'

export type SceneListener = () => void

const chromeListeners = new Set<SceneListener>()
const renderListeners = new Set<SceneListener>()
let dirtyHandler: SceneListener | null = null

export const scene: Scene = {
  diagramType: 'class',
  nodes: [],
  edges: [],
  groups: [],
  camera: { x: 0, y: 0, zoom: 1 },
}

export let selectedIds = new Set<string>()
export let classEditorId: string | null = null
export let dirty = false
export let editSeq = 0
export let overlayOpen = false
export let overlayFocused = false
export let fileName: string | null = null
export let githubPath: string | null = null
export let diagramName = 'Untitled'
export let saving = false
export let currentRelation: EdgeRelation = DEFAULT_RELATION.class

let renderScheduled = false

export function subscribeChrome(fn: SceneListener): () => void {
  chromeListeners.add(fn)
  return () => chromeListeners.delete(fn)
}

export function subscribeRender(fn: SceneListener): () => void {
  renderListeners.add(fn)
  return () => renderListeners.delete(fn)
}

export function notifyChrome(): void {
  for (const fn of chromeListeners) fn()
}

export function setDirtyHandler(fn: SceneListener | null): void {
  dirtyHandler = fn
}

export function markDirty(): void {
  dirty = true
  editSeq += 1
  requestRender()
  notifyChrome()
  dirtyHandler?.()
}

export function markSaved(): void {
  dirty = false
  notifyChrome()
}

export function markSavedIf(seq: number): boolean {
  if (editSeq !== seq) return false
  markSaved()
  return true
}

export function setOverlayOpen(open: boolean): void {
  overlayOpen = open
  notifyChrome()
}

export function setOverlayFocused(focused: boolean): void {
  overlayFocused = focused
}

export function setFileName(name: string | null): void {
  fileName = name
  notifyChrome()
}

export function setGithubPath(path: string | null): void {
  githubPath = path
  notifyChrome()
}

export function setDiagramName(name: string): void {
  diagramName = name
  notifyChrome()
}

export function setSaving(on: boolean): void {
  saving = on
  notifyChrome()
}

export function setRelation(relation: EdgeRelation): void {
  currentRelation = relation
  notifyChrome()
}

export function setDiagramType(type: DiagramType): void {
  if (scene.diagramType === type) return
  scene.diagramType = type
  currentRelation = DEFAULT_RELATION[type]
  dirty = true
  editSeq += 1
  notifyChrome()
  dirtyHandler?.()
}

export function requestRender(): void {
  if (renderScheduled) return
  renderScheduled = true
  requestAnimationFrame(() => {
    renderScheduled = false
    for (const fn of renderListeners) fn()
  })
}

export function replaceGraph(graph: SceneGraph, keepCamera: boolean): void {
  scene.diagramType = graph.diagramType
  scene.nodes = graph.nodes
  scene.edges = graph.edges
  scene.groups = graph.groups
  currentRelation = DEFAULT_RELATION[graph.diagramType]
  if (!keepCamera && 'camera' in graph) {
    const next = graph as Scene
    if (next.camera) scene.camera = next.camera
  }
  selectedIds = new Set()
  classEditorId = null
  markDirty()
  notifyChrome()
}

export function cloneGraph(): SceneGraph {
  return {
    diagramType: scene.diagramType,
    nodes: scene.nodes.map((n) => ({ ...n, members: n.members ? [...n.members] : undefined })),
    edges: scene.edges.map((e) => ({ ...e })),
    groups: scene.groups.map((g) => ({ ...g })),
  }
}

export function nodeById(id: string): DiagramNode | undefined {
  return scene.nodes.find((n) => n.id === id)
}

export function groupById(id: string): DiagramGroup | undefined {
  return scene.groups.find((g) => g.id === id)
}

export function edgeById(id: string): DiagramEdge | undefined {
  return scene.edges.find((e) => e.id === id)
}

export function addNode(kind: NodeKind, x: number, y: number, label?: string): DiagramNode {
  const size = NODE_SIZES[kind]
  const node: DiagramNode = {
    id: nextId('n'),
    kind,
    label: label ?? KIND_LABEL[kind],
    x,
    y,
    w: size.w,
    h: size.h,
    members: defaultMembers(kind),
    stereotype: defaultStereotype(kind),
  }
  node.h = nodeHeight(node)
  scene.nodes.push(node)
  return node
}

export function addEdge(from: string, to: string, label = '', y?: number): DiagramEdge | null {
  if (from === to) return null
  if (scene.diagramType !== 'sequence') {
    const existing = scene.edges.find((e) => e.from === from && e.to === to)
    if (existing) {
      existing.relation = currentRelation
      if (label) existing.label = label
      if (y !== undefined) existing.y = y
      return existing
    }
  }
  const edge: DiagramEdge = {
    id: nextId('e'),
    from,
    to,
    label,
    relation: currentRelation,
    y,
  }
  scene.edges.push(edge)
  return edge
}

export function addGroup(x: number, y: number, w: number, h: number, kind: GroupKind = 'group'): DiagramGroup {
  const group: DiagramGroup = {
    id: nextId('g'),
    label: kind === 'group' ? (scene.diagramType === 'class' ? 'Package' : 'Group') : kind,
    x,
    y,
    w: Math.max(160, w),
    h: Math.max(120, h),
    kind,
  }
  scene.groups.push(group)
  return group
}

export function deleteSelected(): void {
  if (selectedIds.size === 0) return
  scene.nodes = scene.nodes.filter((n) => !selectedIds.has(n.id))
  scene.groups = scene.groups.filter((g) => !selectedIds.has(g.id))
  scene.edges = scene.edges.filter(
    (e) => !selectedIds.has(e.id) && !selectedIds.has(e.from) && !selectedIds.has(e.to),
  )
  selectedIds = new Set()
  classEditorId = null
  markDirty()
  notifyChrome()
}

export function setClassEditor(id: string | null): void {
  classEditorId = id
  notifyChrome()
}

export function setSelection(ids: Iterable<string>): void {
  selectedIds = new Set(ids)
  if (classEditorId && !selectedIds.has(classEditorId)) classEditorId = null
  notifyChrome()
  requestRender()
}

export function camera(): Camera {
  return scene.camera
}

export function applyNodeText(node: DiagramNode, value: string): void {
  const lines = value.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  if (!lines.length) return
  node.label = lines[0] ?? node.label
  if (COMPARTMENT_KINDS.includes(node.kind)) {
    node.members = lines.slice(1)
    node.h = nodeHeight(node)
  }
}

function defaultMembers(kind: NodeKind): string[] | undefined {
  if (kind === 'class' || kind === 'abstract' || kind === 'interface' || kind === 'enum' || kind === 'entity') {
    return []
  }
  return undefined
}

function defaultStereotype(kind: NodeKind): string | undefined {
  if (kind === 'interface') return 'interface'
  if (kind === 'abstract') return 'abstract'
  if (kind === 'enum') return 'enumeration'
  return undefined
}
