import { describe, expect, it } from 'vitest'
import { createAutoSave } from './autosave.ts'

function fakeClock(): {
  clock: { setTimeout: (fn: () => void, ms: number) => number; clearTimeout: (id: number) => void }
  tick: (ms: number) => void
} {
  let nextId = 1
  const pending: { id: number; at: number; fn: () => void }[] = []
  let now = 0
  return {
    clock: {
      setTimeout(fn, ms) {
        const id = nextId++
        pending.push({ id, at: now + ms, fn })
        return id
      },
      clearTimeout(id) {
        const index = pending.findIndex((item) => item.id === id)
        if (index >= 0) pending.splice(index, 1)
      },
    },
    tick(ms) {
      now += ms
      const due = pending.filter((item) => item.at <= now)
      for (const item of due) {
        const index = pending.indexOf(item)
        if (index >= 0) pending.splice(index, 1)
        item.fn()
      }
    },
  }
}

describe('createAutoSave', () => {
  it('saves once after the delay when edits stop', async () => {
    const { clock, tick } = fakeClock()
    let saves = 0
    let dirty = true
    const auto = createAutoSave({
      delayMs: 8000,
      canSave: () => true,
      isDirty: () => dirty,
      save: async () => {
        saves += 1
        dirty = false
      },
      clock,
    })
    auto.noteChange()
    auto.noteChange()
    tick(7999)
    expect(saves).toBe(0)
    tick(1)
    await Promise.resolve()
    expect(saves).toBe(1)
  })

  it('saves again if the diagram is still dirty after a save', async () => {
    const { clock, tick } = fakeClock()
    let saves = 0
    let dirty = true
    let auto: ReturnType<typeof createAutoSave>
    auto = createAutoSave({
      delayMs: 8000,
      canSave: () => true,
      isDirty: () => dirty,
      save: async () => {
        saves += 1
        if (saves === 1) {
          auto.noteChange()
          return
        }
        dirty = false
      },
      clock,
    })
    auto.noteChange()
    tick(8000)
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(saves).toBe(2)
  })

  it('does not retry immediately after a failed save', async () => {
    const { clock, tick } = fakeClock()
    let saves = 0
    const auto = createAutoSave({
      delayMs: 8000,
      canSave: () => true,
      isDirty: () => true,
      save: async () => {
        saves += 1
        return false
      },
      clock,
    })
    auto.noteChange()
    tick(8000)
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(saves).toBe(1)
  })

  it('does not save when GitHub is not ready', async () => {
    const { clock, tick } = fakeClock()
    let saves = 0
    const auto = createAutoSave({
      delayMs: 8000,
      canSave: () => false,
      isDirty: () => true,
      save: async () => {
        saves += 1
      },
      clock,
    })
    auto.noteChange()
    tick(8000)
    await Promise.resolve()
    expect(saves).toBe(0)
  })

  it('drops an in-flight save after abandon', async () => {
    const { clock, tick } = fakeClock()
    let saves = 0
    let finish = (): void => undefined
    const auto = createAutoSave({
      delayMs: 8000,
      canSave: () => true,
      isDirty: () => true,
      save: () =>
        new Promise((resolve) => {
          saves += 1
          finish = () => resolve()
        }),
      clock,
    })
    auto.noteChange()
    tick(8000)
    await Promise.resolve()
    auto.abandon()
    finish()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(saves).toBe(1)
  })
})
