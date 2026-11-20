import type { Plugin } from 'vite'

// This must run after every Pricing Vite source transform. The original Vue file
// loads CRM preferences, but an earlier FTL/FCL transform replaces its entire
// loadApplicableCosts() function. Keep this gate to prevent a silent regression.
const PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export function assertCrmPreferentialPricingLoader(source: string): void {
  const begin = source.indexOf('async function loadApplicableCosts() {')
  const end = begin < 0 ? -1 : source.indexOf('\nfunction rebuildRateLines()', begin)
  if (begin < 0 || end <= begin) {
    throw new Error('[pricingCrmPreferredRuntimeGuard] Final Pricing cost loader not found')
  }
  const loader = source.slice(begin, end)
  const preferredCall = loader.indexOf('await loadCustomerPreferentialRates()')
  const pricingSnapshot = loader.indexOf('costs.value = [...mergedCosts.values()]')
  if (preferredCall < 0 || pricingSnapshot < 0 || preferredCall > pricingSnapshot) {
    throw new Error('[pricingCrmPreferredRuntimeGuard] The final built Pricing loader must fetch CRM customer benefits before applying catalog sales')
  }
  if (!source.includes('customerPreferentialAmounts(') || !source.includes('customerManualPreferentialRates(')) {
    throw new Error('[pricingCrmPreferredRuntimeGuard] Preferential sales and CRM manual charges must be available in the final Pricing wizard')
  }
}

export function pricingCrmPreferredRuntimeGuard(): Plugin {
  return {
    name: 'dhole-pricing-crm-preferential-runtime-guard',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(PATH)) return null
      assertCrmPreferentialPricingLoader(source)
      return null
    },
  }
}
