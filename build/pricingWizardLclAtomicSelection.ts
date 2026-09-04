import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclAtomicSelection] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingWizardLclAtomicSelection(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-atomic-selection',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source

      // Navigation must never be driven by update:modelValue. That event only carries
      // the selected key, not the calculated consolidation payload. Keep v-model for
      // selection state and use the complete `select` payload as the single source of
      // truth for both hydration and navigation.
      code = replaceOne(
        code,
        `            :model-value="lclSelectedSourceKey"\n            @update:model-value="(value) => { lclSelectedSourceKey = String(value || ''); if (value) step = 6 }"`,
        `            v-model="lclSelectedSourceKey"`,
        'LCL model navigation',
      )

      code = replaceOne(
        code,
        `            @select="applyLclRateSource"`,
        `            @select="(selection) => { applyLclRateSource(selection); step = 6 }"`,
        'LCL atomic source handler',
      )

      if (!code.includes(`@select="(selection) => { applyLclRateSource(selection); step = 6 }"`)) {
        throw new Error('[pricingWizardLclAtomicSelection] Atomic LCL selection handler was not applied.')
      }

      return { code, map: null }
    },
  }
}
