export type AutoSaveClock = {
  setTimeout: (fn: () => void, ms: number) => number
  clearTimeout: (id: number) => void
}

export type AutoSave = {
  noteChange: () => void
  cancel: () => void
  abandon: () => void
  flush: () => Promise<void>
}

export function createAutoSave(opts: {
  delayMs: number
  canSave: () => boolean
  isDirty: () => boolean
  save: () => Promise<void | boolean>
  clock?: AutoSaveClock
}): AutoSave {
  const clock = opts.clock ?? defaultClock()
  let timer = 0
  let inflight: Promise<void> | null = null
  let queued = false
  let cycle = 0

  function cancel(): void {
    clock.clearTimeout(timer)
    timer = 0
  }

  function abandon(): void {
    cancel()
    queued = false
    cycle += 1
  }

  function noteChange(): void {
    cancel()
    if (!opts.canSave()) return
    if (inflight) {
      queued = true
      return
    }
    if (!opts.isDirty()) return
    timer = clock.setTimeout(() => {
      timer = 0
      void run()
    }, opts.delayMs)
  }

  async function run(): Promise<void> {
    cancel()
    if (inflight) {
      queued = true
      await inflight
      if (!opts.canSave() || !opts.isDirty()) return
    }
    const mine = cycle
    let release = (): void => undefined
    inflight = new Promise((resolve) => {
      release = resolve
    })
    try {
      while (opts.canSave() && opts.isDirty() && mine === cycle) {
        queued = false
        const ok = await opts.save()
        if (mine !== cycle) return
        if (ok === false) return
        if (!queued && !opts.isDirty()) return
        if (!queued && opts.isDirty()) return
      }
    } finally {
      inflight = null
      release()
    }
  }

  return { noteChange, cancel, abandon, flush: run }
}

function defaultClock(): AutoSaveClock {
  return {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  }
}
