import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function pricingWizardLclRouteContextFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-route-context-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null

      // Own-LCL pricing needs the actual port identity (Ningbo, Qingdao, etc.).
      // Config catalog codes such as POL-2026-074 are opaque and cannot be used by
      // the China->Shanghai differential matrix. Pass the visible port label instead;
      // coloader matching continues to use the stable pol-id independently.
      const anchor = ':pol-code="selectedOrigin?.code ?? null"'
      const occurrences = source.split(anchor).length - 1
      if (occurrences !== 1) {
        throw new Error(`[pricingWizardLclRouteContextFix] Expected one LCL POL context anchor, found ${occurrences}.`)
      }

      return {
        code: source.replace(anchor, ':pol-code="displayValue(selectedOrigin)"'),
        map: null,
      }
    },
  }
}
