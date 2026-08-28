from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Anchor not found: {label}')
    return text.replace(old, new, 1)


p = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
s = p.read_text(encoding='utf-8')

s = replace_once(s, '''  CircleCheck,
  Plane,''', '''  CircleCheck,
  ExternalLink,
  FileUp,
  Plane,''', 'icons')
s = replace_once(s, '''import { PricingService } from '@/core/services/pricingService'
import { useToastStore }''', '''import { PricingService } from '@/core/services/pricingService'
import { StorageService } from '@/core/services/storageService'
import { useToastStore }''', 'storage import')
s = replace_once(s, '''  kind?: string
}''', '''  kind?: string
  schedule?: string
  contacts?: string
  email?: string
  phone?: string
  salesExecutiveId?: string
}''', 'metadata fields')
s = replace_once(s, '''interface RateLine {''', '''interface SupportDocument {
  id: string
  category: string
  categoryLabel: string
  fileName: string
  sizeInBytes: number
}

interface RateLine {''', 'support interface')
s = replace_once(s, '''const destinationVatEnabled = ref(false)
const optionalVatEnabled = ref(false)
''', '''const destinationVatEnabled = ref(false)
const optionalVatEnabled = ref(false)
const supportEntityId = ref(crypto.randomUUID())
const supportDocuments = ref<SupportDocument[]>([])
const uploadingSupportKey = ref('')
const supportCategories = [
  { key: 'purchase-order', label: 'OC / Detalle de la carga' },
  { key: 'packing-list', label: 'Packing List (PL)' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'msds-tech-sheet', label: 'MSDS / Ficha técnica' },
] as const
const supportAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.xlsb'
''', 'support refs')
s = replace_once(s, '''  warehouses: [] as CatalogItemSelectDto[],
  countries: [] as CatalogItemSelectDto[],''', '''  warehouses: [] as CatalogItemSelectDto[],
  countries: [] as CatalogItemSelectDto[],
  clients: [] as CatalogItemSelectDto[],
  salesExecutives: [] as CatalogItemSelectDto[],''', 'commercial catalogs')
s = replace_once(s, '''  manualRate: false,
  clientName: '',
  executiveName: '',
''', '''  manualRate: false,
  clientId: '',
  clientName: '',
  executiveId: '',
  executiveName: '',
''', 'commercial ids')
s = replace_once(s, '''const stepTitles = [
  'Modalidad',
  'Embarque',
  'Ruta y equipo',
  'Tarifa',
  'Proveedor',
  'Carga',
  'Líneas',
]''', '''const stepTitles = [
  'Modalidad',
  'Embarque',
  'Ruta y equipo',
  'Carga',
  'Tarifa',
  'Proveedor',
  'Líneas',
  'Borrador',
]''', 'step titles')
s = replace_once(s, '''const warehouseOptions = computed(() => catalogs.warehouses.map((item) => ({
  value: item.id,
  label: item.label || displayValue(item) || item.code,
})))
''', '''const warehouseOptions = computed(() => catalogs.warehouses.map((item) => ({
  value: item.id,
  label: item.label || displayValue(item) || item.code,
})))
const clientOptions = computed(() => catalogs.clients.map((item) => ({ value: item.id, label: item.label || displayValue(item) })))
const salesExecutiveOptions = computed(() => catalogs.salesExecutives.map((item) => ({ value: item.id, label: item.label || displayValue(item) })))
''', 'commercial options')
s = replace_once(s, '''  if (step.value === 4) return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)
  if (step.value === 5) return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)
  if (step.value === 6) return true
  return true
})''', '''  if (step.value === 4) return true
  if (step.value === 5) return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)
  if (step.value === 6) return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)
  return true
})''', 'can next')

s = replace_once(s, '''      warehouses,
      countries,
      selectedCosts,''', '''      warehouses,
      countries,
      clients,
      salesExecutives,
      selectedCosts,''', 'load destructuring')
