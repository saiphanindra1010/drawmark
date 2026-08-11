import type { NodeKind } from './types.ts'

export type MemberEdit = 'class' | 'enum' | 'entity' | 'none'

export type Visibility = 'public' | 'private' | 'protected' | 'package'

export const VISIBILITY: { id: Visibility; mark: string; label: string }[] = [
  { id: 'public', mark: '+', label: 'Public' },
  { id: 'private', mark: '-', label: 'Private' },
  { id: 'protected', mark: '#', label: 'Protected' },
  { id: 'package', mark: '~', label: 'Internal' },
]

export type ParsedField = {
  kind: 'field'
  visibility: Visibility
  isStatic: boolean
  name: string
  type: string
}

export type ParsedMethod = {
  kind: 'method'
  visibility: Visibility
  isStatic: boolean
  isAbstract: boolean
  name: string
  params: string
  returns: string
}

export type ParsedMember = ParsedField | ParsedMethod

const VIS_MARK: Record<Visibility, string> = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~',
}

const MARK_VIS: Record<string, Visibility> = {
  '+': 'public',
  '-': 'private',
  '#': 'protected',
  '~': 'package',
}

export function isMethodMember(line: string): boolean {
  return parseMember(line).kind === 'method'
}

export function parseMember(line: string): ParsedMember {
  let s = line.trim()
  let visibility: Visibility = 'public'
  const first = s[0]
  if (first && MARK_VIS[first] && (s.length === 1 || s[1] !== first)) {
    visibility = MARK_VIS[first]
    s = s.slice(1).trim()
  }
  let isStatic = false
  let isAbstract = false
  while (s.endsWith('$') || s.endsWith('*')) {
    if (s.endsWith('$')) isStatic = true
    else isAbstract = true
    s = s.slice(0, -1).trim()
  }
  const method = /^([^(:]+?)\((.*)\)(?:\s*:\s*(.*))?$/.exec(s)
  if (method) {
    return {
      kind: 'method',
      visibility,
      isStatic,
      isAbstract,
      name: (method[1] ?? '').trim(),
      params: (method[2] ?? '').trim(),
      returns: (method[3] ?? '').trim(),
    }
  }
  const colon = s.indexOf(':')
  if (colon >= 0) {
    return {
      kind: 'field',
      visibility,
      isStatic,
      name: s.slice(0, colon).trim(),
      type: s.slice(colon + 1).trim(),
    }
  }
  return { kind: 'field', visibility, isStatic, name: s, type: '' }
}

export function formatMember(member: ParsedMember): string {
  if (!member.name.trim()) return ''
  const vis = VIS_MARK[member.visibility]
  const flags = `${member.isStatic ? '$' : ''}${member.kind === 'method' && member.isAbstract ? '*' : ''}`
  if (member.kind === 'method') {
    const ret = member.returns.trim() ? `: ${member.returns.trim()}` : ''
    return `${vis}${member.name.trim()}(${member.params.trim()})${ret}${flags}`
  }
  const typ = member.type.trim() ? `: ${member.type.trim()}` : ''
  return `${vis}${member.name.trim()}${typ}${flags}`
}

export function splitMembers(members: string[]): { fields: string[]; methods: string[] } {
  const fields: string[] = []
  const methods: string[] = []
  for (const m of members) {
    if (parseMember(m).kind === 'method') methods.push(m)
    else fields.push(m)
  }
  return { fields, methods }
}

export function parsedMembers(members: string[]): { fields: ParsedField[]; methods: ParsedMethod[] } {
  const fields: ParsedField[] = []
  const methods: ParsedMethod[] = []
  for (const m of members) {
    const parsed = parseMember(m)
    if (parsed.kind === 'method') methods.push(parsed)
    else fields.push(parsed)
  }
  return { fields, methods }
}

export function joinParsed(fields: ParsedField[], methods: ParsedMethod[]): string[] {
  return [...fields, ...methods].map(formatMember).filter((line) => line.length > 0)
}

export function joinMembers(fields: string[], methods: string[]): string[] {
  return [...fields, ...methods].map((line) => line.trim()).filter((line) => line.length > 0)
}

export function parseMemberLines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
}

export function memberEditFor(kind: NodeKind): MemberEdit {
  if (kind === 'class' || kind === 'interface' || kind === 'abstract') return 'class'
  if (kind === 'enum') return 'enum'
  if (kind === 'entity') return 'entity'
  return 'none'
}

export function emptyField(): ParsedField {
  return { kind: 'field', visibility: 'public', isStatic: false, name: '', type: '' }
}

export function emptyMethod(): ParsedMethod {
  return {
    kind: 'method',
    visibility: 'public',
    isStatic: false,
    isAbstract: false,
    name: '',
    params: '',
    returns: '',
  }
}

export function hasMemberSplit(kind: NodeKind, members: string[]): boolean {
  if (memberEditFor(kind) !== 'class') return false
  const { fields, methods } = splitMembers(members)
  return fields.length > 0 && methods.length > 0
}
