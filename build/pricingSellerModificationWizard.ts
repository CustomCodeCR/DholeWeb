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
    '  sellerEditRequestId?: string | null\n  sellerModificationRateId?: string | null',
    'wizard prop')
  code = once(code,
    '  sellerEditRequestId: null,',
    '  sellerEditRequestId: null,\n  sellerModificationRateId: null,',
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
    sellerContext?: { portHandlingMode?: string | null }
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
const modificationKeys = [
  'modality', 'shipmentMode', 'originId', 'destinationId', 'podId', 'equipmentId',
  'equipmentQuantity', 'incotermId', 'serviceIds', 'loadDate', 'validTo',
  'clientName', 'cargoCondition', 'dangerousCargo', 'nonStackable', 'overweight',
  'cargoValue', 'cargoWeightKg', 'cargoPackages', 'cargoPallets',
  'cargoLengthCm', 'cargoWidthCm', 'cargoHeightCm', 'storageDays',
  'cargoDescription', 'pickupAddress', 'warehouseId',
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
  cargoDescription: 'Descripción', pickupAddress: 'Recolección', warehouseId: 'Bodega',
}
function modificationComparable(value: unknown) {
  if (value == null) return ''
  if (Array.isArray(value)) return [...value].map(String).sort().join('|')
  return String(value).trim()
}
function modificationDisplay(key: string, value: unknown, isOriginal: boolean) {
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
    restoreSellerConsolidatedCargo(
      source.form,
      source.sellerContext as Record<string, unknown> | undefined,
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
    const body = {
      priority: rateRequestPriority.value,
      payload: {
        sourceRevisionNumber: source.revisionNumber,
        form: JSON.parse(JSON.stringify(form)),
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
  const id = new URLSearchParams(window.location.search).get('modificationRequestId')
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
  if (!proposal || !editingRate.value || props.viewOnly) return
  // Never import financial fields from the seller payload, nor save automatically.
  for (const key of modificationKeys) {
    if (Object.prototype.hasOwnProperty.call(proposal, key))
      (form as unknown as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(proposal[key] ?? null))
  }
  const equipment = [...catalogs.containers, ...catalogs.landEquipmentSizes, ...catalogs.landEquipmentTypes]
    .find(item => item.id === form.equipmentId)
  const meta = metadata(equipment)
  form.equipmentSize = String(meta?.size ?? '')
  form.equipmentType = equipmentHasSizes.value ? String(meta?.kind ?? '') : form.equipmentId
  await nextTick()
  form.equipmentId = String(proposal.equipmentId ?? form.equipmentId)
  const workPayload = pricingModificationWorkItem.value?.payload
  if (Array.isArray(workPayload?.pickupLocations))
    pickupLocations.value = workPayload.pickupLocations.map(pickup => ({ ...pickup }))
  if (Array.isArray(workPayload?.supportDocuments))
    supportDocuments.value = workPayload.supportDocuments.map(document => ({ ...document }))
  pricingModificationApplied.value = true
  toastStore.info('Propuesta aplicada en pantalla',
    'Revise todos los proveedores, costos y recargos antes de guardar la nueva revisión. Aún no se modificó la tarifa persistida.')
}
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

  const comparisonPanel = `
    <section v-if="pricingModificationWorkItem" class="crystal-soft space-y-3 border border-amber-400/30 p-4 md:p-5">
      <h3 class="font-black">Comparativo de la solicitud de Ventas</h3>
      <p class="text-xs text-[var(--dh-text-muted)]">Revisión original: {{ pricingModificationWorkItem.payload?.modification?.sourceRevisionNumber }}. Los valores del vendedor no están aplicados todavía.</p>
      <div class="max-h-80 overflow-auto rounded-xl border border-[var(--dh-border)]">
        <table class="w-full min-w-[660px] text-left text-sm">
          <thead><tr><th class="p-3">Cambio</th><th class="p-3">Cotización original</th><th class="p-3">Solicitado por Ventas</th></tr></thead>
          <tbody><tr v-for="(change, index) in pricingModificationWorkItem.payload?.modification?.changes ?? []" :key="index" class="border-t border-[var(--dh-border)]">
            <td class="p-3 font-bold">{{ change.action }} · {{ change.field }}</td>
            <td class="p-3 text-[var(--dh-text-muted)]">{{ change.original }}</td>
            <td class="p-3 font-semibold">{{ change.requested }}</td>
          </tr></tbody>
        </table>
      </div>
      <DhButton variant="secondary" :disabled="pricingModificationApplied" @click="applyPricingModification">
        {{ pricingModificationApplied ? 'Datos cargados en el formulario' : 'Cargar datos solicitados en el wizard' }}
      </DhButton>
      <p v-if="pricingModificationWorkItem.payload?.sellerContext?.portHandlingMode" class="text-sm font-semibold">Muellaje solicitado por Ventas: {{ pricingModificationWorkItem.payload.sellerContext.portHandlingMode }}</p>
      <p class="text-xs text-amber-700 dark:text-amber-300">Compruebe importes, recargos, proveedores y términos. Guardar una nueva revisión y reenviarla al vendedor son pasos separados.</p>
    </section>
`
  code = once(code,
    '<div v-if="loadingExistingRate" class="crystal-soft p-5 text-sm font-black">',
    comparisonPanel + '\n    <div v-if="loadingExistingRate" class="crystal-soft p-5 text-sm font-black">',
    'comparison panels')
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
