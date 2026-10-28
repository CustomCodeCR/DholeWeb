import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-ftl-persisted-edit-freight-20261028'

/**
 * Existing FTL quotes carry a committed freight snapshot in RateDetails.
 * The current master tariff may have expired, been deactivated, or changed.
 * Screen 5 must not replace the quote snapshot with a fresh lookup or zero.
 */
export function patchPricingWizardFtlEditFreightRestore(source: string): string {
  if (source.includes(MARKER)) return source

  const searchAnchor = 'async function searchApprovedRates() {'
  const stageFiveAnchor = `          <template v-else-if="form.modality === 'Land' && (shipmentModeForApi === 'Ltl' || (shipmentModeForApi === 'Ftl' && resolvedFtlTariff))">`
  if (!source.includes(searchAnchor) || !source.includes(stageFiveAnchor)) {
    throw new Error('[pricingWizardFtlEditFreightRestore] Expected wizard anchors not found.')
  }

  const helper = `// A saved FTL freight is authoritative while the route and equipment are unchanged.
function savedFtlFreightForCurrentEdit() {
  const rate = editingRate.value
  if (!props.rateId || !rate || form.modality !== 'Land' || shipmentModeForApi.value !== 'Ftl') return null
  if (rate.polId !== form.originId || rate.poeId !== form.destinationId || rate.containerTypeId !== form.equipmentId) return null
  return (rate.rateDetails ?? []).find((detail) => detail.costDetailType === 'Freight') ?? null
}

const persistedFtlFreightForEdit = computed(savedFtlFreightForCurrentEdit)

`

  const guard = `async function searchApprovedRates() {
  // Editing must display the original RateDetails, not require a tariff that is
  // still active today. Changing the route/equipment still triggers normal lookup.
  const savedFtlFreight = savedFtlFreightForCurrentEdit()
  if (savedFtlFreight && editingRate.value) {
    resolvedFtlTariff.value = null
    availableRates.value = []
    form.selectedImportRateId = ''
    form.manualRate = true
    form.freightCost = number(savedFtlFreight.costAmount)
    form.freightSale = number(savedFtlFreight.saleAmount)
    loadingRates.value = false
    return
  }`

  const card = `          <template v-else-if="form.modality === 'Land' && shipmentModeForApi === 'Ftl' && persistedFtlFreightForEdit">
            <div class="crystal-rate-card crystal-rate-card--active space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-black">Flete terrestre guardado en esta cotización</p>
                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                    Se conserva el costo y la venta de la QUO original, aunque su tarifario maestro ya no esté vigente.
                  </p>
                </div>
                <DhBadge variant="success">Flete guardado</DhBadge>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                  <p class="text-xs font-bold text-[var(--dh-text-muted)]">Costo del flete</p>
                  <p class="mt-1 text-xl font-black">{{ formatMoney(form.freightCost, selectedCurrency?.code || 'USD') }}</p>
                </div>
                <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                  <p class="text-xs font-bold text-[var(--dh-text-muted)]">Venta del flete</p>
                  <p class="mt-1 text-xl font-black">{{ formatMoney(form.freightSale, selectedCurrency?.code || 'USD') }}</p>
                </div>
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <DhButton variant="secondary" @click="continueManual">Modificar costo o venta</DhButton>
                <DhButton @click="continueManual">Conservar flete y continuar</DhButton>
              </div>
            </div>
          </template>

`

  let code = source.replace(searchAnchor, helper + guard)
  code = code.replace(stageFiveAnchor, card + stageFiveAnchor)
  return code.replace('</script>', MARKER + '\n</script>')
}

export function pricingWizardFtlEditFreightRestore(): Plugin {
  return {
    name: 'dhole-pricing-ftl-persisted-edit-freight',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardFtlEditFreightRestore(source), map: null }
    },
  }
}
