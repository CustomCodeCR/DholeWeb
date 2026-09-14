import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function pricingRateUpdateSourceParity(): Plugin {
  return {
    name: 'dhole-pricing-rate-update-source-parity',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null

      const anchor = `const { sourceImportFclRateId: _sourceImportFclRateId, details: _details, ...baseUpdate } = createPayload`
      const replacement = `const { details: _details, ...baseUpdate } = createPayload`
      const occurrences = source.split(anchor).length - 1
      if (occurrences !== 1) {
        throw new Error(`[pricingRateUpdateSourceParity] Expected one update payload source anchor, found ${occurrences}.`)
      }

      return { code: source.replace(anchor, replacement), map: null }
    },
  }
}
