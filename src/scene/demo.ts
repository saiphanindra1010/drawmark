import { resetIds } from './ids.ts'
import type { SceneGraph } from './types.ts'
import type { DiagramType } from './types.ts'

export function emptyGraph(type: DiagramType = 'class'): SceneGraph {
  return { diagramType: type, nodes: [], edges: [], groups: [] }
}

export function demoGraph(type: DiagramType = 'class'): SceneGraph {
  resetIds(40)
  switch (type) {
    case 'class':
      return classDemo()
    case 'sequence':
      return sequenceDemo()
    case 'er':
      return erDemo()
    case 'state':
      return stateDemo()
    case 'activity':
      return activityDemo()
    case 'architecture':
      return architectureDemo()
    default: {
      const _never: never = type
      return _never
    }
  }
}

function classDemo(): SceneGraph {
  return {
    diagramType: 'class',
    nodes: [
      {
        id: 'n1',
        kind: 'class',
        label: 'OrderService',
        x: 80,
        y: 80,
        w: 220,
        h: 128,
        members: ['-repo: OrderRepo', '+place(cmd)'],
      },
      {
        id: 'n2',
        kind: 'class',
        label: 'OrderRepo',
        x: 420,
        y: 80,
        w: 220,
        h: 128,
        members: ['+save(order)', '+find(id)'],
      },
      {
        id: 'n3',
        kind: 'class',
        label: 'Order',
        x: 420,
        y: 280,
        w: 220,
        h: 128,
        members: ['+id: string', '+items: Item[]'],
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: '', relation: 'assoc' },
      { id: 'e2', from: 'n2', to: 'n3', label: '', relation: 'composes' },
    ],
    groups: [],
  }
}

function sequenceDemo(): SceneGraph {
  return {
    diagramType: 'sequence',
    nodes: [
      { id: 'n1', kind: 'actor', label: 'Client', x: 80, y: 40, w: 120, h: 56 },
      { id: 'n2', kind: 'participant', label: 'API', x: 300, y: 40, w: 148, h: 48 },
      { id: 'n3', kind: 'participant', label: 'OrderService', x: 540, y: 40, w: 148, h: 48 },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: 'POST /orders', relation: 'sync', y: 140 },
      { id: 'e2', from: 'n2', to: 'n3', label: 'place()', relation: 'sync', y: 200 },
      { id: 'e3', from: 'n3', to: 'n2', label: '201', relation: 'reply', y: 260 },
    ],
    groups: [],
  }
}

function erDemo(): SceneGraph {
  return {
    diagramType: 'er',
    nodes: [
      { id: 'n1', kind: 'entity', label: 'ORDER', x: 80, y: 80, w: 220, h: 128, members: ['id PK', 'user_id'] },
      { id: 'n2', kind: 'entity', label: 'ORDER_ITEM', x: 420, y: 80, w: 220, h: 128, members: ['id PK', 'order_id', 'sku'] },
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', label: 'contains', relation: 'oneToMany' }],
    groups: [],
  }
}

function stateDemo(): SceneGraph {
  return {
    diagramType: 'state',
    nodes: [
      { id: 'n1', kind: 'stateStart', label: '', x: 80, y: 120, w: 28, h: 28 },
      { id: 'n2', kind: 'state', label: 'Draft', x: 180, y: 104, w: 168, h: 56 },
      { id: 'n3', kind: 'state', label: 'Placed', x: 420, y: 104, w: 168, h: 56 },
      { id: 'n4', kind: 'stateEnd', label: '', x: 680, y: 118, w: 32, h: 32 },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: '', relation: 'transition' },
      { id: 'e2', from: 'n2', to: 'n3', label: 'place', relation: 'transition' },
      { id: 'e3', from: 'n3', to: 'n4', label: 'complete', relation: 'transition' },
    ],
    groups: [],
  }
}

function activityDemo(): SceneGraph {
  return {
    diagramType: 'activity',
    nodes: [
      { id: 'n1', kind: 'activityStart', label: 'Start', x: 200, y: 40, w: 96, h: 40 },
      { id: 'n2', kind: 'action', label: 'Place order', x: 160, y: 120, w: 180, h: 48 },
      { id: 'n3', kind: 'decision', label: 'Valid?', x: 176, y: 210, w: 148, h: 80 },
      { id: 'n4', kind: 'action', label: 'Persist', x: 160, y: 330, w: 180, h: 48 },
      { id: 'n5', kind: 'activityEnd', label: 'End', x: 200, y: 420, w: 96, h: 40 },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: '', relation: 'assoc' },
      { id: 'e2', from: 'n2', to: 'n3', label: '', relation: 'assoc' },
      { id: 'e3', from: 'n3', to: 'n4', label: 'yes', relation: 'assoc' },
      { id: 'e4', from: 'n4', to: 'n5', label: '', relation: 'assoc' },
    ],
    groups: [],
  }
}

function architectureDemo(): SceneGraph {
  return {
    diagramType: 'architecture',
    nodes: [
      { id: 'n1', kind: 'client', label: 'Client', x: 80, y: 220, w: 140, h: 72 },
      { id: 'n2', kind: 'api', label: 'API Gateway', x: 360, y: 220, w: 200, h: 56 },
      { id: 'n3', kind: 'service', label: 'Order Service', x: 680, y: 140, w: 200, h: 56 },
      { id: 'n4', kind: 'service', label: 'Payment Service', x: 680, y: 280, w: 200, h: 56 },
      { id: 'n5', kind: 'database', label: 'Postgres', x: 1000, y: 120, w: 152, h: 88 },
      { id: 'n6', kind: 'cache', label: 'Redis', x: 1000, y: 240, w: 148, h: 72 },
      { id: 'n7', kind: 'queue', label: 'Kafka', x: 1000, y: 360, w: 188, h: 56 },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: 'HTTPS' },
      { id: 'e2', from: 'n2', to: 'n3', label: 'gRPC' },
      { id: 'e3', from: 'n2', to: 'n4', label: 'gRPC' },
      { id: 'e4', from: 'n3', to: 'n5', label: 'SQL' },
      { id: 'e5', from: 'n3', to: 'n6', label: '' },
      { id: 'e6', from: 'n4', to: 'n7', label: 'publish' },
    ],
    groups: [{ id: 'g1', label: 'VPC', x: 320, y: 60, w: 940, h: 420, kind: 'group' }],
  }
}
