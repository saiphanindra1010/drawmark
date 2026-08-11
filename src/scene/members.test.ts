import { describe, expect, it } from 'vitest'
import {
  formatMember,
  hasMemberSplit,
  joinMembers,
  joinParsed,
  memberEditFor,
  parseMember,
  parseMemberLines,
  parsedMembers,
  splitMembers,
} from './members.ts'

describe('class members', () => {
  it('splits fields from methods by parentheses', () => {
    expect(splitMembers(['+id: string', '+place(cmd)', '-repo: Repo'])).toEqual({
      fields: ['+id: string', '-repo: Repo'],
      methods: ['+place(cmd)'],
    })
  })

  it('joins fields then methods', () => {
    expect(joinMembers(['+id: string', ''], ['+place()', '  '])).toEqual(['+id: string', '+place()'])
  })

  it('parses one member per line', () => {
    expect(parseMemberLines('+id: string\n\n+place()\n')).toEqual(['+id: string', '+place()'])
  })

  it('uses Fields/Methods for classes and Attributes for entities', () => {
    expect(memberEditFor('class')).toBe('class')
    expect(memberEditFor('interface')).toBe('class')
    expect(memberEditFor('enum')).toBe('enum')
    expect(memberEditFor('entity')).toBe('entity')
    expect(memberEditFor('actor')).toBe('none')
  })

  it('only splits the class box when both fields and methods exist', () => {
    expect(hasMemberSplit('class', ['+id: string', '+run()'])).toBe(true)
    expect(hasMemberSplit('class', ['+run()'])).toBe(false)
    expect(hasMemberSplit('enum', ['A', 'B()'])).toBe(false)
  })

  it('parses visibility, type, params, and classifiers', () => {
    expect(parseMember('+id: string')).toEqual({
      kind: 'field',
      visibility: 'public',
      isStatic: false,
      name: 'id',
      type: 'string',
    })
    expect(parseMember('-repo: OrderRepo')).toMatchObject({ visibility: 'private', name: 'repo', type: 'OrderRepo' })
    expect(parseMember('#ok(): boolean$')).toMatchObject({
      kind: 'method',
      visibility: 'protected',
      isStatic: true,
      name: 'ok',
      returns: 'boolean',
    })
    expect(parseMember('+place(cmd)*')).toMatchObject({ kind: 'method', isAbstract: true, params: 'cmd' })
  })

  it('formats back to Mermaid member lines', () => {
    expect(
      formatMember({ kind: 'field', visibility: 'private', isStatic: false, name: 'id', type: 'string' }),
    ).toBe('-id: string')
    expect(
      formatMember({
        kind: 'method',
        visibility: 'public',
        isStatic: true,
        isAbstract: false,
        name: 'count',
        params: '',
        returns: 'number',
      }),
    ).toBe('+count(): number$')
  })

  it('drops empty names when joining parsed members', () => {
    expect(
      joinParsed(
        [{ kind: 'field', visibility: 'public', isStatic: false, name: '', type: 'string' }],
        [{ kind: 'method', visibility: 'public', isStatic: false, isAbstract: false, name: 'run', params: '', returns: '' }],
      ),
    ).toEqual(['+run()'])
  })

  it('round-trips parsed demo members', () => {
    const lines = ['-repo: OrderRepo', '+place(cmd)']
    const { fields, methods } = parsedMembers(lines)
    expect(joinParsed(fields, methods)).toEqual(lines)
  })
})
