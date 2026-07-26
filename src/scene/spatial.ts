import RBush from 'rbush'
import { scene } from './scene.ts'

type HitItem = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
  kind: 'node' | 'group'
}

const tree = new RBush<HitItem>()

export function rebuildIndex(): void {
  tree.clear()
  const items: HitItem[] = []
  for (const g of scene.groups) {
    items.push({
      minX: g.x,
      minY: g.y,
      maxX: g.x + g.w,
      maxY: g.y + g.h,
      id: g.id,
      kind: 'group',
    })
  }
  for (const n of scene.nodes) {
    items.push({
      minX: n.x,
      minY: n.y,
      maxX: n.x + n.w,
      maxY: n.y + n.h,
      id: n.id,
      kind: 'node',
    })
  }
  if (items.length) tree.load(items)
}

export function hitsAt(x: number, y: number): HitItem[] {
  return tree.search({ minX: x, minY: y, maxX: x, maxY: y })
}

export function hitsIn(minX: number, minY: number, maxX: number, maxY: number): HitItem[] {
  return tree.search({ minX, minY, maxX, maxY })
}
