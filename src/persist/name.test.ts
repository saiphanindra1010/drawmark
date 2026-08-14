import { describe, expect, it } from 'vitest'
import { copyName, conflictingName, fileNameFor, replaceMarkdownTitle, slugify, titleFromFileName, titleFromMarkdown, uniqueName } from './name.ts'

describe('slugify', () => {
  it('turns a diagram name into a file slug', () => {
    expect(slugify('Order Service')).toBe('order-service')
    expect(slugify('  Payments / Checkout  ')).toBe('payments-checkout')
  })

  it('falls back when the name is empty', () => {
    expect(slugify('   ')).toBe('untitled')
    expect(fileNameFor('Order Service')).toBe('order-service.md')
  })
})

describe('titleFromMarkdown', () => {
  it('reads the first heading', () => {
    expect(titleFromMarkdown('# Order service\n\n```mermaid\nclassDiagram\n```\n')).toBe('Order service')
  })

  it('returns null when there is no heading', () => {
    expect(titleFromMarkdown('```mermaid\nclassDiagram\n```')).toBeNull()
  })
})

describe('titleFromFileName', () => {
  it('humanizes a markdown file name', () => {
    expect(titleFromFileName('order-service.md')).toBe('order service')
  })
})

describe('uniqueName', () => {
  it('keeps the base when the slug is free', () => {
    expect(uniqueName('Order Service', ['payments'])).toBe('Order Service')
  })

  it('adds a number when the slug is taken', () => {
    expect(uniqueName('Untitled', ['untitled', 'untitled-2'])).toBe('Untitled 3')
  })
})

describe('copyName', () => {
  it('appends copy when the original slug exists', () => {
    expect(copyName('Order service', ['order-service'])).toBe('Order service copy')
  })

  it('numbers further copies', () => {
    expect(copyName('Order service', ['order-service', 'order-service-copy'])).toBe('Order service copy 2')
  })
})

describe('conflictingName', () => {
  it('warns when another diagram already uses the slug', () => {
    expect(conflictingName('Order Service', ['order-service', 'payments'])).toBe('order-service')
  })

  it('ignores the file currently being edited', () => {
    expect(conflictingName('Order Service', ['order-service'], 'mermade/order-service.md')).toBeNull()
  })

  it('treats headings and file names as the same slug', () => {
    expect(conflictingName('order service', ['Order-Service'])).toBe('Order-Service')
  })
})

describe('replaceMarkdownTitle', () => {
  it('replaces the first heading', () => {
    expect(replaceMarkdownTitle('# Old\n\n```mermaid\nclassDiagram\n```\n', 'New')).toBe(
      '# New\n\n```mermaid\nclassDiagram\n```\n',
    )
  })

  it('inserts a heading when none exists', () => {
    expect(replaceMarkdownTitle('```mermaid\nclassDiagram\n```\n', 'New')).toBe(
      '# New\n\n```mermaid\nclassDiagram\n```\n',
    )
  })
})
