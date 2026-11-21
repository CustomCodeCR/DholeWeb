import type { Plugin } from 'vite'

const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOnce(source: string, old: string, replacement: string, label: string): string {
  const count = source.split(old).length - 1
  if (count !== 1) throw new Error('[pricingP7TierLandFinalGuard386] ' + label + ': ' + count)
  return source.replace(old, replacement)
}

/** Final Vite guard: a reactive overweight recalc MUST NEVER remove a persisted
 * detail, or replace full-weight tier prices with excess-weight surcharges. */
export function patchPricingP7TierLandFinalGuard386(source: string): string {
  if (source.includes('// dhole-p7-tier-land-386')) return source
  let code = source
  code = replaceOnce(code,
    'function syncPanamaOverweightLines() {\n  if (props.viewOnly || hydratingExistingRate.value) return',
    'function syncPanamaOverweightLines() {\n  if (props.rateId || editingRate.value || props.viewOnly || hydratingExistingRate.value) return',
    'saved-quote overwrite guard')
  code = replaceOnce(code,
    "    if (!line.manual && line.costId && selectedIds.has(line.costId)) return false",
    "    // A priced base freight is not an excess surcharge; preserve it.\n"
      + "    if (!line.manual && line.costId && selectedIds.has(line.costId)) return true",
    'tiered base CostId retention')
  code = replaceOnce(code,
    '? quote.charges.map(({ kind, cost, costAmount, saleAmount }) => {',
    '? quote.charges.filter(({ cost }) => !other.some((line) => line.included && line.costId === cost.id))\n'
      + '      .map(({ kind, cost, costAmount, saleAmount }) => {',
    'no double billing base and surcharge')
  code = replaceOnce(code,
    '  if (isPanamaOverweightRoute() && panamaOverweightQuote.value.excessKg > 0) {',
    '  if (!props.rateId && isPanamaOverweightRoute() && panamaOverweightQuote.value.excessKg > 0) {',
    'saved quotation overweight save guard')
  code = replaceOnce(code,
    'if (rateLines.value.filter((line) => line.key.startsWith("panama-overweight:")).length !== 4) {',
    'if (quote.charges.some(({ cost }) => !rateLines.value.some((line) => line.included && line.costId === cost.id))) {',
    'surcharge coverage validation')

  // The historical fixed GCF route is a fallback only when no master freight exists.
  // An unpriced tier should be reported, not silently replaced by USD 2,140.
  code = replaceOnce(code,
    'function appendPanamaProductionLandLine(lines: RateLine[]) {\n  if (!panamaProductionNoSearchActive.value) return',
    'function appendPanamaProductionLandLine(lines: RateLine[]) {\n'
      + '  if (props.rateId || !panamaProductionNoSearchActive.value) return\n'
      + "  if (lines.some((line) => line.costId && /flete.*terrestre.*panama.*costa rica/.test(normalizeCatalogValue(line.name)))) return\n"
      + "  if (allCosts.value.some((cost) => /flete.*terrestre.*panama.*costa rica/.test(normalizeCatalogValue(cost.name)) && cost.pricingRulesJson)) return",
    'no fixed 2140 replacement when tier configured')
  return code + '\n// dhole-p7-tier-land-386\n'
}

export function pricingP7TierLandFinalGuard386(): Plugin {
  return {
    name: 'dhole-pricing-p7-tier-land-final-guard-386',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\\\', '/').endsWith(WIZARD)) return null
      return { code: patchPricingP7TierLandFinalGuard386(source), map: null }
    },
  }
}
