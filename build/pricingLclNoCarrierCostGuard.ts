import type { Plugin } from 'vite'

// Final Vite guard: earlier Pricing transforms build their own cost-selection
// functions and may trust /costs/select even when carrierId was not requested.
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-lcl-no-carrier-master-cost-guard-20261117'

function injectOnce(source: string, anchor: string, replacement: string, description: string): string {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error('[pricingLclNoCarrierCostGuard] ' + description + ': expected 1 anchor, found ' + count)
  }
  return source.replace(anchor, replacement)
}

export function patchPricingLclNoCarrierCostGuard(source: string): string {
  if (source.includes(MARKER)) return source

  let code = source
  const helper = String.raw`
${MARKER}
function lclNoCarrierRejectCatalogCost(cost: CostSelectDto): boolean {
  // Maritime LCL has no ocean carrier. A carrier-selected master cost can never
  // become an automatic LCL charge even if an old select API returned it.
  // Do not change FCL or AirConsol, where provider rules are different.
  if (shipmentModeForApi.value !== 'Lcl' || form.modality === 'Air') return false
  const carrierRelation = Array.isArray(cost.carriers)
    && cost.carriers.some((carrier) =>
      Boolean(String(carrier.id ?? carrier.name ?? '').trim()))
  return Boolean(
    String(cost.carrierId ?? '').trim()
    || String(cost.carrierName ?? '').trim()
    || String(cost.carrierCode ?? '').trim()
    || carrierRelation
  )
}

`

  // Guard both ordinary new-quote generation and explicit catalog-price
  // refresh of saved quotations. Using a single predicate avoids disagreement.
  const regularCost = 'function applicableCost(cost: CostSelectDto) {'
  code = injectOnce(code, regularCost,
    helper + regularCost + '\n  if (lclNoCarrierRejectCatalogCost(cost)) return false',
    'normal cost eligibility')

  const priceResolver = 'function resolvedConditionalCost(cost: CostSelectDto) {'
  code = injectOnce(code, priceResolver,
    priceResolver + '\n  if (lclNoCarrierRejectCatalogCost(cost)) return null',
    'automatic amount resolver')

  const selectedProviders = 'function screen7CostMatchesSelectedProviders(cost: CostSelectDto) {'
  code = injectOnce(code, selectedProviders,
    selectedProviders + '\n  if (lclNoCarrierRejectCatalogCost(cost)) return false',
    'screen 7 refreshed costs')

  return code
}

export function pricingLclNoCarrierCostGuard(): Plugin {
  return {
    name: 'dhole-pricing-lcl-no-carrier-cost-guard',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchPricingLclNoCarrierCostGuard(source), map: null }
    },
  }
}
