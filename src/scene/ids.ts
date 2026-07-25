let seq = 1

export function nextId(prefix: string): string {
  seq += 1
  return `${prefix}${seq}`
}

export function resetIds(start = 1): void {
  seq = start
}
