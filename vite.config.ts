import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabase = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const connect = [
    "'self'",
    supabase,
    supabase.replace('https://', 'wss://'),
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.github.com',
  ]
    .filter(Boolean)
    .join(' ')

  const cspDev = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src ${connect} ws: wss:; img-src 'self' data:; worker-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'`
  const cspProd = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src ${connect}; img-src 'self' data:; worker-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'`

  return {
    server: {
      port: 5173,
      strictPort: true,
    },
    plugins: [
      {
        name: 'csp',
        transformIndexHtml(html, ctx) {
          const csp = ctx.server ? cspDev : cspProd
          return html.replace('__CSP__', csp)
        },
      },
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
