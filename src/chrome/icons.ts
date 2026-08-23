function svg(inner: string): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
}

export const ICONS = {
  select: svg('<path d="M3.5 2.5 6 13l2-4.5L13 7.5Z"/><path d="m8 8.5 3.5 4"/>'),
  hand: svg('<path d="M5.5 8.5V5.2a1 1 0 0 1 2 0V8"/><path d="M7.5 8V4.2a1 1 0 0 1 2 0V8"/><path d="M9.5 8V5.5a1 1 0 0 1 2 0V9.5c0 2.2-1.6 3.5-3.8 3.5h-.4C5.5 13 4 11.7 4 9.6V8.2a1 1 0 0 1 1.5-.9"/>'),
  connect: svg('<circle cx="3.5" cy="8" r="1.5"/><circle cx="12.5" cy="8" r="1.5"/><path d="M5 8h6"/>'),
  shapes: svg('<rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/><path d="M11 2.5v5M8.5 5h5"/>'),
  frame: svg('<path d="M3 5.5h10M3 10.5h10M5.5 3v10M10.5 3v10"/>'),
  loop: svg('<path d="M11.5 5.5A4 4 0 1 0 12 9"/><path d="M11.5 3v2.5H14"/>'),
  opt: svg('<rect x="2.5" y="3.5" width="11" height="9" rx="2"/><path d="M5 8h6"/>'),
  group: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke-dasharray="2.5 2"/>'),
  code: svg('<path d="m5.5 4.5-3 3.5 3 3.5M10.5 4.5l3 3.5-3 3.5"/>'),
  save: svg('<path d="M8 2.5v8"/><path d="m5 8 3 3 3-3"/><path d="M3.5 13.5h9"/>'),
  copy: svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/>'),
  docs: svg('<path d="M3.5 3.5h6l3 3v6.5h-9Z"/><path d="M9.5 3.5v3h3"/><path d="M5.5 9h5M5.5 11.5h3.5"/>'),
  hide: svg('<path d="m4 4 8 8M12 4 4 12"/>'),
  github: `<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>`,
  themeSystem: svg('<rect x="2.5" y="3.5" width="11" height="8" rx="1.5"/><path d="M6 13.5h4"/>'),
  themeLight: svg('<circle cx="8" cy="8" r="3"/><path d="M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.85.85M11.05 11.05l.85.85M4.1 11.9l.85-.85M11.05 4.95l.85-.85"/>'),
  themeDark: svg('<path d="M9.5 3.2A4.8 4.8 0 1 0 12.8 9.5 3.6 3.6 0 0 1 9.5 3.2Z"/>'),
} as const
