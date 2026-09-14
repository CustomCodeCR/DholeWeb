import type { Plugin } from 'vite'

const MAIN_PATH = '/src/main.ts'

/**
 * Keeps the responsive polish that originally shipped with the controlled-update plugin.
 * Rate editing itself is intentionally left untouched: the base wizard already supports
 * editing an existing rate and must follow the same functional flow as creating one.
 */
export function pricingRateUpdateWorkflow(): Plugin {
  return {
    name: 'dhole-pricing-rate-update-workflow',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(MAIN_PATH)) return null
      if (source.includes(`import './assets/responsive-polish.css'`)) return null

      return { code: `import './assets/responsive-polish.css'\n${source}`, map: null }
    },
  }
}
