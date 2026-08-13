import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { overlayFocused, overlayOpen, setOverlayFocused, setOverlayOpen } from '../scene/scene.ts'

let view: EditorView | null = null
let onUserEdit: ((text: string) => void) | null = null
let applying = false

export function initOverlay(host: HTMLElement, onEdit: (text: string) => void): void {
  onUserEdit = onEdit
  const state = EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      history(),
      markdown(),
      placeholder('flowchart LR'),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          background: 'var(--cm-bg)',
        },
        '.cm-content': { caretColor: 'var(--text)', color: 'var(--text)' },
        '.cm-gutters': { background: 'var(--surface)', color: 'var(--muted)', border: 'none' },
        '&.cm-focused': { outline: 'none' },
      }),
      EditorView.updateListener.of((u) => {
        if (applying || !u.docChanged) return
        if (overlayFocused === false) return
        onUserEdit?.(u.state.doc.toString())
      }),
    ],
  })
  view = new EditorView({ state, parent: host })
  host.addEventListener('focusin', () => setOverlayFocused(true))
  host.addEventListener('focusout', () => setOverlayFocused(false))
}

export function setOverlayText(text: string): void {
  if (!view) return
  const current = view.state.doc.toString()
  if (current === text) return
  applying = true
  try {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    })
  } finally {
    applying = false
  }
}

export function overlayText(): string {
  return view?.state.doc.toString() ?? ''
}

export function toggleOverlay(): void {
  setOverlayOpen(!overlayOpen)
}

export function showOverlayError(message: string | null): void {
  const el = document.getElementById('code-error')
  if (!el) return
  if (!message) {
    el.hidden = true
    el.textContent = ''
    return
  }
  el.hidden = false
  el.textContent = message
}
