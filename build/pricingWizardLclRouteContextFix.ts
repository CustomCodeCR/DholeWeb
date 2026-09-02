import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function pricingWizardLclRouteContextFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-route-context-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null

      let code = source

      // Own-LCL pricing needs the actual port identity (Ningbo, Qingdao, etc.).
      // Config catalog codes such as POL-2026-074 are opaque and cannot be used by
      // the China->Shanghai differential matrix. Pass the visible port label instead;
      // coloader matching continues to use the stable pol-id independently.
      const polAnchor = ':pol-code="selectedOrigin?.code ?? null"'
      const polOccurrences = code.split(polAnchor).length - 1
      if (polOccurrences !== 1) {
        throw new Error(`[pricingWizardLclRouteContextFix] Expected one LCL POL context anchor, found ${polOccurrences}.`)
      }
      code = code.replace(polAnchor, ':pol-code="displayValue(selectedOrigin)"')

      // Some Config catalogs use internal codes for Incoterms. EXW/FCA were already
      // normalized by visible text in the wizard, but FOB was falling through to the
      // internal code and therefore skipped the own-LCL FOB rule in Pricing.
      const incotermAnchor = String.raw`  if (/(^|\s)fca(\s|$)/.test(raw)) return 'FCA'`
      const incotermOccurrences = code.split(incotermAnchor).length - 1
      if (incotermOccurrences !== 1) {
        throw new Error(`[pricingWizardLclRouteContextFix] Expected one Incoterm normalization anchor, found ${incotermOccurrences}.`)
      }
      code = code.replace(
        incotermAnchor,
        `${incotermAnchor}\n  if (/(^|\\s)fob(\\s|$)/.test(raw)) return 'FOB'`,
      )

      return { code, map: null }
    },
  }
}
