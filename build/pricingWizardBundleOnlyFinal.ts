import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const LEGACY_COST_CALL = 'PricingService.selectCosts('

/**
 * Final pre-Vue transform: older pricing plugins still inject direct select
 * calls after the main loader was migrated. Keep ONE API contract for every
 * quotation creation/edit flow, rather than silently mixing cost sources.
 */
export function patchPricingWizardBundleOnlyFinal(source: string): string {
  const count = source.split(LEGACY_COST_CALL).length - 1
  if (!source.includes('PricingService.selectWizardCosts(')) {
    throw new Error('[pricingWizardBundleOnlyFinal] Primary wizard-bundle loader missing')
  }
  if (!source.includes('</script>')) {
    throw new Error('[pricingWizardBundleOnlyFinal] Vue script close marker missing')
  }
  // Every legacy caller requests the same route-specific bundle. In particular,
  // {isActive:true} is NOT permission to merge the entire global catalog.
  const bridge = `
/** Legacy callers MUST return only the authoritative contextual applicable set. */
async function pricingWizardBundleSelectCosts(
  query?: Parameters<typeof PricingService.selectWizardCosts>[0],
): Promise<CostSelectDto[]> {
  // Never reprice a saved quote implicitly; persisted RateDetails win.
  if (props.rateId && !allowCatalogRefreshForSavedQuote.value) return []
  const requestContext = activeCostContextKey()
  const bundle = await PricingService.selectWizardCosts({
    carrierId: form.carrierId || undefined,
    agentId: costContextAgentId() || undefined,
    polId: form.originId || undefined,
    poeId: costContextPoeId() || undefined,
    podId: form.podId || undefined,
    incotermId: form.incotermId || undefined,
    shipmentMode: costShipmentModeForApi(),
    isActive: true,
    applicableToContext: true,
    serviceIds: form.serviceIds.join(',') || undefined,
    containerTypeId: form.equipmentId || undefined,
    weightKg: number(form.cargoWeightKg) > 0 ? number(form.cargoWeightKg) : undefined,
    packages: number(form.cargoPackages) > 0 ? Math.trunc(number(form.cargoPackages))
      : consolidatedCargoMode.value && number(form.cargoPallets) > 0
        ? Math.trunc(number(form.cargoPallets)) : undefined,
    storageDays: number(form.storageDays) > 0 ? Math.trunc(number(form.storageDays)) : undefined,
    ...query,
  })
  if (requestContext !== activeCostContextKey()) return []
  return bundle.applicable.filter((cost) =>
    cost.isActive !== false && (!query?.costType || cost.costType === query.costType))
}
`
  const rewritten = source.replaceAll(LEGACY_COST_CALL, 'pricingWizardBundleSelectCosts(')
  const result = rewritten.replace('</script>', bridge + '\n</script>')
  if (result.includes(LEGACY_COST_CALL) || !result.includes('pricingWizardBundleSelectCosts(')) {
    throw new Error('[pricingWizardBundleOnlyFinal] Incomplete legacy cost migration')
  }
  if (count > 0 && !result.includes('const bundle = await PricingService.selectWizardCosts(')) {
    throw new Error('[pricingWizardBundleOnlyFinal] Bridge lost backend bundle')
  }
  return result
}

export function pricingWizardBundleOnlyFinal(): Plugin {
  return {
    name: 'dhole-pricing-wizard-bundle-only-final',
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replaceAll(String.fromCharCode(92), '/').endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardBundleOnlyFinal(source), map: null }
    },
  }
}
