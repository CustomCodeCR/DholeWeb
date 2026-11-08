import test from 'node:test'
import assert from 'node:assert/strict'
import { createSSRApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { createServer } from 'vite'

// Unlike text-only checks, SSR executes <script setup> through all Vite plugins.
// This catches TDZ failures that compile and bundle successfully, but make the
// production "Crear tarifa" view unusable on its very first render.
test('Crear tarifa: transformed wizard setup must render on a clean session', { timeout: 180_000 }, async () => {
  // AuthStore expects browser storage even though SSR ignores onMounted.
  const memory = new Map()
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, String(value)) },
    removeItem: (key) => { memory.delete(key) },
    clear: () => { memory.clear() },
    key: (index) => [...memory.keys()][index] ?? null,
    get length() { return memory.size },
  }
  globalThis.localStorage = storage
  globalThis.sessionStorage = storage
  const server = await createServer({
    configFile: new URL('../vite.config.ts', import.meta.url).pathname,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'warn',
  })
  try {
    const { default: Wizard } = await server.ssrLoadModule('/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
    assert.ok(Wizard?.setup, 'Vue wizard must have a setup function')
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/pricing', component: { render: () => null } }],
    })
    await router.push('/pricing')
    await router.isReady()
    const app = createSSRApp({ render: () => h(Wizard, { rateId: null, viewOnly: false }) })
    app.use(createPinia())
    app.use(router)
    const markup = await renderToString(app)
    assert.match(markup, /Crear tarifa|pricing-crystal-shell/, 'Wizard needs to produce real HTML, not an error boundary')
  } finally {
    await server.close()
  }
})
