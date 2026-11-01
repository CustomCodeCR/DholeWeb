// Exercise the Vue wizard setup at runtime. Type checking and Vite compilation do
// not execute eager watchers and cannot detect "Cannot access lexical declaration
// before initialization". Running an SSR mount executes setup without live API calls.
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'

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
      console.info('[pricing-wizard-runtime] Setup OK:', label)
    } catch (error) {
      console.error('[pricing-wizard-runtime] Setup FAILED:', label, error)
      process.exitCode = 1
      break
    }
  }
} finally {
  await server.close()
}
if (process.exitCode) throw new Error('Pricing wizard runtime initialization failed')
