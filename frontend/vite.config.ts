import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// The infrastructure page imports real repository files (Dockerfile, workflow)
// with `?raw`, so the dev server must be allowed to read the repository root.
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// GitHub Pages can't send response headers, so the Pages build (`--mode github-pages`)
// carries the same Content-Security-Policy as a <meta> tag, read from the Static Web
// Apps config so there is one source of truth. frame-ancestors is dropped because
// browsers ignore it in <meta>.
function cspMetaTag(): Plugin {
  const swaConfig = JSON.parse(readFileSync(new URL('./public/staticwebapp.config.json', import.meta.url), 'utf8'))
  const csp = String(swaConfig.globalHeaders['Content-Security-Policy'])
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive && !directive.startsWith('frame-ancestors'))
    .join('; ')
  return {
    name: 'csp-meta-tag',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
    ],
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'github-pages' ? [cspMetaTag()] : [])],
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}))
