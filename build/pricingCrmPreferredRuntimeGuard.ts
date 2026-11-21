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

// Final-stage assertion: check actual Vite-transformed Vue, not just .vue on disk.
// Source-type checks cannot detect helper declarations deleted by transforms.
export function assertIncotermPricingRuntime(source: string): void {
  const expected: Array<[string, RegExp]> = [
    ['explicitlyQuotedOutsideIncoterm', /^const explicitlyQuotedOutsideIncoterm = ref\(/m],
    ['expandedOutsideIncotermGroups', /^const expandedOutsideIncotermGroups = ref\(/m],
    ['outsideIncotermScopeKey', /^const outsideIncotermScopeKey = \(line: RateLine\) =>/m],
    ['isAutomaticOutsideIncoterm', /^function isAutomaticOutsideIncoterm\(line: RateLine\)/m],
    ['rememberExplicitOutsideIncoterm', /^function rememberExplicitOutsideIncoterm\(line: RateLine, selected: boolean\)/m],
    ['applyIncotermAutomaticChargeGuard', /^function applyIncotermAutomaticChargeGuard\(\)/m],
    ['outsideIncotermCandidateLines', /^function outsideIncotermCandidateLines\(groupKey: string\)/m],
    ['toggleOutsideIncotermGroup', /^function toggleOutsideIncotermGroup\(groupKey: string\)/m],
    ['quoteOutsideIncotermByAgreement', /^function quoteOutsideIncotermByAgreement\(line: RateLine\)/m],
  ]
  for (const [name, declaration] of expected) {
    if (!declaration.test(source)) {
      throw new Error('[pricingCrmPreferredRuntimeGuard] Incoterm runtime binding missing after transforms: ' + name)
    }
  }
  if (!source.includes('() => applyIncotermAutomaticChargeGuard()')) {
    throw new Error('[pricingCrmPreferredRuntimeGuard] Incoterm P7 watcher is missing')
  }
}

export function pricingCrmPreferredRuntimeGuard(): Plugin {
  return {
    name: 'dhole-pricing-crm-preferential-runtime-guard',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(PATH)) return null
      assertCrmPreferentialPricingLoader(source)
      assertIncotermPricingRuntime(source)
      return null
    },
  }
}
