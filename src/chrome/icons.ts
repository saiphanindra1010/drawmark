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
  github: `<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 0 0-2.05 12.66c.33.06.45-.14.45-.32v-1.13c-1.83.4-2.22-.88-2.22-.88-.3-.76-.73-.96-.73-.96-.6-.41.05-.4.05-.4.66.05 1.01.68 1.01.68.59 1.01 1.54.72 1.91.55.06-.43.23-.72.42-.89-1.46-.16-3-.73-3-3.25 0-.72.26-1.3.68-1.77-.07-.17-.3-.85.06-1.76 0 0 .56-.18 1.8.67A6.2 6.2 0 0 1 8 5.07c.56 0 1.13.08 1.66.22 1.24-.85 1.8-.67 1.8-.67.36.91.13 1.59.06 1.76.42.46.68 1.05.68 1.77 0 2.53-1.55 3.08-3.01 3.25.24.2.45.6.45 1.21v1.79c0 .18.12.39.45.32A6.5 6.5 0 0 0 8 1.5Z"/></svg>`,
  themeSystem: svg('<rect x="2.5" y="3.5" width="11" height="8" rx="1.5"/><path d="M6 13.5h4"/>'),
  themeLight: svg('<circle cx="8" cy="8" r="3"/><path d="M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.85.85M11.05 11.05l.85.85M4.1 11.9l.85-.85M11.05 4.95l.85-.85"/>'),
  themeDark: svg('<path d="M9.5 3.2A4.8 4.8 0 1 0 12.8 9.5 3.6 3.6 0 0 1 9.5 3.2Z"/>'),
} as const
