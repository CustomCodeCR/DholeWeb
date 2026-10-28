import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-ftl-persisted-edit-freight-20261028-v2'

/**
 * RateDetails are the source of truth for a previously created FTL quotation.
 * A change in POE, origin, equipment or quote date must not erase those
 * persisted amounts; it does require explicit review before repricing.
 */
export function patchPricingWizardFtlEditFreightRestore(source: string): string {
  if (source.includes(MARKER)) return source

  const searchAnchor = 'async function searchApprovedRates() {'
  const stageFiveAnchor = `          <template v-else-if="form.modality === 'Land' && (shipmentModeForApi === 'Ltl' || (shipmentModeForApi === 'Ftl' && resolvedFtlTariff))">`
  if (source.split(searchAnchor).length !== 2 || source.split(stageFiveAnchor).length !== 2) {
    throw new Error('[pricingWizardFtlEditFreightRestore] Expected a single search and screen 5 anchor.')
  }

  const helpers = `// Always show the actual persisted FTL line, even after changing POE.
function savedFtlFreightForCurrentEdit() {
  const rate = editingRate.value
  if (!props.rateId || !rate || form.modality !== 'Land' || shipmentModeForApi.value !== 'Ftl') return null
  return (rate.rateDetails ?? []).find((detail) => detail.costDetailType === 'Freight') ?? null
}

const persistedFtlFreightForEdit = computed(savedFtlFreightForCurrentEdit)
const persistedFtlContextChanged = computed(() => {
  const rate = editingRate.value
  if (!rate || !persistedFtlFreightForEdit.value) return false
  return String(rate.polId ?? '') !== String(form.originId ?? '')
    || String(rate.poeId ?? '') !== String(form.destinationId ?? '')
    || String(rate.containerTypeId ?? '') !== String(form.equipmentId ?? '')
    || String(rate.validFrom ?? '').slice(0, 10) !== String(form.loadDate ?? '').slice(0, 10)
})

const ftlEditTariffPreview = ref<FtlTariffDto | null>(null)
const ftlEditTariffLoading = ref(false)
const ftlEditTariffMessage = ref('')
const ftlEditTariffPreviewKey = ref('')
const ftlEditCurrentLookupKey = computed(() => [
  form.originId, form.destinationId, form.equipmentId, form.loadDate,
].join('|'))
const ftlEditVisibleTariffPreview = computed(() =>
  ftlEditTariffPreviewKey.value === ftlEditCurrentLookupKey.value
    ? ftlEditTariffPreview.value
    : null,
)
const ftlEditVisibleTariffMessage = computed(() =>
  ftlEditTariffPreviewKey.value === ftlEditCurrentLookupKey.value
    ? ftlEditTariffMessage.value
    : '',
)

// Consultation is read-only: master pricing does not expose a separate FTL
// cost and sale. It is unsafe to overwrite both with its single priceAmount.
async function consultFtlTariffForEditedRoute() {
  const equipment = selectedEquipment.value
  const equipmentClass = equipment
    ? String(equipment.code || displayValue(equipment) || equipment.slug || equipment.id).trim()
    : ''
  if (!equipmentClass || !selectedOrigin.value || !selectedDestination.value) {
    toastStore.warning('Ruta o equipo incompleto', 'Seleccione origen, destino y furgón antes de consultar el tarifario.')
    return
  }
  const lookupKey = ftlEditCurrentLookupKey.value
  ftlEditTariffLoading.value = true
  ftlEditTariffMessage.value = ''
  ftlEditTariffPreview.value = null
  ftlEditTariffPreviewKey.value = lookupKey
  try {
    const tariff = await FtlTariffService.resolve({
      originId: form.originId || null,
      destinationId: form.destinationId || null,
      originName: displayValue(selectedOrigin.value),
      destinationName: displayValue(selectedDestination.value),
      originCode: selectedOrigin.value.code ?? null,
      destinationCode: selectedDestination.value.code ?? null,
      equipmentClass,
      shipmentMode: 'Ftl',
      commercialProfile: 'General',
      quoteDate: form.loadDate,
    })
    if (lookupKey !== ftlEditCurrentLookupKey.value) return
    ftlEditTariffPreview.value = tariff
    if (!tariff) ftlEditTariffMessage.value = 'No hay tarifa maestra vigente para la ruta y equipo seleccionados. El precio anterior se conserva solo como referencia.'
  } catch (error) {
    if (lookupKey === ftlEditCurrentLookupKey.value) {
      ftlEditTariffMessage.value = 'No se pudo consultar el tarifario terrestre. El flete guardado permanece sin cambios.'
      toastStore.backendError(error, 'Falló la consulta del tarifario FTL.')
    }
  } finally {
    ftlEditTariffLoading.value = false
  }
}

`

  const guard = `async function searchApprovedRates() {
  // Existing FTL quotations are never reset to zero just because the selected
  // route no longer has a current master tariff (or the POE was edited).
  const savedFtlFreight = savedFtlFreightForCurrentEdit()
  if (savedFtlFreight) {
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
                  <p class="font-black">Flete FTL guardado en esta QUO</p>
                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                    Costo y venta recuperados de los detalles originales de la cotización, no de una tarifa nueva.
                  </p>
                </div>
                <DhBadge :variant="persistedFtlContextChanged ? 'neutral' : 'success'" :label="persistedFtlContextChanged ? 'Precio histórico' : 'Flete guardado'" />
              </div>
              <p v-if="persistedFtlContextChanged" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-[var(--dh-text)]" role="alert">
                Cambió el origen, POE, equipo o fecha respecto a la QUO original. Estos importes corresponden a la ruta anterior;
                compruebe el nuevo costo y la nueva venta antes de guardar. No se recalculan automáticamente.
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                  <p class="text-xs font-bold text-[var(--dh-text-muted)]">Costo original del flete</p>
                  <p class="mt-1 text-xl font-black">{{ formatMoney(number(persistedFtlFreightForEdit.costAmount), persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD') }}</p>
                </div>
                <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                  <p class="text-xs font-bold text-[var(--dh-text-muted)]">Venta original del flete</p>
                  <p class="mt-1 text-xl font-black">{{ formatMoney(number(persistedFtlFreightForEdit.saleAmount), persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD') }}</p>
                </div>
              </div>
              <div v-if="ftlEditVisibleTariffPreview" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-xs font-semibold">
                <p class="font-black">Referencia del tarifario vigente: {{ formatMoney(ftlEditVisibleTariffPreview.priceAmount, ftlEditVisibleTariffPreview.currencyCode || 'USD') }} por completo</p>
                <p class="mt-1 text-[var(--dh-text-muted)]">No sustituye el costo y la venta guardados. Confirme ambos valores en la pantalla de proveedor.</p>
              </div>
              <p v-if="ftlEditVisibleTariffMessage" class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ ftlEditVisibleTariffMessage }}</p>
              <div v-if="!viewOnly" class="flex flex-wrap justify-end gap-2">
                <DhButton variant="secondary" :disabled="ftlEditTariffLoading" @click="consultFtlTariffForEditedRoute">
                  {{ ftlEditTariffLoading ? 'Consultando tarifario…' : 'Consultar tarifario actual' }}
                </DhButton>
                <DhButton @click="continueManual">
                  {{ persistedFtlContextChanged ? 'Revisar y ajustar costo / venta' : 'Conservar flete y continuar' }}
                </DhButton>
              </div>
            </div>
          </template>

`

  let code = source.replace(searchAnchor, helpers + guard)
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
