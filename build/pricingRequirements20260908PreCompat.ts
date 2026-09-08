import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function pricingRequirements20260908PreCompat(): Plugin {
  return {
    name: 'dhole-pricing-requirements-20260908-pre-compat',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null

      const anchor = `              <span class="block text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`
      if (!source.includes(anchor)) {
        throw new Error('[pricingRequirements20260908PreCompat] Shipment mode label anchor was not found after the September UI transformations.')
      }

      return {
        code: source.replace(
          anchor,
          `              <span class="text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`,
        ),
        map: null,
      }
    },
  }
}
