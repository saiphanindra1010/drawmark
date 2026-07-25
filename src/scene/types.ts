export type DiagramType = 'class' | 'sequence' | 'er' | 'state' | 'activity' | 'architecture'

export type NodeKind =
  | 'service'
  | 'api'
  | 'database'
  | 'cache'
  | 'queue'
  | 'client'
  | 'loadBalancer'
  | 'store'
  | 'class'
  | 'interface'
  | 'abstract'
  | 'enum'
  | 'actor'
  | 'participant'
  | 'entity'
  | 'state'
  | 'stateStart'
  | 'stateEnd'
  | 'stateChoice'
  | 'activityStart'
  | 'action'
  | 'decision'
  | 'activityEnd'

export type EdgeRelation =
  | 'extends'
  | 'implements'
  | 'composes'
  | 'aggregates'
  | 'assoc'
  | 'depends'
  | 'sync'
  | 'reply'
  | 'oneToOne'
  | 'oneToMany'
  | 'zeroToMany'
  | 'manyToMany'
  | 'transition'

export type GroupKind = 'group' | 'alt' | 'loop' | 'opt'

export type Tool = 'select' | 'hand' | 'arrow' | GroupKind | NodeKind

export type Camera = {
  x: number
  y: number
  zoom: number
}

export type DiagramNode = {
  id: string
  kind: NodeKind
  label: string
  x: number
  y: number
  w: number
  h: number
  members?: string[]
  stereotype?: string
}

export type DiagramEdge = {
  id: string
  from: string
  to: string
  label: string
  relation?: EdgeRelation
  y?: number
  fromCard?: string
  toCard?: string
}

export type DiagramGroup = {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  kind?: GroupKind
}

export type SceneGraph = {
  diagramType: DiagramType
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  groups: DiagramGroup[]
}

export type Scene = SceneGraph & {
  camera: Camera
}

export const DIAGRAM_TYPES: { id: DiagramType; label: string; detail: string }[] = [
  { id: 'class', label: 'Class', detail: 'Types, fields, and methods' },
  { id: 'sequence', label: 'Sequence', detail: 'Who calls whom, in order' },
  { id: 'er', label: 'ER', detail: 'Entities and how they relate' },
  { id: 'state', label: 'State', detail: 'How something changes over time' },
  { id: 'activity', label: 'Activity', detail: 'Steps in a process' },
  { id: 'architecture', label: 'Architecture', detail: 'Services and data stores' },
]

export const NODE_SIZES: Record<NodeKind, { w: number; h: number }> = {
  service: { w: 200, h: 56 },
  api: { w: 200, h: 56 },
  database: { w: 152, h: 88 },
  cache: { w: 148, h: 72 },
  queue: { w: 188, h: 56 },
  client: { w: 140, h: 72 },
  loadBalancer: { w: 168, h: 72 },
  store: { w: 152, h: 80 },
  class: { w: 220, h: 128 },
  interface: { w: 220, h: 128 },
  abstract: { w: 220, h: 128 },
  enum: { w: 200, h: 112 },
  actor: { w: 120, h: 56 },
  participant: { w: 148, h: 48 },
  entity: { w: 220, h: 128 },
  state: { w: 168, h: 56 },
  stateStart: { w: 28, h: 28 },
  stateEnd: { w: 32, h: 32 },
  stateChoice: { w: 52, h: 52 },
  activityStart: { w: 96, h: 40 },
  action: { w: 180, h: 48 },
  decision: { w: 148, h: 80 },
  activityEnd: { w: 96, h: 40 },
}

export const KIND_LABEL: Record<NodeKind, string> = {
  service: 'Service',
  api: 'API',
  database: 'Database',
  cache: 'Cache',
  queue: 'Queue',
  client: 'Client',
  loadBalancer: 'Load balancer',
  store: 'Object store',
  class: 'Class',
  interface: 'Interface',
  abstract: 'Abstract class',
  enum: 'Enum',
  actor: 'Person',
  participant: 'System',
  entity: 'Entity',
  state: 'State',
  stateStart: 'Start',
  stateEnd: 'End',
  stateChoice: 'Branch',
  activityStart: 'Start',
  action: 'Action',
  decision: 'Decision',
  activityEnd: 'End',
}

export const KIND_DETAIL: Record<NodeKind, string> = {
  service: 'A running service',
  api: 'An HTTP or RPC API',
  database: 'A database',
  cache: 'A cache',
  queue: 'A message queue',
  client: 'A user or app',
  loadBalancer: 'Spreads traffic',
  store: 'Files or blobs',
  class: 'Name, fields, methods',
  interface: 'A contract types implement',
  abstract: 'A base type others extend',
  enum: 'A fixed set of values',
  actor: 'A person in the flow',
  participant: 'A service or component',
  entity: 'A table with attributes',
  state: 'A condition it can be in',
  stateStart: 'Where it begins',
  stateEnd: 'Where it stops',
  stateChoice: 'A fork in the path',
  activityStart: 'Where the flow begins',
  action: 'A step that does work',
  decision: 'A yes / no fork',
  activityEnd: 'Where the flow stops',
}

export function isSequenceLayout(nodes: { kind: NodeKind }[]): boolean {
  return nodes.length > 0 && nodes.every((node) => node.kind === 'actor' || node.kind === 'participant')
}

export const PALETTE: Record<DiagramType, NodeKind[]> = {
  class: ['class', 'interface', 'abstract', 'enum'],
  sequence: ['actor', 'participant'],
  er: ['entity'],
  state: ['state', 'stateStart', 'stateEnd', 'stateChoice'],
  activity: ['activityStart', 'action', 'decision', 'activityEnd'],
  architecture: ['client', 'api', 'service', 'loadBalancer', 'database', 'cache', 'queue', 'store'],
}

export const RELATION_PALETTE: Record<DiagramType, { id: EdgeRelation; label: string }[]> = {
  class: [
    { id: 'extends', label: 'Extends' },
    { id: 'implements', label: 'Implements' },
    { id: 'composes', label: 'Contains' },
    { id: 'aggregates', label: 'Has many' },
    { id: 'assoc', label: 'Related' },
    { id: 'depends', label: 'Uses' },
  ],
  sequence: [
    { id: 'sync', label: 'Call' },
    { id: 'reply', label: 'Reply' },
  ],
  er: [
    { id: 'oneToOne', label: 'One to one' },
    { id: 'oneToMany', label: 'One to many' },
    { id: 'zeroToMany', label: 'Zero to many' },
    { id: 'manyToMany', label: 'Many to many' },
  ],
  state: [{ id: 'transition', label: 'Goes to' }],
  activity: [{ id: 'assoc', label: 'Next' }],
  architecture: [{ id: 'assoc', label: 'Calls' }],
}

export const DEFAULT_RELATION: Record<DiagramType, EdgeRelation> = {
  class: 'assoc',
  sequence: 'sync',
  er: 'oneToMany',
  state: 'transition',
  activity: 'assoc',
  architecture: 'assoc',
}

export const CARDINALITIES = ['1', '0..1', '*'] as const

export const COMPARTMENT_KINDS: NodeKind[] = ['class', 'interface', 'abstract', 'enum', 'entity']

export function nodeHeight(node: DiagramNode): number {
  if (!COMPARTMENT_KINDS.includes(node.kind)) return node.h
  const members = node.members ?? []
  const rows = Math.max(1, members.length)
  const classLike = node.kind === 'class' || node.kind === 'interface' || node.kind === 'abstract'
  const split =
    classLike && members.some((m) => m.includes('(')) && members.some((m) => !m.includes('('))
  return 40 + rows * 18 + 12 + (split ? 10 : 0)
}