s = replace_once(s, '''      selectOptional('pricing-warehouses', 'warehouses', 'whs', 'fca-warehouses'),
      selectOptional('country-vat-rates', 'countries', 'country-tax-rates'),
      PricingService.selectCosts().catch(() => [] as CostSelectDto[]),''', '''      selectOptional('pricing-warehouses', 'warehouses', 'whs', 'fca-warehouses'),
      selectOptional('country-vat-rates', 'countries', 'country-tax-rates'),
      selectOptional('pricing-clients'),
      selectOptional('pricing-sales-executives'),
      PricingService.selectCosts().catch(() => [] as CostSelectDto[]),''', 'load promises')
s = replace_once(s, '''      countries,
      warehouses,
    })''', '''      countries,
      warehouses,
      clients,
      salesExecutives,
    })''', 'assign catalogs')
s = replace_once(s, '''  step.value = 5
}

function continueManual() {
  form.selectedImportRateId = ''
  form.manualRate = true
  step.value = 5
}''', '''  step.value = 6
}

function continueManual() {
  form.selectedImportRateId = ''
  form.manualRate = true
  step.value = 6
}''', 'rate navigation')
s = replace_once(s, '''async function next() {
  if (!canNext.value) return
  if (step.value === 3) await searchApprovedRates()
  if (step.value === 6) {
    await loadApplicableCosts()
    rebuildRateLines()
  }
  if (step.value < 7) step.value += 1
}''', '''async function next() {
  if (!canNext.value) return
  if (step.value === 4) await searchApprovedRates()
  if (step.value === 6) {
    await loadApplicableCosts()
    rebuildRateLines()
  }
  if (step.value < 8) step.value += 1
}''', 'next flow')

