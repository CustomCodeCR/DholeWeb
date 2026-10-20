import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

// Seller requests only capture the first four screens. No Pricing tariff lookup
// or operative rate permissions are required to move from screen 3 to screen 4.
function patchWizard(source: string) {
  let code = source
  const marker = '// dhole-seller-multimodal-step3-fix'
  if (code.includes(marker)) return code

  const selectedDestinationAnchor =
    'const selectedDestination = computed(() => findById(destinationCatalog.value, form.destinationId))'
  if (!code.includes(selectedDestinationAnchor)) {
    throw new Error('[pricingSellerMultimodalStep3Fix] Missing selected POE anchor.')
  }

  // A synthetic multimodal POE can be configured as a different terminal type.
  // Preserve its selected catalog value for seller requests instead of silently
  // losing the selection when the maritime CY list is filtered.
  code = code.replace(
    selectedDestinationAnchor,
    `const selectedDestination = computed(() => {
  const selected = findById(destinationCatalog.value, form.destinationId)
  if (selected || !props.sellerRequestMode || form.modality !== 'Maritime') return selected
  const configured = findById(catalogs.poe, form.destinationId)
  return isMultimodalViaPanama(configured) ? configured : null
})`,
  )

  const nextAnchor = 'async function next() {'
  if (!code.includes(nextAnchor)) {
    throw new Error('[pricingSellerMultimodalStep3Fix] Missing navigation anchor.')
  }

  code = code.replace(
    nextAnchor,
    `${marker}
const sellerMultimodalSellerStep3 = computed(() =>
  props.sellerRequestMode
  && step.value === 3
  && form.modality === 'Maritime'
  && shipmentModeForApi.value === 'Fcl'
  && isMultimodalViaPanama(findById(catalogs.poe, form.destinationId)),
)

// Resolve the actual DhSelect option instead of trusting a watcher-populated
// form.executiveName. A selected salesperson can already be visible while that
// mirrored string is still empty (e.g. after draft hydration or impersonation).
function syncSellerMultimodalExecutiveSelection() {
  const options = sellerRequestOwnerOptions.value
  const byOwnerId = options.find((option) => option.value === sellerRequestOwnerId.value)
  const byFormId = options.find((option) => option.value === form.executiveId)
  const name = normalizeCatalogValue(String(form.executiveName ?? ''))
  const byName = name
    ? options.find((option) => normalizeCatalogValue(option.label) === name)
    : undefined
  // The API can return multiple sellers. Default to its first option if a
  // preselected value was not hydrated yet; preserve any explicit selection.
  const selected = byOwnerId ?? byFormId ?? byName ?? options[0]
  if (!selected?.value || !String(selected.label ?? '').trim()) return false

  // These fields must stay aligned for screen 4, submission and sellerUserId.
  sellerRequestOwnerId.value = selected.value
  form.executiveId = selected.value
  form.executiveName = String(selected.label).trim()
  return true
}

function continueSellerMultimodalStep3() {
  const missing: string[] = []
  if (!form.clientName.trim()) missing.push('Nombre del cliente')
  if (!syncSellerMultimodalExecutiveSelection()) missing.push('Ejecutivo comercial')
  if (!selectedOrigin.value) missing.push('Origen (POL)')
  if (!selectedDestination.value) missing.push('Multimodal vía Panamá (POE)')
  if (!selectedPod.value) missing.push('Destino final (POD)')
  if (!selectedEquipment.value) missing.push('Equipo')
  if (number(form.equipmentQuantity) <= 0) missing.push('Cantidad de equipo')
  if (!selectedIncoterm.value) missing.push('Incoterm')
  if (!form.serviceIds.length) missing.push('Servicios')
  if (inlandPickupServiceSelected.value && !form.inlandPickupLocation.address.trim())
    missing.push('Dirección para transporte de recolección')
  if (inlandDeliveryServiceSelected.value && !form.inlandDeliveryLocation.address.trim())
    missing.push('Dirección para transporte de entrega')
  if (!form.loadDate) missing.push('Fecha de carga lista')
  if (!exwLocationReady.value) missing.push('Ubicación de recolecta EXW')
  if (!fcaLocationReady.value) missing.push('Ubicación de WHS FCA')
  if (selectedIncotermCode.value === 'EXW' && !sellerCargoConditionReady.value) missing.push('Carga fiscal o nacionalizada en cada recolecta')
  if (!landEquipmentSelectionValid.value) missing.push('Distribución de equipo')

  if (missing.length) {
    toastStore.error(
      'Faltan datos para continuar',
      'Complete: ' + missing.join(' · '),
    )
    return
  }

  // Ventas no elige tarifas importadas, naviera ni proveedores en este paso.
  step.value = 4
}

${nextAnchor}`,
  )

  // The normal Pricing canNext / loadingRates state can depend on data that
  // a seller does not own. Preserve that guard everywhere except this request.
  const footerPattern = /(<DhButton v-else-if="!isEditing && step < 8 && !\[1, 2, 5\]\.includes\(step\)" ):disabled="([^"]+)" @click="next">Continuar/g
  const matches = [...code.matchAll(footerPattern)]
  if (matches.length !== 1) {
    throw new Error(`[pricingSellerMultimodalStep3Fix] Expected one Continue button, found ${matches.length}.`)
  }
  code = code.replace(
    footerPattern,
    (_full, prefix: string, disabled: string) =>
      `${prefix}:disabled="sellerMultimodalSellerStep3 ? saving : (${disabled})" @click="sellerMultimodalSellerStep3 ? continueSellerMultimodalStep3() : next()">Continuar`,
  )

  // También se valida al enviar: no permitir POST sin clasificación.
  const submitAnchor = 'async function saveOpenRequest() {'
  if (!code.includes(submitAnchor)) throw new Error('[pricingSellerMultimodalStep3Fix] Missing submit guard anchor')
  code = code.replace(submitAnchor, [
    'async function saveOpenRequest() {',
    "  if (props.sellerRequestMode && selectedIncotermCode.value === 'EXW' && !sellerCargoConditionReady.value) {",
    "    toastStore.error('Condición de carga obligatoria', 'Seleccione carga fiscal o nacionalizada para cada recolecta EXW antes de enviar la solicitud.')",
    '    return',
    '  }',
    "  if (props.sellerRequestMode && !inlandServiceLocationsReady.value) {",
    "    step.value = 3",
    "    toastStore.error('Ubicación de transporte requerida', 'Complete la dirección de los servicios de recolección y entrega. Ubicarlos en el mapa es opcional.')",
    '    return',
    '  }',
  ].join('\n'))

  // In seller requests, fiscal/nationalized cargo classification belongs to
  // EXW pickup locations only. Other Incoterms must not require a global
  // cargoCondition field, and should not display its old selector.
  const cargoReadyAnchor = `  if (selectedIncotermCode.value === 'EXW') {
    return pickupLocations.value.length > 0 && pickupLocations.value.every((pickup) => valid(pickup.cargoCondition))
  }
  return valid(form.cargoCondition)`
  if (!code.includes(cargoReadyAnchor)) {
    throw new Error('[pricingSellerMultimodalStep3Fix] Missing EXW cargo readiness anchor.')
  }
  code = code.replace(cargoReadyAnchor, `  if (selectedIncotermCode.value !== 'EXW') return true
  return pickupLocations.value.length > 0 && pickupLocations.value.every((pickup) => valid(pickup.cargoCondition))`)

  const nonExwConditionSelect = /\s*<DhSelect\s+v-if="sellerRequestMode && selectedIncotermCode !== 'EXW'"[\s\S]*?:options="pickupCargoConditionOptions"\s*\/>/
  const nonExwMatches = [...code.matchAll(new RegExp(nonExwConditionSelect.source, 'g'))]
  if (nonExwMatches.length !== 1) {
    throw new Error(`[pricingSellerMultimodalStep3Fix] Expected one non-EXW seller cargo selector, found ${nonExwMatches.length}.`)
  }
  code = code.replace(nonExwConditionSelect, '')

  return code
}

export function pricingSellerMultimodalStep3Fix(): Plugin {
  return {
    name: 'dhole-seller-multimodal-step3-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
