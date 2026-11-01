// Exercise the Vue wizard setup at runtime. Type checking and Vite compilation do
// not execute eager watchers and cannot detect "Cannot access lexical declaration
// before initialization". Running an SSR mount executes setup without live API calls.
import { createServer } from 'vite'
import { createSSRApp, h, createRenderer, nextTick, ssrContextKey } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'

// SSR has no browser storage. Mirror empty storage rather than changing auth
// code or introducing a live session in this isolated component smoke test.
const memoryStorage = () => {
  const data = new Map()
  return {
    getItem: (key) => data.get(String(key)) ?? null,
    setItem: (key, value) => { data.set(String(key), String(value)) },
    removeItem: (key) => { data.delete(String(key)) },
    clear: () => data.clear(),
  }
}
globalThis.localStorage = memoryStorage()
globalThis.sessionStorage = memoryStorage()
// Mounted lifecycle hooks attempt to contact live Auth/Config. Suppress browser
// notifications and timers only in this offline smoke test; never change the
// actual application or contact external services.
globalThis.window = {
  dispatchEvent() { return true },
  addEventListener() {},
  removeEventListener() {},
  setTimeout() { return 0 },
  clearTimeout() {},
  location: { href: 'https://dhole.customcodecr.com/', origin: 'https://dhole.customcodecr.com' },
}

const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
try {
  const { default: Wizard } = await server.ssrLoadModule(
    '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  )
  for (const [label, props] of [
    ['read-only existing quotation', { rateId: 'a51881a7-a0d4-49fe-9498-67144d2bab2c', viewOnly: true }],
    ['create quotation', { viewOnly: false }],
  ]) {
    const app = createSSRApp({ render: () => h(Wizard, props) })
    app.use(createPinia())
    app.use(createRouter({ history: createMemoryHistory(), routes: [] }))
    app.use(createI18n({ legacy: false, locale: 'es', messages: { es: {} } }))
    try {
      await renderToString(app)
      console.info('[pricing-wizard-runtime] SSR setup OK:', label)
      // Vue SSR uses a different watch scheduler from the browser.
      // Exercise setup with the CLIENT renderer too, without requiring a
      // network connection, a DOM driver or login credentials.
      const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
      const renderer = createRenderer({
        createElement: (type) => node(type),
        createText: (text) => node('#text', text),
        createComment: (text) => node('#comment', text),
        patchProp(el, key, _previous, value) { el.props[key] = value },
        setText(el, text) { el.text = text },
        setElementText(el, text) { el.text = text; el.children = [] },
        insert(child, parent, anchor = null) {
          if (child.parent) {
            const prior = child.parent.children.indexOf(child)
            if (prior >= 0) child.parent.children.splice(prior, 1)
          }
          parent.children ||= []
          const index = anchor ? parent.children.indexOf(anchor) : -1
          if (index < 0) parent.children.push(child)
          else parent.children.splice(index, 0, child)
          child.parent = parent
        },
        remove(child) {
          const parent = child.parent
          if (!parent) return
          const index = parent.children.indexOf(child)
          if (index >= 0) parent.children.splice(index, 1)
          child.parent = null
        },
        parentNode: (el) => el.parent,
        nextSibling(el) {
          const siblings = el.parent?.children || []
          return siblings[siblings.indexOf(el) + 1] || null
        },
        querySelector: () => node('teleport-target'),
      })
      const runtimeApp = renderer.createApp(Wizard, props)
      runtimeApp.use(createPinia())
      runtimeApp.use(createRouter({ history: createMemoryHistory(), routes: [] }))
      runtimeApp.use(createI18n({ legacy: false, locale: 'es', messages: { es: {} } }))
      // ssrLoadModule injects a registration call to useSSRContext().modules;
      // provide that context when exercising the compiled setup with a client renderer.
      runtimeApp.provide(ssrContextKey, { modules: new Set() })
      runtimeApp.mount(node('root'))
      await nextTick()
      runtimeApp.unmount()
      console.info('[pricing-wizard-runtime] Client setup OK:', label)
    } catch (error) {
      console.error('[pricing-wizard-runtime] CLIENT setup FAILED:', label, error)
      process.exitCode = 1
      break
    }
  }
} finally {
  await server.close()
}
if (process.exitCode) throw new Error('Pricing wizard runtime initialization failed')
