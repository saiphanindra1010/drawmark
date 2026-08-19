import { memberEditFor, splitMembers, type MemberEdit } from '../scene/members.ts'
import { KIND_LABEL, type DiagramEdge, type DiagramGroup, type DiagramNode, type EdgeRelation } from '../scene/types.ts'

export type InspectorModel =
  | { mode: 'hidden' }
  | { mode: 'multi'; count: number }
  | {
      mode: 'node'
      id: string
      label: string
      kindLabel: string
      hasMembers: boolean
      memberEdit: MemberEdit
      fields: string[]
      methods: string[]
    }
  | { mode: 'group'; id: string; label: string }
  | { mode: 'edge'; id: string; label: string; relation: EdgeRelation; fromCard?: string; toCard?: string }

export function inspectorVisible(model: InspectorModel): boolean {
  return model.mode !== 'hidden'
}

export function nodePopOpen(model: InspectorModel, editorId: string | null): boolean {
  return Boolean(editorId && model.mode === 'node' && model.id === editorId && model.memberEdit !== 'none')
}

export function inspectorTitle(model: InspectorModel): string {
  if (model.mode === 'node') return model.kindLabel
  if (model.mode === 'group') return model.label || 'Package'
  if (model.mode === 'edge') return 'Connection'
  if (model.mode === 'multi') return `${model.count} selected`
  return ''
}

export function inspectorModel(
  selected: Iterable<string>,
  nodes: DiagramNode[],
  groups: DiagramGroup[],
  edges: DiagramEdge[],
): InspectorModel {
  const ids = [...selected]
  if (ids.length === 0) return { mode: 'hidden' }
  if (ids.length > 1) return { mode: 'multi', count: ids.length }
  const id = ids[0]
  if (!id) return { mode: 'hidden' }
  const node = nodes.find((n) => n.id === id)
  if (node) {
    const memberEdit = memberEditFor(node.kind)
    const split = splitMembers(node.members ?? [])
    return {
      mode: 'node',
      id,
      label: node.label,
      kindLabel: KIND_LABEL[node.kind],
      hasMembers: memberEdit !== 'none',
      memberEdit,
      fields: split.fields,
      methods: split.methods,
    }
  }
  const group = groups.find((g) => g.id === id)
  if (group) return { mode: 'group', id, label: group.label }
  const edge = edges.find((e) => e.id === id)
  if (edge) {
    return {
      mode: 'edge',
      id,
      label: edge.label,
      relation: edge.relation ?? 'assoc',
      fromCard: edge.fromCard,
      toCard: edge.toCard,
    }
  }
  return { mode: 'hidden' }
}