s = replace_once(s, '''function chooseCabys(item: CabysItem) {
  form.cabysCode = item.code
  form.cargoDescription = item.description
}

async function saveRate() {''', '''function chooseCabys(item: CabysItem) {
  form.cabysCode = item.code
  form.cargoDescription = item.description
}

function sourceImportTraceUrl(rate: ImportRateSelectDto) {
  const raw = String(rate.rawDataJson ?? '')
  const explicitUrl = raw.match(/https?:\\/\\/[^"'\\s\\\\]+/i)?.[0]
  return explicitUrl || `/pricing/imports/review/${rate.importBatchId}`
}

function openImportSource(rate: ImportRateSelectDto) {
  window.open(sourceImportTraceUrl(rate), '_blank', 'noopener,noreferrer')
}

async function uploadSupportDocument(category: string, categoryLabel: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    uploadingSupportKey.value = category
    const uploaded = await StorageService.uploadFile({
      file,
      sourceService: 'DholeWeb',
      entityType: 'PricingRequestSupport',
      entityId: supportEntityId.value,
      metadataJson: JSON.stringify({ category, categoryLabel, clientName: form.clientName || null }),
    })
    supportDocuments.value.push({
      id: uploaded.id,
      category,
      categoryLabel,
      fileName: uploaded.originalFileName,
      sizeInBytes: uploaded.sizeInBytes,
    })
    toastStore.success(`${categoryLabel}: archivo respaldado.`)
  } catch (error) {
    toastStore.backendError(error, `No se pudo subir ${categoryLabel}.`)
  } finally {
    uploadingSupportKey.value = ''
  }
}

async function removeSupportDocument(document: SupportDocument) {
  try {
    await StorageService.deleteFile(document.id)
    supportDocuments.value = supportDocuments.value.filter((item) => item.id !== document.id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el respaldo.')
  }
}

function supportSummaryText() {
  if (!supportDocuments.value.length) return ''
  return `Soportes Pricing ${supportEntityId.value}: ${supportDocuments.value.map((item) => `${item.categoryLabel}=${item.fileName}`).join(' | ')}`
}

async function saveOpenRequest() {
  const origin = selectedOrigin.value
  const poe = selectedDestination.value
  const equipment = selectedEquipment.value
  const incoterm = selectedIncoterm.value
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!origin || !poe || !equipment || !incoterm || !currency) {
    toastStore.error('Complete ruta, equipo, Incoterm y moneda antes de guardar la solicitud.')
    return
  }

  try {
    saving.value = true
    const equipmentName = displayValue(equipment)
    const supportText = supportSummaryText()
    const rateId = await PricingService.createRate({
      sourceImportFclRateId: null,
      agentId: null,
      agentName: null,
      agentCode: null,
      carrierId: null,
      carrierName: null,
      carrierCode: null,
      polId: origin.id,
      polName: displayValue(origin),
      polCode: origin.code,
      poeId: poe.id,
      poeName: displayValue(poe),
      poeCode: poe.code,
      podId: selectedPod.value?.id ?? null,
      podName: selectedPod.value ? displayValue(selectedPod.value) : null,
      podCode: selectedPod.value?.code ?? null,
      containerTypeId: equipment.id,
      containerTypeName: equipmentName,
      containerTypeCode: equipment.code,
      incotermId: incoterm.id,
      incotermName: displayValue(incoterm),
      incotermCode: incoterm.code,
      pickupAddress: ['EXW', 'FCA'].includes(selectedIncotermCode.value) ? form.pickupAddress.trim() || null : null,
      pickupLatitude: form.pickupLatitude,
      pickupLongitude: form.pickupLongitude,
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      clientName: form.clientName.trim() || null,
      executiveName: form.executiveName.trim() || null,
      freeDays: 0,
      validFrom: form.loadDate,
      validTo: addDaysIso(form.loadDate, 30),
      containerQuantity: form.equipmentQuantity,
      rateType: 'Spot',
      shipmentMode: shipmentModeForApi.value,
      containers: [{ containerTypeId: equipment.id, containerTypeName: equipmentName, containerTypeCode: equipment.code, quantity: form.equipmentQuantity }],
      totalPackages: 0,
      totalPallets: 0,
      totalWeightKg: 0,
      totalVolumeCbm: shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'Ltl' ? 0.001 : 0,
      cargoLines: form.cargoDescription || supportText ? [{
        description: [form.cabysCode ? `CABYS ${form.cabysCode}` : '', form.cargoDescription, form.cargoObservations, supportText].filter(Boolean).join(' · '),
        packages: 0, pallets: 0, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0,
      }] : [],
      details: [{
        costId: null,
        name: 'Solicitud pendiente de Pricing',
        costDetailType: 'Freight',
        costType: 'Variable',
        chargeBasis: defaultChargeBasis('Freight'),
        currencyId: currency.id,
        currencyName: displayValue(currency),
        currencyCode: currency.code,
        costAmount: 0,
        saleAmount: 0,
        quantity: shipmentModeForApi.value === 'Fcl' || shipmentModeForApi.value === 'Ftl' ? form.equipmentQuantity : 1,
        notes: supportText || 'Solicitud abierta pendiente de completar costos y proveedor.',
      }],
    })
    await PricingService.setRateStatus(rateId, { status: 'RequestedByClient' })
    const created = await PricingService.getRate(rateId)
    toastStore.success('Solicitud abierta guardada', `Seguimiento ${created.rateCode}. Pricing puede continuarla sin perder la solicitud.`)
    await router.push({ name: 'pricing-rates', query: { rateId } })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la solicitud abierta.')
  } finally {
    saving.value = false
  }
}

async function saveRate() {''', 'support and open request functions')

s = replace_once(s, '''              selectedWarehouse.value ? `WHS FCA: ${selectedWarehouse.value.label || displayValue(selectedWarehouse.value)}` : '',
            ].filter(Boolean).join(' · '),''', '''              selectedWarehouse.value ? `WHS FCA: ${selectedWarehouse.value.label || displayValue(selectedWarehouse.value)}` : '',
              supportSummaryText(),
            ].filter(Boolean).join(' · '),''', 'persist support trace')

s = replace_once(s, '''  optionalVatEnabled.value = false
  Object.assign(form, {''', '''  optionalVatEnabled.value = false
  supportEntityId.value = crypto.randomUUID()
  supportDocuments.value = []
  Object.assign(form, {''', 'reset support')
