<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { PricingService } from '@/core/services/pricingService'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'
import type {
  CostSelectDto,
  CreateRateDetailRequest,
  CreateRateRequest,
  RateServiceDto,
} from '@/core/interfaces/pricing'
import { useToastStore } from '@/core/stores/toastStore'
import {
  LclService,
  type CreateOwnLclPayload,
  type LclCargoCalculation,
  type LclRateSource,
  type LclRouteRules,
} from '@/modules/pricing/services/lclService'

interface CargoLine {
  description: string
  units: number
  pallets: number
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

interface QuoteLine extends CreateRateDetailRequest {
  source: 'LCL' | 'Ruta' | 'Costo'
}

const router = useRouter()
const toast = useToastStore()
const activeView = ref<'quote' | 'own'>('quote')
const step = ref(1)
const loading = ref(true)
const saving = ref(false)
const calculating = ref(false)
const sourceLoading = ref(false)

const carriers = ref<CatalogItemDto[]>([])
const pols = ref<CatalogItemDto[]>([])
const poes = ref<CatalogItemDto[]>([])
const pods = ref<CatalogItemDto[]>([])
const containerTypes = ref<CatalogItemDto[]>([])
const currencies = ref<CatalogItemDto[]>([])
const incoterms = ref<CatalogItemDto[]>([])
const services = ref<CatalogItemDto[]>([])
const ownSources = ref<LclRateSource[]>([])
const coloaderSources = ref<LclRateSource[]>([])
const routeRules = ref<LclRouteRules | null>(null)
const cargoCalculation = ref<LclCargoCalculation | null>(null)
const quoteLines = ref<QuoteLine[]>([])
const operationalCosts = ref<CostSelectDto[]>([])

const quote = reactive({
  clientName: '',
  executiveName: '',
  polId: '',
  poeId: '',
  podId: '',
  incotermId: '',
  containerTypeId: '',
  serviceIds: [] as string[],
  sourceType: 'Own' as 'Own' | 'Coloader',
  sourceId: '',
  destinationRule: 'San José, Costa Rica',
  sets: 1,
  hbl: 1,
  pickupAmount: 0,
  bunkerAmount: 280,
  validFrom: todayIso(),
  validTo: addDaysIso(30),
})

const cargoLines = ref<CargoLine[]>([
  { description: '', units: 1, pallets: 1, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0 },
])

const ownForm = reactive({
  bookingNumber: '',
  etd: todayIso(),
  carrierId: '',
  polId: '',
  poeId: '',
  containerTypeId: '',
  maxCbm: 0,
  oceanFreightAmount: 0,
  currencyId: '',
  defaultLandFreightAmount: 2140,
  defaultBunkerAmount: 280,
  truckCapacityCbm: 95,
})

const selectedPol = computed(() => findItem(pols.value, quote.polId))
const selectedPoe = computed(() => findItem(poes.value, quote.poeId))
const selectedPod = computed(() => findItem(pods.value, quote.podId))
const selectedIncoterm = computed(() => findItem(incoterms.value, quote.incotermId))
const selectedContainer = computed(() => findItem(containerTypes.value, quote.containerTypeId))
const selectedSource = computed(() => {
  const rows = quote.sourceType === 'Own' ? ownSources.value : coloaderSources.value
  return rows.find((row) => row.id === quote.sourceId) ?? null
})
const selectedCurrency = computed(() => {
  const source = selectedSource.value
  return source ? currencies.value.find((item) => item.id === source.currencyId) ?? null : null
})
const selectedServices = computed<RateServiceDto[]>(() =>
  quote.serviceIds
    .map((id) => findItem(services.value, id))
    .filter((item): item is CatalogItemDto => !!item)
    .map((item) => ({ id: item.id, name: item.name, code: item.code })),
)
const incotermCode = computed(() => selectedIncoterm.value?.code?.toUpperCase() ?? '')
const totalPallets = computed(() => cargoLines.value.reduce((sum, line) => sum + number(line.pallets), 0))
const totalPackages = computed(() => cargoLines.value.reduce((sum, line) => sum + number(line.units), 0))
const totalWeightKg = computed(() => cargoLines.value.reduce((sum, line) => sum + number(line.weightKg), 0))
const totalCost = computed(() => quoteLines.value.reduce((sum, line) => sum + number(line.costAmount), 0))
const totalSale = computed(() => quoteLines.value.reduce((sum, line) => sum + number(line.saleAmount), 0))
const utility = computed(() => totalSale.value - totalCost.value)
const margin = computed(() => (totalSale.value > 0 ? (utility.value / totalSale.value) * 100 : 0))
const sourceOptions = computed(() => quote.sourceType === 'Own' ? ownSources.value : coloaderSources.value)

watch(() => quote.sourceType, () => { quote.sourceId = '' })
watch(() => quote.sourceId, () => {
  if (selectedSource.value) quote.bunkerAmount = selectedSource.value.defaultBunkerAmount || 280
})
watch(() => quote.podId, () => inferDestinationRule())

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function toUtcDate(value: string) {
  return value ? `${value}T12:00:00.000Z` : new Date().toISOString()
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(number(value))
}

function findItem(rows: CatalogItemDto[], id: string) {
  return rows.find((item) => item.id === id) ?? null
}

function normalized(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function addCargoLine() {
  cargoLines.value.push({ description: '', units: 1, pallets: 1, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0 })
}

function removeCargoLine(index: number) {
  if (cargoLines.value.length === 1) return
  cargoLines.value.splice(index, 1)
}

async function loadCatalog(slug: string) {
  try {
    return (await CatalogItemsService.getByGroupSlug(slug)).filter((item) => item.isActive)
  } catch {
    return [] as CatalogItemDto[]
  }
}

async function loadAll() {
  loading.value = true
  try {
    const [carrierRows, polRows, poeRows, podRows, containerRows, currencyRows, incotermRows, serviceRows, rules] = await Promise.all([
      loadCatalog('carriers'),
      loadCatalog('pol'),
      loadCatalog('poe'),
      loadCatalog('pod'),
      loadCatalog('container-types'),
      loadCatalog('currencies'),
      loadCatalog('incoterms'),
      loadCatalog('services'),
      LclService.getRouteRules(),
    ])
    carriers.value = carrierRows
    pols.value = polRows
    poes.value = poeRows
    pods.value = podRows
    containerTypes.value = containerRows
    currencies.value = currencyRows
    incoterms.value = incotermRows
    services.value = serviceRows
    routeRules.value = rules

    const usd = currencyRows.find((item) => item.code.toUpperCase() === 'USD')
    if (usd) ownForm.currencyId = usd.id
    const shanghai = polRows.find((item) => normalized(item.name).includes('shanghai'))
    const balboa = poeRows.find((item) => normalized(item.name).includes('balboa'))
    if (shanghai) ownForm.polId = shanghai.id
    if (balboa) ownForm.poeId = balboa.id

    await loadSources()
  } finally {
    loading.value = false
  }
}

async function loadSources() {
  sourceLoading.value = true
  try {
    const [own, coloaders] = await Promise.all([
      LclService.listRateSources({ sourceType: 'Own', approvedOnly: true }),
      LclService.listRateSources({ sourceType: 'Coloader', approvedOnly: true }),
    ])
    ownSources.value = own
    coloaderSources.value = coloaders
  } catch (error) {
    console.error(error)
    ownSources.value = []
    coloaderSources.value = []
  } finally {
    sourceLoading.value = false
  }
}

function inferDestinationRule() {
  const pod = normalized(selectedPod.value?.name)
  if (pod.includes('panama') || pod.includes('colon') || pod.includes('balboa')) quote.destinationRule = 'CFZ Panama'
  else if (pod.includes('nicaragua') || pod.includes('managua')) quote.destinationRule = 'Managua, Nicaragua'
  else if (pod.includes('honduras') || pod.includes('sula')) quote.destinationRule = 'San Pedro Sula, Honduras'
  else if (pod.includes('guatemala')) quote.destinationRule = 'Ciudad de Guatemala, Guatemala'
  else if (pod.includes('salvador')) quote.destinationRule = 'San Salvador, El Salvador'
  else if (pod.includes('costa rica') || pod.includes('caldera') || pod.includes('limon') || pod.includes('moin') || pod.includes('san jose')) quote.destinationRule = 'San José, Costa Rica'
}

async function calculateCargo() {
  calculating.value = true
  try {
    cargoCalculation.value = await LclService.calculateCargo(
      cargoLines.value.map((line) => ({
        units: number(line.units),
        pallets: number(line.pallets),
        weightKg: number(line.weightKg),
        lengthCm: number(line.lengthCm),
        widthCm: number(line.widthCm),
        heightCm: number(line.heightCm),
      })),
      routeRules.value?.kgPerCbm ?? 500,
    )
  } finally {
    calculating.value = false
  }
}

function validateStep(target: number) {
  if (target === 1 && (!quote.clientName.trim() || !quote.executiveName.trim() || !quote.polId || !quote.poeId || !quote.podId || !quote.incotermId || !quote.containerTypeId)) {
    toast.error('LCL', 'Complete Cliente, Ejecutivo, POL, POE, POD, Incoterm y tipo de contenedor.')
    return false
  }
  if (target === 2 && !cargoLines.value.some((line) => number(line.weightKg) > 0 || (number(line.lengthCm) > 0 && number(line.widthCm) > 0 && number(line.heightCm) > 0))) {
    toast.error('LCL', 'Ingrese peso o dimensiones de la carga.')
    return false
  }
  if (target === 3 && !quote.sourceId) {
    toast.error('LCL', 'Seleccione una tarifa LCL propia o un coloader aprobado.')
    return false
  }
  return true
}

async function nextStep() {
  if (!validateStep(step.value)) return
  if (step.value === 2) await calculateCargo()
  if (step.value === 3) await buildQuoteLines()
  step.value = Math.min(5, step.value + 1)
}

function previousStep() {
  step.value = Math.max(1, step.value - 1)
}

function quantityForCost(cost: CostSelectDto) {
  const cbm = cargoCalculation.value?.chargeableCbm ?? 0
  switch (cost.chargeBasis) {
    case 'PerCbm':
    case 'PerChargeableCbm': return cbm
    case 'PerKg': return totalWeightKg.value
    case 'Per100Kg': return totalWeightKg.value / 100
    case 'PerTon': return totalWeightKg.value / 1000
    case 'PerPallet': return totalPallets.value
    case 'PerPackage': return totalPackages.value
    case 'PerDocument': {
      const text = normalized(`${cost.name} ${cost.notes ?? ''}`)
      if (text.includes('set')) return number(quote.sets) || 1
      if (text.includes('hbl') || text.includes('bl')) return number(quote.hbl) || 1
      return 1
    }
    default: return 1
  }
}

function makeLine(
  name: string,
  amount: number,
  quantity: number,
  chargeBasis: CreateRateDetailRequest['chargeBasis'],
  detail: CreateRateDetailRequest['costDetailType'],
  source: QuoteLine['source'],
  notes?: string,
): QuoteLine {
  const rateSource = selectedSource.value!
  const total = number(amount) * number(quantity)
  return {
    costId: null,
    name,
    costDetailType: detail,
    costType: 'Variable',
    chargeBasis,
    currencyId: rateSource.currencyId,
    currencyName: rateSource.currencyName,
    currencyCode: rateSource.currencyCode,
    costAmount: Number(total.toFixed(2)),
    saleAmount: Number(total.toFixed(2)),
    quantity: 1,
    notes,
    source,
  }
}

async function buildQuoteLines() {
  const source = selectedSource.value
  const calc = cargoCalculation.value
  const rules = routeRules.value
  if (!source || !calc || !rules) return

  const cbm = calc.freightChargeableCbm
  const lines: QuoteLine[] = []
  lines.push(makeLine(
    source.sourceType === 'Own' ? 'LCL propio · Base Shanghai → Balboa' : `LCL coloader · ${source.providerName || source.carrierName}`,
    source.baseRatePerCbm,
    cbm,
    'PerChargeableCbm',
    'Freight',
    'LCL',
    source.bookingNumber ? `Booking ${source.bookingNumber}${source.etd ? ` · ETD ${source.etd.slice(0, 10)}` : ''}` : undefined,
  ))

  if (source.sourceType === 'Own') {
    const cfz = rules.destinations.find((row) => row.destination === 'CFZ Panama')?.rates ?? {}
    const portCode = (selectedPol.value?.code || selectedPol.value?.name || '').toUpperCase()
    const portKey = Object.keys(cfz).find((key) => portCode.includes(key) || normalized(selectedPol.value?.name).includes(normalized(key)))
    const shanghai = cfz.SHANGHAI ?? 0
    const originRate = portKey ? cfz[portKey] ?? shanghai : shanghai
    const originDelta = Math.max(0, originRate - shanghai)
    if (originDelta > 0) {
      lines.push(makeLine(`Diferencial origen ${selectedPol.value?.name} → Shanghai`, originDelta, cbm, 'PerChargeableCbm', 'OriginCharge', 'Ruta', 'Matriz CNCA-023/#048'))
    }

    if (quote.destinationRule === 'San José, Costa Rica') {
      const land = source.defaultLandFreightAmount || rules.costaRica.landFreightAmount
      const bunker = number(quote.bunkerAmount)
      const capacity = source.truckCapacityCbm || rules.costaRica.truckCapacityCbm || 95
      lines.push(makeLine('Flete terrestre Balboa → Costa Rica', land / capacity, cbm, 'PerChargeableCbm', 'InlandTransport', 'Ruta', `${money(land)} / ${capacity} CBM`))
      lines.push(makeLine('Bunker terrestre', bunker / capacity, cbm, 'PerChargeableCbm', 'InlandTransport', 'Ruta', `${money(bunker)} / ${capacity} CBM · editable`))
    }
  }

  const destination = rules.destinationRules[quote.destinationRule] ?? {}
  const addDestination = (key: string, label: string, detail: CreateRateDetailRequest['costDetailType'] = 'DestinationCharge') => {
    const value = number(destination[key])
    if (value <= 0) return
    const isPerCbm = key.toLowerCase().includes('percbm') || ['transshipment', 'inland', 'stuffing'].includes(key)
    lines.push(makeLine(label, value, isPerCbm ? calc.chargeableCbm : 1, isPerCbm ? 'PerChargeableCbm' : 'PerShipment', detail, 'Ruta', 'Regla CNCA-023/#048'))
  }
  addDestination('destinationPerCbm', 'Destination Charge')
  addDestination('dmce', 'DMCE')
  addDestination('transshipment', 'Transbordo')
  addDestination('inland', 'Flete terrestre destino', 'InlandTransport')
  addDestination('stuffing', 'Stuffing')
  addDestination('docs', 'Documentación', 'Documentation')
  addDestination('handling', 'Manejos')
  addDestination('destinationHandling', 'Manejos en destino')
  addDestination('zone', 'Zone Charge')

  if (incotermCode.value === 'FCA' || incotermCode.value === 'EXW') {
    const origin = rules.originRules.fcaAndExw
    lines.push(makeLine('CFS', origin.cfsPerCbm, calc.chargeableCbm, 'PerChargeableCbm', 'OriginCharge', 'Ruta'))
    lines.push(makeLine('CUSTOMS', origin.customsPerSet, number(quote.sets) || 1, 'PerDocument', 'CustomsCharge', 'Ruta', 'Cobro por SET'))
    lines.push(makeLine('DOC FEE', origin.docFeePerHbl, number(quote.hbl) || 1, 'PerDocument', 'Documentation', 'Ruta', 'Cobro por HBL'))
    lines.push(makeLine('VGM', origin.vgmPerHbl, number(quote.hbl) || 1, 'PerDocument', 'Documentation', 'Ruta', 'Cobro por HBL'))
    lines.push(makeLine('MANIFEST', origin.manifestPerHbl, number(quote.hbl) || 1, 'PerDocument', 'Documentation', 'Ruta', 'Cobro por HBL'))
    if (incotermCode.value === 'EXW' && number(quote.pickupAmount) > 0) {
      lines.push(makeLine('Recolecta / Pick up', number(quote.pickupAmount), 1, 'PerShipment', 'InlandTransport', 'Ruta', 'Aplica únicamente EXW'))
    }
  }

  try {
    operationalCosts.value = await PricingService.selectCosts({
      carrierId: source.carrierId,
      polId: quote.polId,
      poeId: quote.poeId,
      podId: quote.podId,
      incotermId: quote.incotermId,
      shipmentMode: 'Lcl',
      applicableToContext: true,
      serviceIds: quote.serviceIds.length ? quote.serviceIds.join(',') : undefined,
      isActive: true,
    })
  } catch {
    operationalCosts.value = []
  }

  for (const cost of operationalCosts.value) {
    if (source.sourceType === 'Own' && cost.costDetailType === 'DestinationCharge' && (cost.poeId === source.poeId || cost.portId === source.poeId)) continue
    const quantity = quantityForCost(cost)
    const totalCostAmount = number(cost.costAmount) * quantity
    const totalSaleAmount = number(cost.saleAmount) * quantity
    lines.push({
      costId: cost.id,
      name: cost.name,
      costDetailType: cost.costDetailType,
      costType: cost.costType,
      chargeBasis: cost.chargeBasis,
      currencyId: cost.currencyId,
      currencyName: cost.currencyName,
      currencyCode: cost.currencyCode,
      costAmount: Number(totalCostAmount.toFixed(2)),
      saleAmount: Number(totalSaleAmount.toFixed(2)),
      quantity: 1,
      notes: cost.notes,
      source: 'Costo',
    })
  }

  quoteLines.value = lines
}

function destinationNames() {
  return routeRules.value?.destinations.map((row) => row.destination) ?? []
}

async function createOwnConsolidation() {
  const carrier = findItem(carriers.value, ownForm.carrierId)
  const pol = findItem(pols.value, ownForm.polId)
  const poe = findItem(poes.value, ownForm.poeId)
  const container = findItem(containerTypes.value, ownForm.containerTypeId)
  const currency = findItem(currencies.value, ownForm.currencyId)
  if (!ownForm.bookingNumber.trim() || !carrier || !pol || !poe || !container || !currency || number(ownForm.maxCbm) <= 0) {
    toast.error('LCL propio', 'Complete booking, ETD, naviera, POL, POE, contenedor, capacidad máxima y moneda.')
    return
  }

  saving.value = true
  try {
    const payload: CreateOwnLclPayload = {
      bookingNumber: ownForm.bookingNumber.trim(),
      etd: toUtcDate(ownForm.etd),
      carrierId: carrier.id,
      carrierName: carrier.name,
      carrierCode: carrier.code,
      polId: pol.id,
      polName: pol.name,
      polCode: pol.code,
      poeId: poe.id,
      poeName: poe.name,
      poeCode: poe.code,
      containerTypeId: container.id,
      containerTypeName: container.name,
      containerTypeCode: container.code,
      maxCbm: number(ownForm.maxCbm),
      oceanFreightAmount: number(ownForm.oceanFreightAmount),
      currencyId: currency.id,
      currencyName: currency.name,
      currencyCode: currency.code,
      defaultLandFreightAmount: number(ownForm.defaultLandFreightAmount),
      defaultBunkerAmount: number(ownForm.defaultBunkerAmount),
      truckCapacityCbm: number(ownForm.truckCapacityCbm),
    }
    const result = await LclService.createOwn(payload)
    toast.success('LCL propio', `Consolidado creado. Tarifa base: ${money(Number(result.baseRatePerCbm ?? 0), currency.code)}/CBM.`)
    ownForm.bookingNumber = ''
    ownForm.oceanFreightAmount = 0
    await loadSources()
    activeView.value = 'quote'
    quote.sourceType = 'Own'
  } catch (error) {
    console.error(error)
    toast.error('LCL propio', 'No se pudo crear el consolidado. Revise booking, costos y datos de ruta.')
  } finally {
    saving.value = false
  }
}

async function saveDraft() {
  const source = selectedSource.value
  const pol = selectedPol.value
  const poe = selectedPoe.value
  const pod = selectedPod.value
  const container = selectedContainer.value
  const incoterm = selectedIncoterm.value
  const calc = cargoCalculation.value
  if (!source || !pol || !poe || !pod || !container || !incoterm || !calc || !quoteLines.value.length) return

  saving.value = true
  try {
    const payload: CreateRateRequest = {
      sourceImportFclRateId: null,
      agentId: null,
      agentName: source.sourceType === 'Coloader' ? source.providerName ?? null : null,
      agentCode: null,
      carrierId: source.carrierId,
      carrierName: source.carrierName,
      carrierCode: source.carrierCode,
      polId: pol.id,
      polName: pol.name,
      polCode: pol.code,
      poeId: poe.id,
      poeName: poe.name,
      poeCode: poe.code,
      podId: pod.id,
      podName: pod.name,
      podCode: pod.code,
      containerTypeId: container.id,
      containerTypeName: container.name,
      containerTypeCode: container.code,
      incotermId: incoterm.id,
      incotermName: incoterm.name,
      incotermCode: incoterm.code,
      currencyId: source.currencyId,
      currencyName: source.currencyName,
      currencyCode: source.currencyCode,
      freeDays: 0,
      validFrom: toUtcDate(quote.validFrom),
      validTo: toUtcDate(quote.validTo),
      containerQuantity: 1,
      clientName: quote.clientName.trim(),
      executiveName: quote.executiveName.trim(),
      rateType: 'Tariff',
      operationType: 'Import',
      shipmentMode: 'Lcl',
      totalPackages: totalPackages.value,
      totalPallets: totalPallets.value,
      totalWeightKg: totalWeightKg.value,
      totalVolumeCbm: calc.dimensionalCbm,
      kgPerCbm: calc.kgPerCbm,
      cargoLines: cargoLines.value.map((line) => ({
        description: line.description || null,
        packages: number(line.units),
        pallets: number(line.pallets),
        weightKg: number(line.weightKg),
        lengthCm: number(line.lengthCm),
        widthCm: number(line.widthCm),
        heightCm: number(line.heightCm),
      })),
      services: selectedServices.value,
      containers: [{ containerTypeId: container.id, containerTypeName: container.name, containerTypeCode: container.code, quantity: 1 }],
      pickupAddress: incotermCode.value === 'EXW' ? 'Recolecta incluida en líneas LCL' : null,
      details: quoteLines.value.map(({ source: _source, ...line }) => line),
    }

    const rateId = await PricingService.createRate(payload)
    toast.success('LCL', 'Borrador LCL creado correctamente.')
    await router.push({ name: 'pricing-rate-wizard', params: { rateId } })
  } catch (error) {
    console.error(error)
    toast.error('LCL', 'No se pudo crear el borrador LCL.')
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <section class="lcl-page">
    <div class="lcl-hero">
      <div>
        <p class="eyebrow">Pricing · LCL</p>
        <h1>Consolidados LCL</h1>
        <p>Cotice LCL propio o coloader aprobado con cubicación, ruta, costos y borrador en el mismo flujo de Pricing.</p>
      </div>
      <div class="view-switch">
        <button :class="{ active: activeView === 'quote' }" @click="activeView = 'quote'">Cotizar LCL</button>
        <button :class="{ active: activeView === 'own' }" @click="activeView = 'own'">Crear LCL propio</button>
      </div>
    </div>

    <div v-if="loading" class="panel">Cargando catálogos y reglas LCL…</div>

    <template v-else-if="activeView === 'own'">
      <div class="panel">
        <div class="panel-title">
          <div>
            <h2>Crear consolidado propio</h2>
            <p>Los costos de destino de la naviera + POE se prorratean automáticamente entre el CBM máximo.</p>
          </div>
        </div>
        <div class="form-grid three">
          <label>Booking<input v-model="ownForm.bookingNumber" placeholder="Booking" /></label>
          <label>ETD<input v-model="ownForm.etd" type="date" /></label>
          <label>Naviera<select v-model="ownForm.carrierId"><option value="">Seleccione</option><option v-for="item in carriers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>POL<select v-model="ownForm.polId"><option value="">Seleccione</option><option v-for="item in pols" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>POE<select v-model="ownForm.poeId"><option value="">Seleccione</option><option v-for="item in poes" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>Tipo / tamaño contenedor<select v-model="ownForm.containerTypeId"><option value="">Seleccione</option><option v-for="item in containerTypes" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>CBM máximo<input v-model.number="ownForm.maxCbm" type="number" min="0" step="0.001" /></label>
          <label>Flete marítimo<input v-model.number="ownForm.oceanFreightAmount" type="number" min="0" step="0.01" /></label>
          <label>Moneda<select v-model="ownForm.currencyId"><option value="">Seleccione</option><option v-for="item in currencies" :key="item.id" :value="item.id">{{ item.code }} · {{ item.name }}</option></select></label>
        </div>
        <div class="sub-panel">
          <h3>Tramo terrestre por defecto</h3>
          <div class="form-grid three">
            <label>Flete terrestre CR<input v-model.number="ownForm.defaultLandFreightAmount" type="number" min="0" step="0.01" /></label>
            <label>Bunker editable<input v-model.number="ownForm.defaultBunkerAmount" type="number" min="0" step="0.01" /></label>
            <label>Capacidad furgón CBM<input v-model.number="ownForm.truckCapacityCbm" type="number" min="1" step="0.001" /></label>
          </div>
          <p class="formula">Por defecto: ({{ money(ownForm.defaultLandFreightAmount) }} + {{ money(ownForm.defaultBunkerAmount) }}) / {{ ownForm.truckCapacityCbm || 95 }} CBM = {{ money((number(ownForm.defaultLandFreightAmount) + number(ownForm.defaultBunkerAmount)) / (number(ownForm.truckCapacityCbm) || 95)) }}/CBM</p>
        </div>
        <div class="actions end"><button class="primary" :disabled="saving" @click="createOwnConsolidation">{{ saving ? 'Guardando…' : 'Crear LCL propio' }}</button></div>
      </div>

      <div class="panel">
        <h2>Consolidados propios activos</h2>
        <div class="table-wrap"><table><thead><tr><th>Booking</th><th>ETD</th><th>Naviera</th><th>Ruta</th><th>Equipo</th><th>Máx. CBM</th><th>Base / CBM</th></tr></thead><tbody>
          <tr v-for="source in ownSources" :key="source.id"><td>{{ source.bookingNumber }}</td><td>{{ source.etd?.slice(0, 10) || '—' }}</td><td>{{ source.carrierName }}</td><td>{{ source.polName }} → {{ source.poeName }}</td><td>{{ source.containerTypeName || '—' }}</td><td>{{ source.maxCbm ?? '—' }}</td><td><strong>{{ money(source.baseRatePerCbm, source.currencyCode) }}</strong></td></tr>
          <tr v-if="!ownSources.length"><td colspan="7" class="empty">No hay consolidados propios todavía.</td></tr>
        </tbody></table></div>
      </div>
    </template>

    <template v-else>
      <div class="stepper">
        <div v-for="n in 5" :key="n" :class="['step-dot', { active: step === n, done: step > n }]"><span>{{ n }}</span><small>{{ ['Embarque', 'Carga', 'Tarifa LCL', 'Líneas', 'Borrador'][n - 1] }}</small></div>
      </div>

      <div v-if="step === 1" class="panel">
        <h2>1. Cliente, ruta e Incoterm</h2>
        <div class="form-grid three">
          <label>Cliente<input v-model="quote.clientName" placeholder="Cliente" /></label>
          <label>Ejecutivo<input v-model="quote.executiveName" placeholder="Ejecutivo" /></label>
          <label>Incoterm<select v-model="quote.incotermId"><option value="">Seleccione</option><option v-for="item in incoterms" :key="item.id" :value="item.id">{{ item.code }} · {{ item.name }}</option></select></label>
          <label>POL<select v-model="quote.polId"><option value="">Seleccione</option><option v-for="item in pols" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>POE<select v-model="quote.poeId"><option value="">Seleccione</option><option v-for="item in poes" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>POD<select v-model="quote.podId"><option value="">Seleccione</option><option v-for="item in pods" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>Equipo asociado<select v-model="quote.containerTypeId"><option value="">Seleccione</option><option v-for="item in containerTypes" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
          <label>Destino cálculo LCL<select v-model="quote.destinationRule"><option v-for="name in destinationNames()" :key="name" :value="name">{{ name }}</option></select></label>
        </div>
        <div class="services"><span>Servicios</span><label v-for="item in services" :key="item.id" class="check"><input v-model="quote.serviceIds" type="checkbox" :value="item.id" />{{ item.name }}</label></div>
      </div>

      <div v-else-if="step === 2" class="panel">
        <div class="panel-title"><div><h2>2. Información de la carga</h2><p>CBM dimensional vs. peso / 500. Dhole toma el mayor como CBM cobrable.</p></div><button class="ghost" @click="addCargoLine">+ Línea</button></div>
        <div class="table-wrap"><table><thead><tr><th>Descripción</th><th>Unidades</th><th>Tarimas</th><th>Peso kg</th><th>Largo cm</th><th>Ancho cm</th><th>Alto cm</th><th></th></tr></thead><tbody>
          <tr v-for="(line, index) in cargoLines" :key="index"><td><input v-model="line.description" /></td><td><input v-model.number="line.units" type="number" min="0" /></td><td><input v-model.number="line.pallets" type="number" min="0" /></td><td><input v-model.number="line.weightKg" type="number" min="0" step="0.01" /></td><td><input v-model.number="line.lengthCm" type="number" min="0" step="0.01" /></td><td><input v-model.number="line.widthCm" type="number" min="0" step="0.01" /></td><td><input v-model.number="line.heightCm" type="number" min="0" step="0.01" /></td><td><button class="icon" @click="removeCargoLine(index)">×</button></td></tr>
        </tbody></table></div>
        <button class="ghost" :disabled="calculating" @click="calculateCargo">{{ calculating ? 'Calculando…' : 'Calcular CBM' }}</button>
        <div v-if="cargoCalculation" class="metrics"><div><small>CBM dimensional</small><strong>{{ cargoCalculation.dimensionalCbm.toFixed(3) }}</strong></div><div><small>CBM por peso</small><strong>{{ cargoCalculation.weightCbm.toFixed(3) }}</strong></div><div><small>CBM cobrable</small><strong>{{ cargoCalculation.chargeableCbm.toFixed(3) }}</strong></div><div><small>CBM para flete</small><strong>{{ cargoCalculation.freightChargeableCbm.toFixed(3) }}</strong></div></div>
      </div>

      <div v-else-if="step === 3" class="panel">
        <h2>3. Seleccionar tarifa LCL</h2>
        <div class="source-toggle"><button :class="{ active: quote.sourceType === 'Own' }" @click="quote.sourceType = 'Own'">Propio</button><button :class="{ active: quote.sourceType === 'Coloader' }" @click="quote.sourceType = 'Coloader'">Coloader preaprobado</button></div>
        <p v-if="sourceLoading">Cargando tarifas…</p>
        <div v-else class="source-grid">
          <button v-for="source in sourceOptions" :key="source.id" :class="['source-card', { selected: quote.sourceId === source.id }]" @click="quote.sourceId = source.id">
            <div><span class="pill">{{ source.sourceType }}</span><strong>{{ source.sourceType === 'Own' ? source.bookingNumber : source.providerName || source.carrierName }}</strong></div>
            <p>{{ source.polName }} → {{ source.poeName }}</p><p>{{ source.carrierName }} · {{ source.containerTypeName || 'LCL' }}</p><b>{{ money(source.baseRatePerCbm, source.currencyCode) }}/CBM</b><small v-if="source.etd">ETD {{ source.etd.slice(0, 10) }}</small>
          </button>
          <div v-if="!sourceOptions.length" class="empty-card">No hay {{ quote.sourceType === 'Own' ? 'consolidados propios' : 'tarifas coloader aprobadas' }} disponibles.</div>
        </div>
        <div v-if="selectedSource" class="sub-panel"><strong>Tarifa seleccionada:</strong> {{ selectedSource.sourceType }} · {{ money(selectedSource.baseRatePerCbm, selectedSource.currencyCode) }}/CBM. <span v-if="selectedSource.sourceType === 'Own'">Los costos de destino ya vienen prorrateados en esta base.</span></div>
        <div class="form-grid three compact">
          <label>SET<input v-model.number="quote.sets" type="number" min="1" /></label><label>HBL<input v-model.number="quote.hbl" type="number" min="1" /></label><label v-if="incotermCode === 'EXW'">Pick up EXW<input v-model.number="quote.pickupAmount" type="number" min="0" step="0.01" /></label><label v-if="quote.destinationRule === 'San José, Costa Rica'">Bunker<input v-model.number="quote.bunkerAmount" type="number" min="0" step="0.01" /></label>
        </div>
      </div>

      <div v-else-if="step === 4" class="panel">
        <div class="panel-title"><div><h2>4. Líneas de costo y venta</h2><p>EXW incluye pick up; FCA/FOB no. HBL/SET se cobran una vez por documento; CBM se multiplica por CBM cobrable.</p></div><button class="ghost" @click="buildQuoteLines">Recalcular</button></div>
        <div class="table-wrap"><table><thead><tr><th>Fuente</th><th>Rubro</th><th>Base</th><th>Costo</th><th>Venta editable</th></tr></thead><tbody>
          <tr v-for="(line, index) in quoteLines" :key="`${line.name}-${index}`"><td><span class="pill">{{ line.source }}</span></td><td><strong>{{ line.name }}</strong><small v-if="line.notes">{{ line.notes }}</small></td><td>{{ line.chargeBasis }}</td><td>{{ money(line.costAmount, line.currencyCode) }}</td><td><input v-model.number="line.saleAmount" class="money-input" type="number" min="0" step="0.01" /></td></tr>
        </tbody><tfoot><tr><th colspan="3">Totales</th><th>{{ money(totalCost, selectedSource?.currencyCode || 'USD') }}</th><th>{{ money(totalSale, selectedSource?.currencyCode || 'USD') }}</th></tr></tfoot></table></div>
        <div class="metrics"><div><small>Utilidad</small><strong>{{ money(utility, selectedSource?.currencyCode || 'USD') }}</strong></div><div><small>Margen</small><strong>{{ margin.toFixed(2) }}%</strong></div><div><small>Costos asociados cargados</small><strong>{{ operationalCosts.length }}</strong></div></div>
      </div>

      <div v-else class="panel draft">
        <h2>5. Borrador LCL</h2>
        <div class="summary-grid"><div><small>Cliente</small><strong>{{ quote.clientName }}</strong></div><div><small>Ejecutivo</small><strong>{{ quote.executiveName }}</strong></div><div><small>Incoterm</small><strong>{{ selectedIncoterm?.code }}</strong></div><div><small>Ruta</small><strong>{{ selectedPol?.name }} → {{ selectedPoe?.name }} → {{ selectedPod?.name }}</strong></div><div><small>Fuente</small><strong>{{ selectedSource?.sourceType }} · {{ selectedSource?.bookingNumber || selectedSource?.providerName }}</strong></div><div><small>CBM cobrable</small><strong>{{ cargoCalculation?.chargeableCbm.toFixed(3) }}</strong></div></div>
        <div class="table-wrap"><table><thead><tr><th>Rubro</th><th>Costo</th><th>Venta</th></tr></thead><tbody><tr v-for="(line, index) in quoteLines" :key="index"><td>{{ line.name }}</td><td>{{ money(line.costAmount, line.currencyCode) }}</td><td>{{ money(line.saleAmount, line.currencyCode) }}</td></tr></tbody></table></div>
        <div class="form-grid two"><label>Válida desde<input v-model="quote.validFrom" type="date" /></label><label>Válida hasta<input v-model="quote.validTo" type="date" /></label></div>
        <div class="draft-total"><span>Total venta</span><strong>{{ money(totalSale, selectedSource?.currencyCode || 'USD') }}</strong><small>Margen {{ margin.toFixed(2) }}%</small></div>
      </div>

      <div class="actions between"><button class="ghost" :disabled="step === 1" @click="previousStep">Anterior</button><button v-if="step < 5" class="primary" @click="nextStep">Siguiente</button><button v-else class="primary" :disabled="saving" @click="saveDraft">{{ saving ? 'Creando…' : 'Crear borrador LCL' }}</button></div>
    </template>
  </section>
</template>

<style scoped>
.lcl-page{display:grid;gap:18px;padding:20px;max-width:1500px;margin:0 auto;color:var(--color-text,#172033)}
.lcl-hero,.panel-title,.actions.between{display:flex;align-items:center;justify-content:space-between;gap:16px}.lcl-hero{padding:22px;border-radius:20px;background:linear-gradient(135deg,rgba(197,22,29,.09),rgba(19,35,67,.04));border:1px solid rgba(120,130,150,.2)}
h1,h2,h3,p{margin:0}.lcl-hero h1{font-size:28px}.lcl-hero p:not(.eyebrow){margin-top:6px;color:#697386}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#b2131a}
.view-switch,.source-toggle{display:inline-flex;padding:4px;border:1px solid #d9dee8;border-radius:12px;background:#fff}.view-switch button,.source-toggle button{border:0;background:transparent;padding:9px 13px;border-radius:9px;cursor:pointer;font-weight:700}.view-switch button.active,.source-toggle button.active{background:#172033;color:#fff}
.panel{background:#fff;border:1px solid #e0e4eb;border-radius:18px;padding:20px;display:grid;gap:18px;box-shadow:0 4px 16px rgba(20,32,55,.04)}.panel-title p,.sub-panel p{color:#697386;margin-top:4px}.sub-panel{padding:16px;border-radius:14px;background:#f7f8fa;border:1px solid #e5e8ee;display:grid;gap:12px}
.form-grid{display:grid;gap:14px}.form-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid.compact{margin-top:4px}.form-grid label{font-size:12px;font-weight:700;color:#596276;display:grid;gap:6px}input,select{width:100%;min-height:40px;border:1px solid #d8dde7;border-radius:10px;padding:8px 10px;background:#fff;color:inherit;outline:none}input:focus,select:focus{border-color:#8b97ad;box-shadow:0 0 0 3px rgba(70,90,130,.08)}
.services{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-top:4px}.services>span{font-weight:800}.check{display:flex;align-items:center;gap:6px;font-size:13px}.check input{width:auto;min-height:auto}
.stepper{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.step-dot{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;color:#7c8492;background:#f0f2f6}.step-dot span{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#fff;font-weight:800}.step-dot.active{background:#172033;color:#fff}.step-dot.done{background:#e7f3eb;color:#286b42}.step-dot small{font-weight:700}
button{font:inherit}.primary,.ghost,.icon{border-radius:10px;padding:10px 15px;border:1px solid transparent;cursor:pointer;font-weight:800}.primary{background:#172033;color:#fff}.ghost{background:#fff;border-color:#d8dde7;color:#283449}.icon{padding:6px 10px;background:#fff;border-color:#e2e5eb}.primary:disabled,.ghost:disabled{opacity:.55;cursor:not-allowed}.actions{display:flex;gap:10px}.actions.end{justify-content:flex-end}
.table-wrap{overflow:auto;border:1px solid #e2e5eb;border-radius:14px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:11px 12px;border-bottom:1px solid #edf0f4;text-align:left;font-size:13px;vertical-align:middle}th{background:#f8f9fb;color:#596276;font-size:11px;text-transform:uppercase;letter-spacing:.04em}td small{display:block;color:#7a8496;margin-top:3px}.table-wrap input{min-width:90px}.money-input{max-width:150px}.empty{text-align:center;color:#7a8496;padding:24px}
.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.metrics>div,.summary-grid>div{border:1px solid #e4e8ef;background:#fafbfc;border-radius:12px;padding:13px;display:grid;gap:5px}.metrics small,.summary-grid small{color:#717b8f}.metrics strong{font-size:20px}.formula{font-size:13px;color:#596276}
.source-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.source-card{display:grid;gap:7px;text-align:left;padding:16px;border:1px solid #dfe4ec;border-radius:14px;background:#fff;cursor:pointer;color:inherit}.source-card:hover,.source-card.selected{border-color:#172033;box-shadow:0 0 0 2px rgba(23,32,51,.08)}.source-card>div{display:flex;align-items:center;gap:8px}.source-card p{font-size:13px;color:#657084}.source-card small{color:#7a8496}.pill{display:inline-flex;padding:3px 7px;border-radius:999px;background:#edf0f5;font-size:10px;font-weight:800;text-transform:uppercase}.empty-card{padding:26px;text-align:center;border:1px dashed #ccd2dc;border-radius:14px;color:#737d8e}
.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.draft-total{display:flex;align-items:baseline;justify-content:flex-end;gap:12px;padding:16px;border-radius:14px;background:#172033;color:#fff}.draft-total strong{font-size:24px}.draft-total small{opacity:.75}
@media (max-width:980px){.form-grid.three,.summary-grid,.source-grid,.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.lcl-hero{align-items:flex-start;flex-direction:column}.step-dot small{display:none}}
@media (max-width:640px){.lcl-page{padding:12px}.form-grid.three,.form-grid.two,.summary-grid,.source-grid,.metrics{grid-template-columns:1fr}.view-switch{width:100%}.view-switch button{flex:1}.stepper{grid-template-columns:repeat(5,1fr)}.step-dot{justify-content:center}.panel{padding:14px}}
</style>
