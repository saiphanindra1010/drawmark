const FALLBACK = 'untitled'

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || FALLBACK
}

export function fileNameFor(name: string): string {
  return `${slugify(name)}.md`
}

export function uniqueName(base: string, taken: Iterable<string>): string {
  const slugs = new Set([...taken].map(slugify))
  const stem = base.trim() || 'Untitled'
  if (!slugs.has(slugify(stem))) return stem
  let n = 2
  while (slugs.has(slugify(`${stem} ${n}`))) n += 1
  return `${stem} ${n}`
}

export function copyName(base: string, taken: Iterable<string>): string {
  const stem = base.replace(/\s+copy(?:\s+\d+)?$/i, '').trim() || 'Untitled'
  return uniqueName(`${stem} copy`, taken)
}

export function pathSlug(path: string): string {
  return slugify(path.replace(/^.*\//, '').replace(/\.(md|mmd|markdown)$/i, ''))
}

export function conflictingName(title: string, taken: Iterable<string>, currentPath?: string): string | null {
  const slug = slugify(title)
  const current = currentPath ? pathSlug(currentPath) : ''
  if (current && slug === current) return null
  for (const name of taken) {
    if (slugify(name) === slug) return name
  }
  return null
}

export function titleFromMarkdown(markdown: string): string | null {
  const line = markdown.split('\n').find((l) => l.trim().length > 0)
  if (!line) return null
  const heading = /^#\s+(.+)$/.exec(line.trim())
  if (heading?.[1]) return heading[1].trim()
  return null
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.(md|mmd|markdown)$/i, '').replace(/[-_]/g, ' ').trim() || 'Untitled'
}

export function replaceMarkdownTitle(markdown: string, title: string): string {
  const heading = `# ${title}`
  const lines = markdown.split('\n')
  const index = lines.findIndex((line) => /^#\s+/.test(line.trim()))
  if (index >= 0) {
    lines[index] = heading
    return lines.join('\n')
  }
  if (!markdown.trim()) return `${heading}\n`
  return `${heading}\n\n${markdown}`
}