s = replace_once(s, '''    manualRate: false,
    clientName: '',
    executiveName: '',
''', '''    manualRate: false,
    clientId: '',
    clientName: '',
    executiveId: '',
    executiveName: '',
''', 'reset commercial ids')

s = replace_once(s, '''watch(
  () => form.destinationId,''', '''watch(
  () => form.clientId,
  (clientId) => {
    const client = findById(catalogs.clients, clientId)
    if (!client) return
    form.clientName = displayValue(client) || client.label
    const assignedExecutiveId = metadata(client)?.salesExecutiveId
    if (assignedExecutiveId && catalogs.salesExecutives.some((item) => item.id === assignedExecutiveId)) {
      form.executiveId = assignedExecutiveId
    }
  },
)

watch(
  () => form.executiveId,
  (executiveId) => {
    const executive = findById(catalogs.salesExecutives, executiveId)
    if (executive) form.executiveName = displayValue(executive) || executive.label
  },
)

watch(
  () => form.destinationId,''', 'commercial watches')
s = replace_once(s, '''    if (step.value < 5 || !agentId) return
    await loadApplicableCosts()
    if (step.value === 7) rebuildRateLines()''', '''    if (step.value < 6 || !agentId) return
    await loadApplicableCosts()
    if (step.value >= 7) rebuildRateLines()''', 'provider watcher')

# Template: 8 steps and temporary commercial catalogs.
s = replace_once(s, '''    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 xl:grid-cols-7">''', '''    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 xl:grid-cols-8">''', 'stepbar grid')
s = replace_once(s, '''            <!-- Fila 1: se mantienen editables hasta que el maestro de clientes/ejecutivos se cierre. -->
            <div class="grid gap-4 md:grid-cols-2">
              <DhInput v-model="form.clientName" label="Nombre del cliente" placeholder="Escriba el nombre del cliente" autocomplete="off" />
              <DhInput v-model="form.executiveName" label="Ejecutivo comercial" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />
            </div>''', '''            <div class="grid gap-4 md:grid-cols-2">
              <DhSelect v-if="clientOptions.length" v-model="form.clientId" label="Cliente" placeholder="Seleccione cliente" :options="clientOptions" />
              <DhInput v-else v-model="form.clientName" label="Nombre del cliente" placeholder="Escriba el nombre del cliente" autocomplete="off" />
              <DhSelect v-if="salesExecutiveOptions.length" v-model="form.executiveId" label="Ejecutivo comercial" placeholder="Seleccione ejecutivo" :options="salesExecutiveOptions" />
              <DhInput v-else v-model="form.executiveName" label="Ejecutivo comercial" placeholder="Escriba el nombre del ejecutivo" autocomplete="off" />
            </div>
            <p class="text-[11px] font-bold text-[var(--dh-text-muted)]">Clientes y ejecutivos usan catálogos temporales de Config para evitar duplicar el futuro módulo Comercial.</p>''', 'commercial selects')

s = replace_once(s, '''            <DhInput
              v-model="form.pickupAddress"''', '''            <div v-if="selectedIncotermCode === 'FCA' && selectedWarehouse" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-soft)]">
              <p class="text-sm font-black text-[var(--dh-text)]">{{ selectedWarehouse.label || displayValue(selectedWarehouse) }}</p>
              <p class="mt-2"><strong>Dirección:</strong> {{ warehouseAddress(selectedWarehouse) || 'Sin dirección' }}</p>
              <p v-if="metadata(selectedWarehouse)?.schedule" class="mt-1"><strong>Horario:</strong> {{ metadata(selectedWarehouse)?.schedule }}</p>
              <p v-if="metadata(selectedWarehouse)?.contacts" class="mt-1"><strong>Contactos:</strong> {{ metadata(selectedWarehouse)?.contacts }}</p>
              <p v-if="metadata(selectedWarehouse)?.email" class="mt-1"><strong>Email:</strong> {{ metadata(selectedWarehouse)?.email }}</p>
              <p v-if="metadata(selectedWarehouse)?.phone" class="mt-1"><strong>Teléfono:</strong> {{ metadata(selectedWarehouse)?.phone }}</p>
            </div>
            <DhButton v-if="selectedIncotermCode === 'FCA'" variant="ghost" @click="router.push({ name: 'config-catalogs' })">Administrar / crear WHS en Config</DhButton>

            <DhInput
              v-model="form.pickupAddress"''', 'warehouse details')

