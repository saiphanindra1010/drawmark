import {
  DEFAULT_RELATION,
  NODE_SIZES,
  PALETTE,
  RELATION_PALETTE,
  nodeHeight,
  type DiagramEdge,
  type DiagramGroup,
  type DiagramNode,
  type DiagramType,
  type EdgeRelation,
  type GroupKind,
  type NodeKind,
  type SceneGraph,
} from './types.ts'

const DEFAULT_KIND: Record<DiagramType, NodeKind> = {
  class: 'class',
  sequence: 'participant',
  er: 'entity',
  state: 'state',
  activity: 'action',
  architecture: 'service',
}

export function convertGraph(graph: SceneGraph, to: DiagramType): SceneGraph {
  if (graph.diagramType === to) {
    return {
      diagramType: to,
      nodes: graph.nodes.map(cloneNode),
      edges: graph.edges.map(cloneEdge),
      groups: graph.groups.map(cloneGroup),
    }
  }
  const nodes = graph.nodes.map((node) => convertNode(node, to))
  const edges = graph.edges.map((edge, index) => convertEdge(edge, to, index))
  const groups = graph.groups.map((group) => convertGroup(group, to))
  if (to === 'sequence') layoutSequence(nodes, edges)
  return { diagramType: to, nodes, edges, groups }
}

function convertNode(node: DiagramNode, to: DiagramType): DiagramNode {
  const kind = convertKind(node.kind, to)
  const size = NODE_SIZES[kind]
  const next: DiagramNode = {
    ...cloneNode(node),
    kind,
    w: size.w,
    h: size.h,
  }
  if (kind === 'interface') next.stereotype = 'interface'
  else if (kind === 'abstract') next.stereotype = 'abstract'
  else if (kind === 'enum') next.stereotype = 'enumeration'
  else if (kind !== 'class' && kind !== 'entity') delete next.stereotype
  next.h = nodeHeight(next)
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  next.x = cx - next.w / 2
  next.y = cy - next.h / 2
  return next
}

export function convertKind(kind: NodeKind, to: DiagramType): NodeKind {
  if (PALETTE[to].includes(kind)) return kind
  if (to === 'sequence') return kind === 'actor' || kind === 'client' ? 'actor' : 'participant'
  if (to === 'er') return 'entity'
  if (to === 'class') {
    if (kind === 'interface') return 'interface'
    if (kind === 'abstract') return 'abstract'
    if (kind === 'enum') return 'enum'
    return 'class'
  }
  if (to === 'state') {
    if (kind === 'activityStart' || kind === 'stateStart') return 'stateStart'
    if (kind === 'activityEnd' || kind === 'stateEnd') return 'stateEnd'
    if (kind === 'decision' || kind === 'stateChoice' || kind === 'loadBalancer') return 'stateChoice'
    return 'state'
  }
  if (to === 'activity') {
    if (kind === 'stateStart' || kind === 'activityStart') return 'activityStart'
    if (kind === 'stateEnd' || kind === 'activityEnd') return 'activityEnd'
    if (kind === 'decision' || kind === 'stateChoice' || kind === 'loadBalancer') return 'decision'
    return 'action'
  }
  if (kind === 'actor' || kind === 'participant' || kind === 'client') return 'client'
  if (kind === 'database' || kind === 'entity') return 'database'
  if (kind === 'enum' || kind === 'store') return 'store'
  if (kind === 'queue') return 'queue'
  if (kind === 'cache') return 'cache'
  if (kind === 'api') return 'api'
  if (kind === 'loadBalancer') return 'loadBalancer'
  return DEFAULT_KIND[to]
}

function convertEdge(edge: DiagramEdge, to: DiagramType, index: number): DiagramEdge {
  const next = cloneEdge(edge)
  next.relation = convertRelation(edge.relation, to)
  if (to !== 'class' && to !== 'er') {
    delete next.fromCard
    delete next.toCard
  }
  if (to === 'sequence' && next.y === undefined) next.y = 140 + index * 56
  return next
}

export function convertRelation(relation: EdgeRelation | undefined, to: DiagramType): EdgeRelation {
  const allowed = RELATION_PALETTE[to].map((item) => item.id)
  if (relation && allowed.includes(relation)) return relation
  if (to === 'class') {
    if (relation === 'sync') return 'assoc'
    if (relation === 'transition') return 'assoc'
  }
  if (to === 'er' && (relation === 'composes' || relation === 'aggregates')) return 'oneToMany'
  return DEFAULT_RELATION[to]
}

function convertGroup(group: DiagramGroup, to: DiagramType): DiagramGroup {
  const next = cloneGroup(group)
  next.kind = convertGroupKind(group.kind, to)
  if (to === 'class' && next.kind === 'group' && (!next.label || next.label === 'Group' || next.label === 'alt')) {
    next.label = next.label === 'alt' ? 'Package' : next.label
  }
  return next
}

function convertGroupKind(kind: GroupKind | undefined, to: DiagramType): GroupKind {
  if (to === 'sequence') {
    if (kind === 'loop' || kind === 'opt' || kind === 'alt') return kind
    return 'alt'
  }
  return 'group'
}

function layoutSequence(nodes: DiagramNode[], edges: DiagramEdge[]): void {
  const ordered = [...nodes].sort((a, b) => a.x - b.x)
  let x = 80
  for (const node of ordered) {
    node.y = 40
    node.x = x
    x += node.w + 48
  }
  edges.forEach((edge, index) => {
    edge.y = 140 + index * 56
  })
}

function cloneNode(node: DiagramNode): DiagramNode {
  return { ...node, members: node.members ? [...node.members] : undefined }
}

function cloneEdge(edge: DiagramEdge): DiagramEdge {
  return { ...edge }
}

function cloneGroup(group: DiagramGroup): DiagramGroup {
  return { ...group }
}
