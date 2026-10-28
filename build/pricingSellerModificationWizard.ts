import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
function once(source: string, anchor: string, replacement: string, what: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`[pricingSellerModificationWizard] ${what}: ${count} coincidencias (esperada 1)`)
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  code = once(code,
    '  sellerEditRequestId?: string | null',
    '  sellerEditRequestId?: string | null\n  sellerModificationRateId?: string | null\n  modificationRequestId?: string | null',
    'wizard prop')
  code = once(code,
    '  sellerEditRequestId: null,',
    '  sellerEditRequestId: null,\n  sellerModificationRateId: null,\n  modificationRequestId: null,',
    'wizard prop default')

  code = once(code,
    "? (props.sellerEditRequestId ? 'Editar mi solicitud de tarifa' : 'Solicitud de tarifa para Pricing')",
    "? (props.sellerModificationRateId ? 'Solicitar modificación de tarifa' : props.sellerEditRequestId ? 'Editar mi solicitud de tarifa' : 'Solicitud de tarifa para Pricing')",
    'wizard title')
  code = once(code,
    "? (props.sellerEditRequestId ? 'Modifique las pantallas 1 a 4 de la solicitud enviada. Los cambios serán visibles para Pricing al guardar.' : 'Ventas completa únicamente las pantallas 0 a 4. Pricing recibe la solicitud y continúa desde la pantalla 5.')",
    "? (props.sellerModificationRateId ? 'Revise la cotización original y modifique las pantallas 1 a 4. Pricing recibirá una propuesta con las diferencias, sin alterar la tarifa vigente.' : props.sellerEditRequestId ? 'Modifique las pantallas 1 a 4 de la solicitud enviada. Los cambios serán visibles para Pricing al guardar.' : 'Ventas completa únicamente las pantallas 0 a 4. Pricing recibe la solicitud y continúa desde la pantalla 5.')",
    'wizard description')

  const helpers = `
interface SellerModificationSource {
  rateId: string
  reference: string
  revisionNumber: number
  form: Record<string, unknown>
  pickupLocations?: RatePickupLocationDto[]
  names?: Record<string, unknown>
  priority?: SellerRateRequestPriority
  supportEntityId?: string | null
  supportDocuments?: SupportDocument[]
  sellerContext?: {
    portHandlingMode?: string | null
    cargoReadyDate?: string | null
    consolidatedCargoLines?: Array<Record<string, unknown>>
    cargoDimensionStorageUnit?: 'in' | 'cm' | null
    cargoDimensionInputUnit?: 'mm' | 'cm' | 'm' | 'in' | null
    cargoWeightInputUnit?: 'kg' | 'lb' | null
    cargoVolumeUnit?: 'CFT' | 'CBM' | null
  }
}
interface SellerModificationComparison {
  field: string
  action: string
  original: string
  requested: string
}
interface PricingModificationWorkItem {
  rateId?: string | null
  kind?: string
  payload?: {
    form?: Record<string, unknown>
    pickupLocations?: RatePickupLocationDto[]
    supportDocuments?: SupportDocument[]
    sellerContext?: Record<string, unknown> & { portHandlingMode?: string | null }
    modification?: {
      changes?: SellerModificationComparison[]
      sourceRevisionNumber?: number
      quote?: string
    }
  }
}
const sellerModificationSource = ref<SellerModificationSource | null>(null)
const pricingModificationWorkItem = ref<PricingModificationWorkItem | null>(null)
const pricingModificationLoading = ref(false)
const pricingModificationApplied = ref(false)
const pricingModificationApplying = ref(false)
const pricingModificationChanges = computed(() =>
  (pricingModificationWorkItem.value?.payload?.modification?.changes ?? [])
    .map(raw => {
      const row = raw as unknown as Record<string, unknown>
      const read = (lower: string, upper: string) => String(row[lower] ?? row[upper] ?? '').trim()
      return {
        action: read('action', 'Action'),
        field: read('field', 'Field'),
        original: read('original', 'Original'),
        requested: read('requested', 'Requested'),
      }
    })
    .filter(change => change.action || change.field || change.original || change.requested)
    // Missing required LCL header values are not delete requests.
    .filter(change => !(change.action.toLowerCase() === 'eliminar'
      && ['tipo de equipo', 'modalidad', 'tipo de embarque', 'vigencia']
        .includes(change.field.toLowerCase())))
)
const modificationKeys = [
  'modality', 'shipmentMode', 'originId', 'destinationId', 'podId', 'equipmentId',
  'equipmentQuantity', 'incotermId', 'serviceIds', 'loadDate', 'validTo',
  'clientName', 'cargoCondition', 'dangerousCargo', 'nonStackable', 'overweight',
  'cargoValue', 'cargoWeightKg', 'cargoPackages', 'cargoPallets',
  'cargoLengthCm', 'cargoWidthCm', 'cargoHeightCm', 'storageDays',
  'cargoDescription', 'cargoObservations', 'pickupAddress', 'warehouseId',
  'inlandPickupLocation', 'inlandDeliveryLocation',
] as const
const modificationFieldLabels: Record<string, string> = {
  modality: 'Modalidad', shipmentMode: 'Tipo de embarque', originId: 'POL / Origen',
  destinationId: 'POE / Destino', podId: 'POD', equipmentId: 'Tipo de equipo',
  equipmentQuantity: 'Cantidad de equipos', incotermId: 'Incoterm',
  serviceIds: 'Servicios', loadDate: 'Carga lista', validTo: 'Vigencia',
  clientName: 'Cliente', cargoCondition: 'Condición de carga',
  dangerousCargo: 'Mercancía peligrosa', nonStackable: 'Carga no estibable',
  overweight: 'Sobrepeso', cargoValue: 'Valor de la carga',
  cargoWeightKg: 'Peso (kg)', cargoPackages: 'Bultos', cargoPallets: 'Tarimas',
  cargoLengthCm: 'Largo (cm)', cargoWidthCm: 'Ancho (cm)',
  cargoHeightCm: 'Alto (cm)', storageDays: 'Almacenaje',
  cargoDescription: 'Descripción', cargoObservations: 'Observaciones de la carga', pickupAddress: 'Recolección', warehouseId: 'Bodega',
  inlandPickupLocation: 'Ubicación transporte de recolección',
  inlandDeliveryLocation: 'Ubicación transporte de entrega',
}
function modificationComparable(value: unknown) {
  if (value == null) return ''
  if (Array.isArray(value)) return [...value].map(String).sort().join('|')
  if (typeof value === 'object') {
    const location = value as { address?: string; latitude?: number | null; longitude?: number | null }
    if (!location.address?.trim() && location.latitude == null && location.longitude == null) return ''
    return JSON.stringify({
      address: String(location.address ?? '').trim(),
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    })
  }
  return String(value).trim()
}
function modificationDisplay(key: string, value: unknown, isOriginal: boolean) {
  if ((key === 'inlandPickupLocation' || key === 'inlandDeliveryLocation')
    && value && typeof value === 'object') {
    const location = value as { address?: string; latitude?: number | null; longitude?: number | null }
    const address = String(location.address ?? '').trim()
    if (!address) return '—'
    return location.latitude != null && location.longitude != null
      ? address + ' (' + Number(location.latitude).toFixed(5) + ', ' + Number(location.longitude).toFixed(5) + ')'
      : address
  }
  const raw = modificationComparable(value)
  if (!raw) return '—'
  const names = isOriginal ? sellerModificationSource.value?.names : undefined
  const nameKey: Record<string, string> = {
    originId: 'originName', destinationId: 'destinationName', podId: 'podName',
    equipmentId: 'equipmentName', incotermId: 'incotermName', serviceIds: 'serviceNames',
  }
  if (isOriginal && nameKey[key] && names?.[nameKey[key]!])
    return modificationComparable(names[nameKey[key]!])
  if (!isOriginal) {
    const selected: Record<string, string> = {
      originId: displayValue(selectedOrigin.value),
      destinationId: displayValue(selectedDestination.value),
      podId: displayValue(selectedPod.value),
      equipmentId: displayValue(selectedEquipment.value),
      incotermId: displayValue(selectedIncoterm.value),
      serviceIds: effectiveServices.value.map(s => displayValue(s)).join(', '),
    }
    if (selected[key]) return selected[key]!
  }
  return raw
}
const sellerModificationPreview = computed<SellerModificationComparison[]>(() => {
  const source = sellerModificationSource.value
  if (!source) return []
  return modificationKeys.flatMap(key => {
    const original = source.form[key]
    const requested = form[key as keyof typeof form]
    if (['modality', 'shipmentMode', 'equipmentId', 'validTo'].includes(key)
      && !modificationComparable(requested) && modificationComparable(original)) return []
    if (modificationComparable(original) === modificationComparable(requested)) return []
    const before = modificationComparable(original), after = modificationComparable(requested)
    return [{
      field: modificationFieldLabels[key] || key,
      action: !before ? 'Agregar' : !after ? 'Eliminar' : 'Modificar',
      original: modificationDisplay(key, original, true),
      requested: modificationDisplay(key, requested, false),
    }]
  })
})
async function hydrateSellerModificationSource() {
  if (!props.sellerModificationRateId) return
  try {
    loadingExistingRate.value = true
    const res = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/seller-rates/' + encodeURIComponent(props.sellerModificationRateId) + '/modification-source',
      headers: { Accept: 'application/json' },
    })
    const source = unwrapApiResponse<SellerModificationSource>(res as never)
    if (!source?.form || !source.revisionNumber) throw new Error('No se pudo recuperar la tarifa vigente.')
    sellerModificationSource.value = source
    // Seller receives ONLY the four commercial screens, never Pricing's cost/sale amounts.
    Object.assign(form, source.form)
    // Hydrate exactly as the existing "Editar mi solicitud" flow, including
    // priority, pickup locations, attached files and requested cargo context.
    if (source.priority && ['Green', 'Yellow', 'Red'].includes(source.priority))
      rateRequestPriority.value = source.priority
    if (source.supportEntityId) supportEntityId.value = source.supportEntityId
    supportDocuments.value = Array.isArray(source.supportDocuments)
      ? source.supportDocuments.map(item => ({ ...item })) : []
    sellerPortHandlingMode.value = source.sellerContext?.portHandlingMode === 'Anticipado'
      || source.sellerContext?.portHandlingMode === 'Redestino'
      ? source.sellerContext.portHandlingMode : ''
    const equipment = [...catalogs.containers, ...catalogs.landEquipmentSizes, ...catalogs.landEquipmentTypes]
      .find(item => item.id === form.equipmentId)
    const meta = metadata(equipment)
    form.equipmentSize = String(meta?.size ?? '')
    form.equipmentType = equipmentHasSizes.value ? String(meta?.kind ?? '') : form.equipmentId
    pickupLocations.value = Array.isArray(source.pickupLocations)
      ? source.pickupLocations.map(item => ({ ...item })) : []
    await nextTick()
    // On LTL/LCL the line editor is the source of truth for totals.
    // Object.assign(form) alone loses saved lines because the cargo deep watcher
    // immediately derives the totals from an initial, empty placeholder row.
    const cargoContext = source.sellerContext
    const selectedUnit = String(cargoContext?.cargoDimensionInputUnit ?? source.form.miamiDimensionInputUnit ?? '')
    if (['mm', 'cm', 'm', 'in'].includes(selectedUnit)) selectConsolidatedDimensionUnit(selectedUnit)
    form.miamiWeightInputUnit = cargoContext?.cargoWeightInputUnit === 'lb'
      || (!cargoContext?.cargoWeightInputUnit && source.form.miamiWeightInputUnit === 'lb') ? 'lb' : 'kg'
    const savedUnit = cargoContext?.cargoDimensionStorageUnit
    const currentUnit = cargoDimensionUnit.value
    const lineScale = savedUnit === 'cm' && currentUnit === 'in' ? 1 / 2.54
      : savedUnit === 'in' && currentUnit === 'cm' ? 2.54 : 1
    const hydratedContext = lineScale !== 1 && Array.isArray(cargoContext?.consolidatedCargoLines)
      ? {
          ...cargoContext,
          consolidatedCargoLines: cargoContext.consolidatedCargoLines.map(line => ({
            ...line,
            length: Number(line.length || 0) * lineScale,
            width: Number(line.width || 0) * lineScale,
            height: Number(line.height || 0) * lineScale,
          })),
        }
      : cargoContext
    restoreSellerConsolidatedCargo(
      source.form,
      hydratedContext as Record<string, unknown> | undefined,
    )
    await nextTick()
    form.equipmentId = String(source.form.equipmentId ?? '')
    // The source quote already establishes modalidad and shipment mode.
    // Start amendments in Pantalla 3; previous screens remain available using Atrás.
    step.value = 3
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la cotización original para modificación.')
    await router.replace('/home')
  } finally {
    loadingExistingRate.value = false
  }
}
async function submitSellerModification() {
  const source = sellerModificationSource.value
  if (!source || saving.value) return
  if (!inlandServiceLocationsReady.value) {
    step.value = 3
    toastStore.error('Ubicación de transporte requerida',
      'Complete la dirección de los servicios de recolección y entrega. Ubicarlos en el mapa es opcional.')
    return
  }
  const originalDocumentIds = (source.supportDocuments ?? []).map(document => document.id).sort().join('|')
  const requestedDocumentIds = supportDocuments.value.map(document => document.id).sort().join('|')
  const changedHandling = sellerPortHandlingMode.value !== (source.sellerContext?.portHandlingMode || '')
  if (!sellerModificationPreview.value.length
    && originalDocumentIds === requestedDocumentIds && !changedHandling
    && JSON.stringify(pickupLocationsPayload()) === JSON.stringify(source.pickupLocations ?? [])) {
    toastStore.warning('Sin cambios', 'Modifique algún dato de las pantallas 1 a 4 antes de solicitar una revisión.')
    return
  }
  try {
    saving.value = true
    if (consolidatedCargoMode.value && !consolidatedCargoLinesReady.value) {
      step.value = 4
      toastStore.error('Complete las medidas de todas las líneas de carga antes de solicitar la modificación.')
      return
    }
    const requestedForm = JSON.parse(JSON.stringify(form)) as Record<string, unknown>
    for (const key of ['modality', 'shipmentMode', 'equipmentId', 'validTo']) {
      if (!modificationComparable(requestedForm[key]) && modificationComparable(source.form[key]))
        requestedForm[key] = source.form[key]
    }
    const body = {
      priority: rateRequestPriority.value,
      payload: {
        sourceRevisionNumber: source.revisionNumber,
        form: requestedForm,
        pickupLocations: pickupLocationsPayload(),
        supportEntityId: supportEntityId.value,
        supportDocuments: supportDocuments.value,
        sellerContext: {
          cargoReadyDate: form.loadDate,
          portHandlingMode: sellerPortHandlingMode.value || null,
          // The same payload as a normal seller request: preserve each package,
          // normalized kilogram weights, saved input dimensions and stackability.
          consolidatedCargoLines: consolidatedCargoMode.value
            ? consolidatedCargoLines.value.map(line => ({ ...line })) : [],
          cargoVolumeUnit: consolidatedCargoMode.value ? cargoVolumeUnit.value : null,
          cargoWeightInputUnit: consolidatedCargoMode.value ? form.miamiWeightInputUnit : null,
          cargoDimensionInputUnit: consolidatedCargoMode.value ? form.miamiDimensionInputUnit : null,
          cargoDimensionStorageUnit: consolidatedCargoMode.value
            ? (isUnitedStatesPol.value ? 'in' : 'cm') : null,
          physicalVolumeCbm: consolidatedCargoMode.value ? lclPhysicalCbm.value : null,
          billableVolumeCbm: consolidatedCargoMode.value ? lclDimensionalCbm.value : null,
          chargeableVolumeCbm: consolidatedCargoMode.value ? lclChargeableCbm.value : null,
        },
        requestContext: {
          originName: displayValue(selectedOrigin.value),
          destinationName: displayValue(selectedDestination.value),
          podName: displayValue(selectedPod.value),
          equipmentName: displayValue(selectedEquipment.value),
          incotermName: displayValue(selectedIncoterm.value),
          serviceNames: effectiveServices.value.map(s => displayValue(s)),
        },
      },
    }
    await callEndpoint<unknown, typeof body>({
      method: 'POST',
      path: '/api/pricing/seller-rates/' + encodeURIComponent(source.rateId) + '/modification-requests',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body })
    toastStore.success('Solicitud de modificación enviada',
      'Pricing recibió los cambios del wizard y la comparación con la revisión original.')
    clearPricingDraft(true)
    await router.push('/home')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo enviar la modificación a Pricing.')
  } finally {
    saving.value = false
  }
}
async function loadPricingModificationWorkItem() {
  if (!props.rateId || props.viewOnly) return
  const id = props.modificationRequestId || new URLSearchParams(window.location.search).get('modificationRequestId')
  if (!id) return
  pricingModificationLoading.value = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rate-requests/' + encodeURIComponent(id),
      headers: { Accept: 'application/json' },
    })
    const request = unwrapApiResponse<PricingModificationWorkItem>(response as never)
    if (request.kind !== 'Modification' || request.rateId !== props.rateId
      || !request.payload?.form) throw new Error('Esta solicitud no corresponde a la tarifa abierta.')
    pricingModificationWorkItem.value = request
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el comparativo de la solicitud de modificación.')
  } finally {
    pricingModificationLoading.value = false
  }
}
async function applyPricingModification() {
  const proposal = pricingModificationWorkItem.value?.payload?.form
  if (!proposal || !editingRate.value || props.viewOnly || pricingModificationApplied.value || pricingModificationApplying.value) return
  const originalFinancialLines = rateLines.value.map(line => ({ ...line }))
  pricingModificationApplying.value = true
  try {
  // Never import financial fields from the seller payload, nor save automatically.
  for (const key of modificationKeys) {
    if (!Object.prototype.hasOwnProperty.call(proposal, key)) continue
    if (['modality', 'shipmentMode', 'equipmentId', 'validTo'].includes(key)
      && !modificationComparable(proposal[key])) continue
    (form as unknown as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(proposal[key] ?? null))
  }
  // Legacy LTL amendments can omit equipmentId while keeping the trailer in
  // landContainers; do not erase the selected equipment when applying changes.
  if (String(proposal.shipmentMode ?? '').toUpperCase() === 'LTL' && !String(form.equipmentId ?? '').trim()) {
    const trailers = Array.isArray(proposal.landContainers) ? proposal.landContainers : []
    const selectedTrailer = trailers.find((item): item is Record<string, unknown> =>
      item != null && typeof item === 'object' && !Array.isArray(item)
      && typeof (item as Record<string, unknown>).containerTypeId === 'string')
    if (selectedTrailer?.containerTypeId) form.equipmentId = String(selectedTrailer.containerTypeId)
  }
  const equipment = [...catalogs.containers, ...catalogs.landEquipmentSizes, ...catalogs.landEquipmentTypes]
    .find(item => item.id === form.equipmentId)
  const meta = metadata(equipment)
  form.equipmentSize = String(meta?.size ?? '')
  form.equipmentType = equipmentHasSizes.value ? String(meta?.kind ?? '') : form.equipmentId
  await nextTick()
  if (typeof proposal.equipmentId === 'string' && proposal.equipmentId.trim())
    form.equipmentId = proposal.equipmentId
  const workPayload = pricingModificationWorkItem.value?.payload
  if (Array.isArray(workPayload?.pickupLocations))
    pickupLocations.value = workPayload.pickupLocations.map(pickup => ({ ...pickup }))
  if (Array.isArray(workPayload?.supportDocuments))
    supportDocuments.value = workPayload.supportDocuments.map(document => ({ ...document }))
  // Same cargo hydration as a new Sales request, including multiple LCL/LTL
  // lines, chosen dimensions and stackability. The original quote is untouched.
  if (['LCL', 'LTL'].includes(String(proposal.shipmentMode ?? '').toUpperCase()))
    restoreSellerConsolidatedCargo(proposal, workPayload?.sellerContext)
  await nextTick()
  // Modifying a quote does not replace its saved lines or financial detail IDs.
  if (originalFinancialLines.length) {
    rateLines.value = originalFinancialLines
    syncDeclaredCargoInsuranceOnEdit()
  }
  pricingModificationApplied.value = true
  if (!editingRate.value && hasInternationalTransportService.value) await searchApprovedRates()
  step.value = 5
  toastStore.info('Solicitud de Ventas cargada',
    'La propuesta solicitada por Ventas ya está en el borrador desde Pantalla 5. La tarifa original no se ha guardado ni enviado.')
  } catch (error) {
    toastStore.backendError(error, 'No fue posible cargar los cambios solicitados por Ventas.')
  } finally {
    pricingModificationApplying.value = false
  }
}
// The existing quote hydrates asynchronously after catalog loading. Do not
// display/price its old FCA values: apply the requested EXW and other seller
// inputs only AFTER the quote hydration completes, without persisting anything.
watch([pricingModificationWorkItem, editingRate, loadingExistingRate], () => {
  if (!props.modificationRequestId || !pricingModificationWorkItem.value
    || !editingRate.value || loadingExistingRate.value || pricingModificationApplied.value
    || pricingModificationApplying.value) return
  void applyPricingModification()
}, { immediate: true })
onMounted(() => { void loadPricingModificationWorkItem() })
`

  code = once(code,
    'async function hydrateSellerRequestEdit() {',
    helpers + '\nasync function hydrateSellerRequestEdit() {',
    'modification helpers')
  code = once(code,
    '  if (props.sellerEditRequestId) await hydrateSellerRequestEdit()',
    '  if (props.sellerModificationRateId) await hydrateSellerModificationSource()\n  if (props.sellerEditRequestId) await hydrateSellerRequestEdit()',
    'seller source initialization')
  code = once(code,
    'const scope = props.sellerEditRequestId',
    "const scope = props.sellerModificationRateId\n    ? 'seller:modify:' + props.sellerModificationRateId\n    : props.sellerEditRequestId",
    'isolated draft')
  code = once(code,
    'async function saveOpenRequest() {',
    'async function saveOpenRequest() {\n  if (props.sellerModificationRateId) return submitSellerModification()',
    'seller save action')
  code = once(code,
    "{{ saving ? 'Guardando…' : sellerEditRequestId ? 'Guardar cambios' : 'Enviar solicitud a Pricing' }}",
    "{{ saving ? 'Guardando…' : sellerModificationRateId ? 'Solicitar modificación a Pricing' : sellerEditRequestId ? 'Guardar cambios' : 'Enviar solicitud a Pricing' }}",
    'seller save button')


  code = once(code,
    '    void loadHaciendaExchangeRate(false)\n    syncDeclaredCargoInsuranceOnEdit()',
    "    void loadHaciendaExchangeRate(false)\n    if (!(props.modificationRequestId && rateLines.value.some(line => line.costDetailType === 'Insurance')))\n      syncDeclaredCargoInsuranceOnEdit()",
    'preserve edited insurance on Screen 7 revisit')

  // Older browser drafts were saved with a single empty cargo placeholder.
  // Reject those drafts so they cannot overwrite the original LTL/LCL rows
  // just hydrated from Pricing when the amendment page opens.
  code = once(code,
    'async function restorePricingDraft() {\\n  if (!pricingDraftEnabled.value) return'.replace('\\n', '\n'),
    `async function restorePricingDraft() {
  if (!pricingDraftEnabled.value) return
  if (props.sellerModificationRateId && consolidatedCargoMode.value) {
    try {
      const raw = localStorage.getItem(pricingDraftStorageKey.value)
      if (raw) {
        const draft = JSON.parse(raw) as { consolidatedCargoLines?: ConsolidatedCargoLineUi[] }
        const stored = sellerModificationSource.value?.sellerContext?.consolidatedCargoLines ?? []
        const lines = draft.consolidatedCargoLines ?? []
        if (stored.length && (!lines.length || !lines.some(line =>
          Number(line.length) > 0 || Number(line.width) > 0
          || Number(line.height) > 0 || Number(line.weightKg) > 0))) {
          clearPricingDraft(false)
          return
        }
      }
    } catch {
      clearPricingDraft(false)
      return
    }
  }`,
    'discard incomplete legacy amendment drafts')

  // When updating an already-generated quote for a reserved modification,
  // stay in the wizard instead of redirecting to the rate list. The worker
  // must still complete the linked request from the comparison screen.
  code = once(code,
    '  if (props.rateId) await hydrateExistingRate()',
    `  if (props.modificationRequestId) {
    // A seller-requested modification already has an auditable reason; it does
    // not require the manual edit wizard reason gate or Screen 3.
    updateReason.value = 'Solicitud de modificacion de vendedor'
    editReasonConfirmed.value = true
  }
  if (props.rateId) await hydrateExistingRate()
  if (props.modificationRequestId) {
    updateReason.value = 'Solicitud de modificacion de vendedor'
    editReasonConfirmed.value = true
    await nextTick()
    step.value = 5
    if (hasInternationalTransportService.value) await searchApprovedRates()
    step.value = 5
  }`,
    'start modification at pricing handoff')

  code = once(code,
    'async function saveRate() {',
    `async function saveRate() {
  if (props.modificationRequestId) updateReason.value = 'Solicitud de modificacion de vendedor'
  if (props.modificationRequestId && !pricingModificationApplied.value) {
    toastStore.warning('Modificación pendiente de aplicar',
      'Primero cargue los datos solicitados por Ventas antes de guardar una nueva revisión.')
    return
  }`,
    'modification application required before saving')
  // The update-reason payload, manual gate and hydration watcher are produced
  // by the later requirements/parity transforms. Their seller-modification
  // variants are now authored in those plugins, not patched here during
  // Vite's early (enforce: pre) stage.

  const saveRateStart = code.indexOf('async function saveRate() {')
  const savedRateNavigation = saveRateStart >= 0
    ? code.indexOf("    await router.replace({ name: 'pricing-rate-wizard', params: { rateId }, query: { mode: 'view' } })", saveRateStart) : -1
  if (savedRateNavigation < 0) throw new Error('[pricingSellerModificationWizard] Rate save navigation not found')
  const stayInRevision = `
    if (props.rateId && (props.modificationRequestId || new URLSearchParams(window.location.search).has('modificationRequestId'))) {
      // Saving the quote is not equivalent to closing the seller request.
      // The server requires explicit preparation of the exact persisted revision.
      const modificationId = props.modificationRequestId
        || new URLSearchParams(window.location.search).get('modificationRequestId')
      if (!modificationId) throw new Error('No se identificó la solicitud de modificación.')
      const savedRevision = await PricingService.getRate(rateId)
      const preparedRevisionNumber = await RateRequestLeaseService.prepareModification(
        modificationId, rateId, savedRevision.revisionNumber || 0)
      window.dispatchEvent(new CustomEvent('dhole:pricing:modification-prepared', {
        detail: { requestId: modificationId, preparedRevisionNumber },
      }))
      toastStore.success('Revisión guardada', 'Los cambios están listos. Envíe expresamente la revisión al vendedor para completar la solicitud.')
      await hydrateExistingRate()
      step.value = 8
      return
    }
`
  code = code.slice(0, savedRateNavigation) + stayInRevision + code.slice(savedRateNavigation)

  const comparisonPanel = `
    <section v-if="pricingModificationWorkItem" class="crystal-soft space-y-3 border border-amber-400/30 p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-black">Preparar la modificación solicitada</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ pricingModificationChanges.length }} diferencias de Ventas. El resumen completo de las pantallas 1–4 y el comparativo original/solicitado están encima del wizard.
          </p>
        </div>
        <DhButton variant="secondary" :disabled="pricingModificationApplied || !editingRate || loadingExistingRate" @click="applyPricingModification">
          {{ pricingModificationApplied ? 'Cambios cargados en borrador' : 'Cargar cambios solicitados y continuar en Pantalla 5' }}
        </DhButton>
      </div>
      <p class="text-xs text-amber-700 dark:text-amber-300">
        Cargar los valores no guarda ni envía la cotización. Revise los cargos y guarde una nueva revisión antes de enviar al vendedor.
      </p>
    </section>
`
  code = once(code,
    '<section class="crystal-panel min-h-[470px] p-5 md:p-8"',
    comparisonPanel + '\n    <section class="crystal-panel min-h-[470px] p-5 md:p-8"',
    'comparison inside pricing wizard')
  return code
}

export function pricingSellerModificationWizard(): Plugin {
  return {
    name: 'dhole-pricing-seller-modification-wizard',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