# Move Carga to screen 4, Tarifa to 5, Proveedor to 6.
s = replace_once(s, '''        <div v-else-if="step === 4" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 4</p>
            <h2 class="crystal-title">Tarifas preaprobadas disponibles</h2>''', '''        <div v-else-if="step === 5" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 5</p>
            <h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>''', 'rate screen')
s = replace_once(s, '''                  <DhBadge variant="success">Aprobada</DhBadge>''', '''                  <DhBadge variant="success">Pre-aprobada</DhBadge>''', 'preapproved badge')
s = replace_once(s, '''                <p class="mt-3 text-left text-xs font-black" :class="rate.freeDays > 0 ? 'text-emerald-600' : 'text-amber-600'">
                  {{ rate.freeDays > 0 ? `Incluye ${rate.freeDays} días libres` : 'No incluye días libres; deberá ingresarlos en la pantalla 5' }}
                </p>''', '''                <p class="mt-3 text-left text-xs font-black" :class="rate.freeDays > 0 ? 'text-emerald-600' : 'text-amber-600'">
                  {{ rate.freeDays > 0 ? `Incluye ${rate.freeDays} días libres` : 'No incluye días libres; deberá ingresarlos en Proveedor' }}
                </p>
                <span class="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--dh-primary)] hover:underline" role="link" tabindex="0" @click.stop="openImportSource(rate)" @keyup.enter.stop="openImportSource(rate)">
                  <ExternalLink class="h-3.5 w-3.5" /> Ver correo / fuente de la tarifa
                </span>''', 'source link')
s = replace_once(s, '''            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">Puede continuar y capturar el flete manualmente.</p>
            <DhButton class="mt-5" @click="continueManual">Continuar de manera manual</DhButton>''', '''            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">Puede guardar la solicitud como Abierta para que Pricing la procese después, o continuar de manera manual.</p>
            <div class="mt-5 flex flex-wrap justify-center gap-2">
              <DhButton :disabled="saving" @click="saveOpenRequest">{{ saving ? 'Guardando…' : 'Guardar solicitud abierta' }}</DhButton>
              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>
            </div>''', 'open request button')
s = replace_once(s, '''        <div v-else-if="step === 5" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 5</p>
            <h2 class="crystal-title">Proveedor y flete internacional</h2>''', '''        <div v-else-if="step === 6" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 6</p>
            <h2 class="crystal-title">Proveedor y flete internacional</h2>''', 'provider screen')
s = replace_once(s, '''        <div v-else-if="step === 6" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 6</p>
            <h2 class="crystal-title">Descripción de carga y CABYS</h2>''', '''        <div v-else-if="step === 4" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 4</p>
            <h2 class="crystal-title">Descripción de carga y CABYS</h2>''', 'cargo screen')

s = replace_once(s, '''          <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-5">''', '''          <div class="crystal-soft space-y-3 p-4 md:p-5">
            <div>
              <p class="font-black">Documentos de respaldo de la solicitud</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Imágenes, PDF, Word y Excel quedan guardados en Storage y vinculados a esta solicitud.</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label v-for="category in supportCategories" :key="category.key" class="crystal-flag cursor-pointer">
                <FileUp class="h-4 w-4" />
                <span>{{ uploadingSupportKey === category.key ? 'Subiendo…' : category.label }}</span>
                <input class="hidden" type="file" :accept="supportAccept" :disabled="Boolean(uploadingSupportKey)" @change="uploadSupportDocument(category.key, category.label, $event)" />
              </label>
            </div>
            <div v-if="supportDocuments.length" class="grid gap-2 md:grid-cols-2">
              <div v-for="document in supportDocuments" :key="document.id" class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-xs">
                <div class="min-w-0"><p class="font-black">{{ document.categoryLabel }}</p><p class="truncate text-[var(--dh-text-muted)]">{{ document.fileName }}</p></div>
                <button type="button" class="font-black text-red-500" @click="removeSupportDocument(document)">Eliminar</button>
              </div>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-5">''', 'support upload ui')
s = replace_once(s, '''        <div v-else class="crystal-lines-stage space-y-6">''', '''        <div v-else-if="step === 7" class="crystal-lines-stage space-y-6">''', 'lines condition')

s = replace_once(s, '''          </div>
        </div>
      </template>
    </section>''', '''          </div>
        </div>

        <div v-else class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 8</p>
            <h2 class="crystal-title">Visualización borrador de la tarifa</h2>
            <p class="crystal-description">Revise los datos antes de crear la tarifa. Atrás permite corregir cualquier pantalla.</p>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="crystal-soft p-5">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Cliente y operación</p>
              <p class="mt-3 text-lg font-black">{{ form.clientName || 'Cliente sin definir' }}</p>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Ejecutivo: {{ form.executiveName || 'Sin asignar' }}</p>
              <p class="mt-4 text-sm font-bold">{{ displayValue(selectedOrigin) }} → {{ displayValue(selectedDestination) }}<span v-if="selectedPod"> → {{ displayValue(selectedPod) }}</span></p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}</p>
            </div>
            <div class="crystal-soft p-5">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Resumen comercial</p>
              <p class="mt-3 text-sm font-bold">Proveedor: {{ displayValue(selectedCarrier) || 'Sin proveedor' }}</p>
              <p class="mt-1 text-sm font-bold">Agente: {{ displayValue(selectedAgent) || 'Sin agente' }}</p>
              <div class="mt-4 grid grid-cols-2 gap-2 text-sm"><span>Costo <strong class="block">{{ formatMoney(totalCost, displayValue(selectedCurrency) || 'USD') }}</strong></span><span>Venta <strong class="block">{{ formatMoney(totalSale, displayValue(selectedCurrency) || 'USD') }}</strong></span><span>Utilidad <strong class="block">{{ formatMoney(totalUtility, displayValue(selectedCurrency) || 'USD') }}</strong></span><span>Margen <strong class="block">{{ totalMarginPercentage.toFixed(2) }}%</strong></span></div>
            </div>
            <div class="crystal-soft p-5 lg:col-span-2">
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Carga y respaldos</p>
              <p class="mt-3 text-sm font-semibold">{{ form.cargoDescription || 'Sin descripción adicional' }}</p>
              <p v-if="form.cabysCode" class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">CABYS {{ form.cabysCode }}</p>
              <p class="mt-2 text-xs font-bold text-[var(--dh-text-muted)]">{{ supportDocuments.length }} documento{{ supportDocuments.length === 1 ? '' : 's' }} de respaldo en Storage.</p>
            </div>
          </div>
        </div>
      </template>
    </section>''', 'preview step')
s = replace_once(s, '''      <div class="text-xs font-black tracking-[0.14em] text-[var(--dh-text-muted)]">{{ step }} / 7</div>
      <DhButton v-if="step < 7 && ![1, 2, 4].includes(step)" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>
      <DhButton v-else :disabled="saving || !includedLines.length" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : 'Crear tarifa' }}</DhButton>''', '''      <div class="text-xs font-black tracking-[0.14em] text-[var(--dh-text-muted)]">{{ step }} / 8</div>
      <DhButton v-if="step < 8 && ![1, 2, 5].includes(step)" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>
      <DhButton v-else-if="step === 8" :disabled="saving || !includedLines.length" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : 'Crear tarifa' }}</DhButton>
      <span v-else class="text-xs font-bold text-[var(--dh-text-muted)]">Seleccione una alternativa para continuar</span>''', 'footer')

p.write_text(s, encoding='utf-8')
