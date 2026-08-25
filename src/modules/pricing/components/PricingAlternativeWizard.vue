<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Plane,
  Plus,
  Search,
  Ship,
  Truck,
  Waypoints,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type {
  CostDetailType,
  CostSelectDto,
  CostType,
  CreateRateDetailRequest,
  ImportRateSelectDto,
  ShipmentMode,
} from '@/core/interfaces/pricing'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { PricingService } from '@/core/services/pricingService'
import { useToastStore } from '@/core/stores/toastStore'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

type Modality = 'Maritime' | 'Air' | 'Land' | 'Multimodal'
type RateSection =
  | 'pickup_origin'
  | 'origin_charges'
  | 'international_freight'
  | 'destination_charges'
  | 'delivery_destination'

interface CatalogMetadata {
  modalities?: string[]
  shipmentModes?: string[]
  rateSections?: RateSection[]
  optional?: boolean
  requiresCargoValue?: boolean
  saleFactor?: number
  saleMinimumUsd?: number
  costFactor?: number
  costMinimumUsd?: number
  countryCode?: string
}

interface CabysItem {
  code: string
  description: string
}

interface RateLine {
  key: string
  section: RateSection
  name: string
  costDetailType: CostDetailType
  costType: CostType
  costId?: string | null
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  included: boolean
  optional: boolean
  manual: boolean
}

const toastStore = useToastStore()
const step = ref(1)
const loadingCatalogs = ref(false)
const loadingRates = ref(false)
const loadingCabys = ref(false)
const saving = ref(false)
const createdRateId = ref('')
const availableRates = ref<ImportRateSelectDto[]>([])
const costs = ref<CostSelectDto[]>([])
const cabysResults = ref<CabysItem[]>([])
const rateLines = ref<RateLine[]>([])

const catalogs = reactive({
  modalities: [] as CatalogItemSelectDto[],
  shipmentModes: [] as CatalogItemSelectDto[],
  services: [] as CatalogItemSelectDto[],
  incoterms: [] as CatalogItemSelectDto[],
  pol: [] as CatalogItemSelectDto[],
  pod: [] as CatalogItemSelectDto[],
  poe: [] as CatalogItemSelectDto[],
  containers: [] as CatalogItemSelectDto[],
  landEquipment: [] as CatalogItemSelectDto[],
  airEquipment: [] as CatalogItemSelectDto[],
  agents: [] as CatalogItemSelectDto[],
  carriers: [] as CatalogItemSelectDto[],
  currencies: [] as CatalogItemSelectDto[],
})

const form = reactive({
  modality: '' as Modality | '',
  shipmentMode: '',
  originId: '',
  destinationId: '',
  equipmentId: '',
  equipmentQuantity: 1,
  incotermId: '',
  serviceIds: [] as string[],
  loadDate: todayIso(),
  selectedImportRateId: '',
  manualRate: false,
  agentId: '',
  carrierId: '',
  currencyId: '',
  freightCost: 0,
  freightSale: 0,
  cabysSearch: '',
  cabysCode: '',
  cargoDescription: '',
  cargoValue: 0,
  dangerousCargo: false,
  nonStackable: false,
  overweight: false,
  manualName: '',
  manualSection: 'destination_charges' as RateSection,
})

const stepTitles = [
  'Modalidad',
  'Tipo de embarque',
  'Ruta y equipo',
  'Tarifa disponible',
  'Proveedor y flete',
  'Carga y CABYS',
  'Líneas de tarifa',
]

const modalityFallback: Array<{ value: Modality; label: string }> = [
  { value: 'Maritime', label: 'Marítimo' },
  { value: 'Air', label: 'Aéreo' },
  { value: 'Land', label: 'Terrestre' },
  { value: 'Multimodal', label: 'Multimodal' },
]

const allowedShipmentModes: Record<Modality, string[]> = {
  Maritime: ['FCL', 'LCL'],
  Air: ['LCL'],
  Land: ['FTL', 'FCL'],
  Multimodal: ['FCL', 'LCL'],
}

const shipmentModeOptions = computed(() => {
  if (!form.modality) return []
  const allowed = allowedShipmentModes[form.modality]
  const fromConfig = catalogs.shipmentModes
    .filter((item) => allowed.includes(item.code.toUpperCase()))
    .map((item) => ({ value: item.code.toUpperCase(), label: shipmentLabel(item.code, form.modality as Modality) }))
  return fromConfig.length
    ? fromConfig
    : allowed.map((value) => ({ value, label: shipmentLabel(value, form.modality as Modality) }))
})

const equipmentOptions = computed(() => {
  let source = catalogs.containers
  if (form.modality === 'Land') source = catalogs.landEquipment
  if (form.modality === 'Air') source = catalogs.airEquipment
  return source.map((item) => ({ value: item.id, label: item.label }))
})

const selectedOrigin = computed(() => findById(catalogs.pol, form.originId))
const selectedDestination = computed(() => findById(catalogs.pod, form.destinationId))
const selectedEquipment = computed(() => {
  const source = form.modality === 'Land'
    ? catalogs.landEquipment
    : form.modality === 'Air'
      ? catalogs.airEquipment
      : catalogs.containers
  return findById(source, form.equipmentId)
})
const canonicalEquipment = computed(() => {
  const selected = selectedEquipment.value
  if (!selected) return null
  return catalogs.containers.find((item) => item.code.toLowerCase() === selected.code.toLowerCase()) ?? selected
})
const selectedIncoterm = computed(() => findById(catalogs.incoterms, form.incotermId))
const selectedServices = computed(() => catalogs.services.filter((item) => form.serviceIds.includes(item.id)))
const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))
const selectedCarrier = computed(() => findById(catalogs.carriers, form.carrierId))
const selectedCurrency = computed(() => findById(catalogs.currencies, form.currencyId))
const selectedImportRate = computed(() => availableRates.value.find((rate) => rate.id === form.selectedImportRateId) ?? null)

const shipmentModeForApi = computed<ShipmentMode>(() => {
  const value = form.shipmentMode.toUpperCase()
  if (value === 'LCL') return 'Lcl'
  if (value === 'FTL') return 'Ftl'
  if (value === 'LTL') return 'Ltl'
  return 'Fcl'
})

const direction = computed(() => {
  if (!selectedOrigin.value || !selectedDestination.value) return ''
  const originCr = isCostaRica(selectedOrigin.value)
  const destinationCr = isCostaRica(selectedDestination.value)
  if (originCr && !destinationCr) return 'Exportación'
  if (!originCr && destinationCr) return 'Importación'
  return 'Tránsito / doméstico'
})

const visibleSections = computed<RateSection[]>(() => {
  const sections = new Set<RateSection>(['international_freight'])
  metadata(selectedIncoterm.value)?.rateSections?.forEach((section) => sections.add(section))
  selectedServices.value.forEach((service) => {
    metadata(service)?.rateSections?.forEach((section) => sections.add(section))
  })
  return sectionOrder.filter((section) => sections.has(section))
})

const includedLines = computed(() => rateLines.value.filter((line) => line.included))
const totalCost = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.costAmount), 0))
const totalSale = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.saleAmount), 0))
const totalUtility = computed(() => totalSale.value - totalCost.value)

const canNext = computed(() => {
  if (step.value === 1) return Boolean(form.modality)
  if (step.value === 2) return Boolean(form.shipmentMode)
  if (step.value === 3) {
    return Boolean(
      form.originId &&
      form.destinationId &&
      form.equipmentId &&
      form.equipmentQuantity > 0 &&
      form.incotermId &&
      form.serviceIds.length &&
      form.loadDate,
    )
  }
  if (step.value === 4) return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)
  if (step.value === 5) return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)
  if (step.value === 6) return Boolean(form.cargoDescription || form.cabysCode)
  return true
})

const sectionOrder: RateSection[] = [
  'pickup_origin',
  'origin_charges',
  'international_freight',
  'destination_charges',
  'delivery_destination',
]

function metadata(item?: CatalogItemSelectDto | null): CatalogMetadata | null {
  if (!item?.metadataJson) return null
  try {
    return JSON.parse(item.metadataJson) as CatalogMetadata
  } catch {
    return null
  }
}

function findById(items: CatalogItemSelectDto[], id: string) {
  return items.find((item) => item.id === id) ?? null
}

function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function shipmentLabel(value: string, modality: Modality) {
  const normalized = value.toUpperCase()
  if (modality === 'Maritime' && normalized === 'LCL') return 'LCL · Coloading / Propio'
  if (modality === 'Multimodal' && normalized === 'LCL') return 'LCL · Consolidado propio'
  return normalized
}

function modalityIcon(value: Modality) {
  if (value === 'Maritime') return Ship
  if (value === 'Air') return Plane
  if (value === 'Land') return Truck
  return Waypoints
}

function isCostaRica(item: CatalogItemSelectDto) {
  const meta = metadata(item)
  if (meta?.countryCode?.toUpperCase() === 'CR') return true
  const text = `${item.code} ${item.label} ${item.slug}`.toLowerCase()
  return text.includes('costa rica') || text.includes('costarica') || text.includes(', cr') || text.includes(' cr ')
}

function sectionLabel(section: RateSection) {
  return ({
    pickup_origin: 'Recolecta en Origen',
    origin_charges: 'Cargos en Origen',
    international_freight: 'Flete Internacional',
    destination_charges: 'Cargos en Destino',
    delivery_destination: 'Entrega en Destino',
  } as Record<RateSection, string>)[section]
}

function sectionForDetail(type: CostDetailType, name = ''): RateSection {
  if (type === 'Freight') return 'international_freight'
  if (type === 'OriginCharge') return 'origin_charges'
  if (type === 'DestinationCharge' || type === 'Insurance') return 'destination_charges'
  if (type === 'InlandTransport') {
    return /recole|pickup|origen/i.test(name) ? 'pickup_origin' : 'delivery_destination'
  }
  if (type === 'CustomsCharge') return /exterior|origen/i.test(name) ? 'origin_charges' : 'destination_charges'
  return 'destination_charges'
}

function detailTypeForService(code: string): CostDetailType {
  if (code === 'INT_TRANSPORT') return 'Freight'
  if (code === 'CARGO_INSURANCE') return 'Insurance'
  if (code === 'CUSTOMS_CR' || code === 'CUSTOMS_FOREIGN') return 'CustomsCharge'
  if (code === 'DELIVERY' || code === 'PICKUP') return 'InlandTransport'
  return 'Other'
}

function applicableCost(cost: CostSelectDto) {
  if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
  if (cost.incoterms?.length && !cost.incoterms.some((incoterm) => incoterm.id === form.incotermId)) return false
  if (cost.carrierId && form.carrierId && cost.carrierId !== form.carrierId) return false
  if (cost.agentId && form.agentId && cost.agentId !== form.agentId) return false
  return true
}

function serviceAmounts(service: CatalogItemSelectDto) {
  const meta = metadata(service)
  if (service.code === 'CARGO_INSURANCE' && form.cargoValue > 0) {
    const cost = Math.max((form.cargoValue * number(meta?.costFactor)) / 100, number(meta?.costMinimumUsd))
    const sale = Math.max((form.cargoValue * number(meta?.saleFactor)) / 100, number(meta?.saleMinimumUsd))
    return { cost, sale }
  }
  return { cost: 0, sale: 0 }
}

function rebuildRateLines() {
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return

  const visible = new Set(visibleSections.value)
  const lines: RateLine[] = []

  if (visible.has('international_freight')) {
    lines.push({
      key: 'freight',
      section: 'international_freight',
      name: 'Flete Internacional',
      costDetailType: 'Freight',
      costType: 'Fixed',
      currencyId: currency.id,
      currencyName: currency.label,
      currencyCode: currency.code,
      costAmount: number(form.freightCost),
      saleAmount: number(form.freightSale),
      included: true,
      optional: false,
      manual: false,
    })
  }

  selectedServices.value
    .filter((service) => service.code !== 'INT_TRANSPORT')
    .forEach((service) => {
      const meta = metadata(service)
      const section = meta?.rateSections?.[0] ?? sectionForDetail(detailTypeForService(service.code), service.label)
      if (!visible.has(section)) return
      const amounts = serviceAmounts(service)
      const optional = Boolean(meta?.optional)
      lines.push({
        key: `service:${service.id}`,
        section,
        name: service.label,
        costDetailType: detailTypeForService(service.code),
        costType: optional ? 'Optional' : 'Fixed',
        currencyId: currency.id,
        currencyName: currency.label,
        currencyCode: currency.code,
        costAmount: amounts.cost,
        saleAmount: amounts.sale,
        included: true,
        optional,
        manual: false,
      })
    })

  costs.value.filter(applicableCost).forEach((cost) => {
    const section = sectionForDetail(cost.costDetailType, cost.name)
    if (!visible.has(section)) return
    if (lines.some((line) => line.name.trim().toLowerCase() === cost.name.trim().toLowerCase())) return
    lines.push({
      key: `cost:${cost.id}`,
      section,
      name: cost.name,
      costDetailType: cost.costDetailType,
      costType: cost.costType,
      costId: cost.id,
      currencyId: cost.currencyId,
      currencyName: cost.currencyName,
      currencyCode: cost.currencyCode,
      costAmount: number(cost.costAmount),
      saleAmount: number(cost.saleAmount),
      included: cost.costType !== 'Optional',
      optional: cost.costType === 'Optional',
      manual: false,
    })
  })

  rateLines.value = lines
}

function addManualCharge() {
  const name = form.manualName.trim()
  const currency = selectedCurrency.value
  if (!name || !currency) return
  rateLines.value.push({
    key: `manual:${crypto.randomUUID()}`,
    section: form.manualSection,
    name,
    costDetailType: sectionForManual(form.manualSection),
    costType: 'Variable',
    currencyId: currency.id,
    currencyName: currency.label,
    currencyCode: currency.code,
    costAmount: 0,
    saleAmount: 0,
    included: true,
    optional: false,
    manual: true,
  })
  form.manualName = ''
}

function sectionForManual(section: RateSection): CostDetailType {
  if (section === 'international_freight') return 'Freight'
  if (section === 'origin_charges') return 'OriginCharge'
  if (section === 'destination_charges') return 'DestinationCharge'
  if (section === 'pickup_origin' || section === 'delivery_destination') return 'InlandTransport'
  return 'Other'
}

async function loadCatalogs() {
  try {
    loadingCatalogs.value = true
    const select = (slug: string) => CatalogItemsService.select({ catalogGroupSlug: slug })
    const [
      modalities,
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      landEquipment,
      airEquipment,
      agents,
      carriers,
      currencies,
      selectedCosts,
    ] = await Promise.all([
      select('transport-modalities'),
      select('shipment-modes'),
      select('pricing-services'),
      select('incoterms'),
      select('pol'),
      select('pod'),
      select('poe'),
      select('container-types'),
      select('land-equipment-types'),
      select('air-equipment-types'),
      select('agents'),
      select('carriers'),
      select('currencies'),
      PricingService.selectCosts(),
    ])
    Object.assign(catalogs, {
      modalities,
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      landEquipment,
      airEquipment,
      agents,
      carriers,
      currencies,
    })
    costs.value = selectedCosts
    const usd = currencies.find((item) => item.code.toUpperCase() === 'USD') ?? currencies[0]
    form.currencyId = usd?.id ?? ''
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los catálogos de Pricing.')
  } finally {
    loadingCatalogs.value = false
  }
}

async function searchApprovedRates() {
  availableRates.value = []
  form.selectedImportRateId = ''
  form.manualRate = false

  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !canonicalEquipment.value) {
    form.manualRate = true
    return
  }

  try {
    loadingRates.value = true
    const origin = `${selectedOrigin.value.code}|${selectedOrigin.value.label}`
    const destination = `${selectedDestination.value.code}|${selectedDestination.value.label}`
    const equipment = `${canonicalEquipment.value.code}|${canonicalEquipment.value.label}`
    availableRates.value = await PricingService.selectImportRates({
      pol: origin,
      pod: destination,
      containerType: equipment,
      quoteDate: form.loadDate,
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron consultar las tarifas aprobadas.')
  } finally {
    loadingRates.value = false
  }

  if (!availableRates.value.length) form.manualRate = true
}

function chooseRate(rate: ImportRateSelectDto) {
  form.selectedImportRateId = rate.id
  form.manualRate = false
  form.freightCost = number(rate.freight)
  form.freightSale = number(rate.totalSale ?? rate.freight)
  const carrier = catalogs.carriers.find((item) =>
    `${item.code} ${item.label}`.toLowerCase().includes(String(rate.carrier ?? '').toLowerCase()),
  )
  if (carrier) form.carrierId = carrier.id
  const currency = catalogs.currencies.find((item) =>
    `${item.code} ${item.label}`.toLowerCase().includes(String(rate.currency ?? '').toLowerCase()),
  )
  if (currency) form.currencyId = currency.id
}

function continueManual() {
  form.selectedImportRateId = ''
  form.manualRate = true
}

async function next() {
  if (!canNext.value) return
  if (step.value === 3) await searchApprovedRates()
  if (step.value === 6) rebuildRateLines()
  if (step.value < 7) step.value += 1
}

function previous() {
  if (step.value > 1) step.value -= 1
}

function chooseModality(value: Modality) {
  form.modality = value
  form.shipmentMode = ''
  form.equipmentId = ''
}

async function searchCabys() {
  const query = form.cabysSearch.trim()
  if (query.length < 3) {
    toastStore.error('Digite al menos 3 caracteres para buscar CABYS.')
    return
  }
  try {
    loadingCabys.value = true
    const payload = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/cabys?q=${encodeURIComponent(query)}&top=20`,
      headers: { Accept: 'application/json' },
    })
    cabysResults.value = normalizeCabys(payload)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo consultar CABYS en Hacienda.')
  } finally {
    loadingCabys.value = false
  }
}

function normalizeCabys(payload: unknown): CabysItem[] {
  const root = payload as Record<string, unknown> | null
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.cabys)
      ? root.cabys
      : Array.isArray(root?.data)
        ? root.data
        : Array.isArray(root?.results)
          ? root.results
          : root && (root.codigo || root.code)
            ? [root]
            : []

  return candidates
    .map((entry) => {
      const item = entry as Record<string, unknown>
      return {
        code: String(item.codigo ?? item.code ?? item.cabys ?? ''),
        description: String(item.descripcion ?? item.description ?? item.detalle ?? ''),
      }
    })
    .filter((item) => item.code && item.description)
}

function chooseCabys(item: CabysItem) {
  form.cabysCode = item.code
  form.cargoDescription = item.description
}

function findPoe() {
  const destination = selectedDestination.value
  if (!destination) return null
  const exactCode = catalogs.poe.find((item) => item.code.toLowerCase() === destination.code.toLowerCase())
  if (exactCode) return exactCode
  const target = destination.label.toLowerCase()
  return catalogs.poe.find((item) => target.includes(item.label.toLowerCase()) || item.label.toLowerCase().includes(target)) ?? null
}

async function saveRate() {
  const origin = selectedOrigin.value
  const destination = selectedDestination.value
  const equipment = canonicalEquipment.value
  const incoterm = selectedIncoterm.value
  const agent = selectedAgent.value
  const carrier = selectedCarrier.value
  const currency = selectedCurrency.value
  const poe = findPoe()

  if (!origin || !destination || !equipment || !incoterm || !agent || !carrier || !currency || !poe) {
    toastStore.error('Falta una equivalencia de catálogo. Revise origen, destino, POE, equipo, agente, naviera y moneda.')
    return
  }

  const details: CreateRateDetailRequest[] = includedLines.value.map((line) => ({
    costId: line.costId ?? null,
    name: line.name,
    costDetailType: line.costDetailType,
    costType: line.costType,
    chargeBasis: line.costDetailType === 'Freight' || shipmentModeForApi.value === 'Fcl' ? 'PerContainer' : 'PerShipment',
    currencyId: line.currencyId,
    currencyName: line.currencyName,
    currencyCode: line.currencyCode,
    costAmount: number(line.costAmount),
    saleAmount: number(line.saleAmount),
    quantity: line.costDetailType === 'Freight' ? form.equipmentQuantity : 1,
    notes: line.manual ? 'Cargo manual agregado desde el wizard de Pricing.' : null,
  }))

  try {
    saving.value = true
    createdRateId.value = await PricingService.createRate({
      sourceImportFclRateId: form.selectedImportRateId || null,
      agentId: agent.id,
      agentName: agent.label,
      agentCode: agent.code,
      carrierId: carrier.id,
      carrierName: carrier.label,
      carrierCode: carrier.code,
      polId: origin.id,
      polName: origin.label,
      polCode: origin.code,
      poeId: poe.id,
      poeName: poe.label,
      poeCode: poe.code,
      podId: destination.id,
      podName: destination.label,
      podCode: destination.code,
      containerTypeId: equipment.id,
      containerTypeName: equipment.label,
      containerTypeCode: equipment.code,
      incotermId: incoterm.id,
      incotermName: incoterm.label,
      incotermCode: incoterm.code,
      currencyId: currency.id,
      currencyName: currency.label,
      currencyCode: currency.code,
      freeDays: number(selectedImportRate.value?.freeDays),
      validFrom: form.loadDate,
      validTo: selectedImportRate.value?.validTo?.slice(0, 10) || addDaysIso(form.loadDate, 30),
      containerQuantity: form.equipmentQuantity,
      rateType: 'Spot',
      shipmentMode: shipmentModeForApi.value,
      containers: [
        {
          containerTypeId: equipment.id,
          containerTypeName: equipment.label,
          containerTypeCode: equipment.code,
          quantity: form.equipmentQuantity,
        },
      ],
      transitTime: selectedImportRate.value?.transitDays ? `${selectedImportRate.value.transitDays} días` : null,
      includes: selectedServices.value.map((service) => service.label).join('\n'),
      subjectTo: [
        form.dangerousCargo ? 'Carga peligrosa' : '',
        form.nonStackable ? 'Carga no estibable' : '',
        form.overweight ? 'Carga con sobrepeso' : '',
      ].filter(Boolean).join('\n') || null,
      excludes: null,
      totalPackages: 0,
      totalPallets: 0,
      totalWeightKg: 0,
      totalVolumeCbm: 0,
      cargoLines: form.cargoDescription
        ? [{ description: `${form.cabysCode ? `CABYS ${form.cabysCode} · ` : ''}${form.cargoDescription}`, packages: 0, pallets: 0, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0 }]
        : [],
      details,
    })
    toastStore.success('Alternativa creada correctamente.')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo crear la alternativa.')
  } finally {
    saving.value = false
  }
}

function resetWizard() {
  step.value = 1
  createdRateId.value = ''
  availableRates.value = []
  rateLines.value = []
  Object.assign(form, {
    modality: '',
    shipmentMode: '',
    originId: '',
    destinationId: '',
    equipmentId: '',
    equipmentQuantity: 1,
    incotermId: '',
    serviceIds: [],
    loadDate: todayIso(),
    selectedImportRateId: '',
    manualRate: false,
    agentId: '',
    carrierId: '',
    freightCost: 0,
    freightSale: 0,
    cabysSearch: '',
    cabysCode: '',
    cargoDescription: '',
    cargoValue: 0,
    dangerousCargo: false,
    nonStackable: false,
    overweight: false,
    manualName: '',
    manualSection: 'destination_charges',
  })
}

watch(() => form.currencyId, () => {
  if (step.value === 7) rebuildRateLines()
})

onMounted(loadCatalogs)
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Seleccionar alternativa"
      description="Construya la alternativa en 7 pasos. Solo se ofrecen tarifas previamente aprobadas y vigentes."
    />

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      <button
        v-for="(title, index) in stepTitles"
        :key="title"
        type="button"
        class="rounded-xl border px-3 py-2 text-left transition"
        :class="index + 1 === step
          ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)] text-[var(--dh-text)]'
          : index + 1 < step
            ? 'border-emerald-500/30 bg-emerald-500/5 text-[var(--dh-text)]'
            : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'"
        @click="index + 1 < step ? (step = index + 1) : undefined"
      >
        <span class="block text-[10px] font-black uppercase tracking-wide">Pantalla {{ index + 1 }}</span>
        <span class="mt-1 block text-xs font-bold">{{ title }}</span>
      </button>
    </div>

    <section class="min-h-[430px] rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 md:p-7">
      <div v-if="loadingCatalogs" class="grid min-h-[360px] place-items-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Cargando configuración de Pricing…
      </div>

      <template v-else>
        <div v-if="step === 1" class="space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 1</p>
            <h2 class="mt-1 text-2xl font-black text-[var(--dh-text)]">Seleccione la modalidad</h2>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="option in modalityFallback"
              :key="option.value"
              type="button"
              class="rounded-2xl border p-5 text-left transition hover:border-[var(--dh-primary)]"
              :class="form.modality === option.value ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]' : 'border-[var(--dh-border)]'"
              @click="chooseModality(option.value)"
            >
              <component :is="modalityIcon(option.value)" class="h-6 w-6" />
              <span class="mt-4 block text-lg font-black">{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div v-else-if="step === 2" class="space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 2</p>
            <h2 class="mt-1 text-2xl font-black">Tipo de embarque</h2>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Las opciones cambian automáticamente según {{ form.modality }}.</p>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <button
              v-for="option in shipmentModeOptions"
              :key="option.value"
              type="button"
              class="rounded-2xl border p-5 text-left"
              :class="form.shipmentMode === option.value ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]' : 'border-[var(--dh-border)]'"
              @click="form.shipmentMode = option.value"
            >
              <span class="text-lg font-black">{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div v-else-if="step === 3" class="space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 3</p>
            <h2 class="mt-1 text-2xl font-black">Ruta, equipo, Incoterm y servicios</h2>
          </div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DhSelect v-model="form.originId" label="Origen" :options="catalogs.pol.map((x) => ({ value: x.id, label: x.label }))" />
            <DhSelect v-model="form.destinationId" label="Destino" :options="catalogs.pod.map((x) => ({ value: x.id, label: x.label }))" />
            <DhSelect v-model="form.equipmentId" label="Tipo de equipo" :options="equipmentOptions" />
            <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad de equipo" />
            <DhSelect v-model="form.incotermId" label="Incoterm" :options="catalogs.incoterms.map((x) => ({ value: x.id, label: x.label }))" />
            <DhInput v-model="form.loadDate" type="date" label="Fecha de carga" />
          </div>
          <div v-if="direction" class="rounded-xl bg-black/[0.03] px-4 py-3 text-sm font-bold dark:bg-white/[0.04]">
            Operación determinada por ruta: <span class="text-[var(--dh-primary)]">{{ direction }}</span>
          </div>
          <div>
            <p class="mb-2 text-sm font-black">Servicios incluidos en la tarifa</p>
            <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label
                v-for="service in catalogs.services"
                :key="service.id"
                class="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--dh-border)] px-3 py-3 text-sm font-semibold"
              >
                <input v-model="form.serviceIds" type="checkbox" :value="service.id" />
                <span>{{ service.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div v-else-if="step === 4" class="space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 4</p>
            <h2 class="mt-1 text-2xl font-black">Tarifas aprobadas disponibles</h2>
          </div>
          <div v-if="loadingRates" class="py-12 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>
          <template v-else-if="availableRates.length">
            <div class="grid gap-3 lg:grid-cols-2">
              <button
                v-for="rate in availableRates"
                :key="rate.id"
                type="button"
                class="rounded-2xl border p-4 text-left"
                :class="form.selectedImportRateId === rate.id ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]' : 'border-[var(--dh-border)]'"
                @click="chooseRate(rate)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-black">{{ rate.carrier }}</p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.pol }} → {{ rate.pod }} · {{ rate.containerType }}</p>
                  </div>
                  <DhBadge variant="success">Aprobada</DhBadge>
                </div>
                <p class="mt-4 text-xl font-black">{{ formatMoney(rate.freight, rate.currencyCode || rate.currency || 'USD') }}</p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Vigencia {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</p>
              </button>
            </div>
            <div class="flex justify-end">
              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>
            </div>
          </template>
          <div v-else class="rounded-2xl border border-dashed border-[var(--dh-border)] p-8 text-center">
            <p class="text-lg font-black">No existen tarifas vigentes para esa ruta y tamaño de equipo</p>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">Puede continuar y capturar el flete manualmente.</p>
            <DhButton class="mt-4" @click="continueManual">Continuar de manera manual</DhButton>
          </div>
          <div v-if="form.manualRate && availableRates.length" class="rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-bold">Se usará captura manual en la siguiente pantalla.</div>
        </div>

        <div v-else-if="step === 5" class="space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 5</p>
            <h2 class="mt-1 text-2xl font-black">Agente, naviera y flete internacional</h2>
          </div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DhSelect v-model="form.agentId" label="Agente" :options="catalogs.agents.map((x) => ({ value: x.id, label: x.label }))" />
            <DhSelect v-model="form.carrierId" label="Naviera / proveedor" :options="catalogs.carriers.map((x) => ({ value: x.id, label: x.label }))" />
            <DhSelect v-model="form.currencyId" label="Moneda" :options="catalogs.currencies.map((x) => ({ value: x.id, label: `${x.code} · ${x.label}` }))" />
            <DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" label="Flete internacional · costo" />
            <DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" label="Flete internacional · venta" />
          </div>
        </div>

        <div v-else-if="step === 6" class="space-y-5">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 6</p>
            <h2 class="mt-1 text-2xl font-black">Descripción de carga y CABYS</h2>
          </div>
          <div class="flex gap-2">
            <div class="flex-1"><DhInput v-model="form.cabysSearch" label="Buscar CABYS de Hacienda" placeholder="Ej. repuestos, textiles, maquinaria…" @keyup.enter="searchCabys" /></div>
            <DhButton class="mt-6" :disabled="loadingCabys" @click="searchCabys"><Search class="h-4 w-4" /> Buscar</DhButton>
          </div>
          <div v-if="cabysResults.length" class="max-h-52 overflow-auto rounded-xl border border-[var(--dh-border)]">
            <button
              v-for="item in cabysResults"
              :key="item.code"
              type="button"
              class="flex w-full gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-left last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              @click="chooseCabys(item)"
            >
              <span class="shrink-0 font-mono text-xs font-black">{{ item.code }}</span>
              <span class="text-sm font-semibold">{{ item.description }}</span>
            </button>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <DhInput v-model="form.cargoDescription" label="Descripción de la carga" />
            <DhInput v-model.number="form.cargoValue" type="number" min="0" step="0.01" label="Valor de la carga (si aplica)" />
          </div>
          <p v-if="form.cabysCode" class="text-xs font-bold text-[var(--dh-text-muted)]">CABYS seleccionado: {{ form.cabysCode }}</p>
          <div class="grid gap-2 md:grid-cols-3">
            <label class="flex items-center gap-3 rounded-xl border border-[var(--dh-border)] p-3 font-semibold"><input v-model="form.dangerousCargo" type="checkbox" /> Carga peligrosa</label>
            <label class="flex items-center gap-3 rounded-xl border border-[var(--dh-border)] p-3 font-semibold"><input v-model="form.nonStackable" type="checkbox" /> No estibable</label>
            <label class="flex items-center gap-3 rounded-xl border border-[var(--dh-border)] p-3 font-semibold"><input v-model="form.overweight" type="checkbox" /> Sobrepeso</label>
          </div>
        </div>

        <div v-else class="space-y-5">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">Pantalla 7</p>
              <h2 class="mt-1 text-2xl font-black">Líneas de tarifa según Incoterm y servicios</h2>
            </div>
            <div class="text-right text-sm">
              <p>Costo: <strong>{{ formatMoney(totalCost, selectedCurrency?.code || 'USD') }}</strong></p>
              <p>Venta: <strong>{{ formatMoney(totalSale, selectedCurrency?.code || 'USD') }}</strong></p>
              <p>Utilidad: <strong>{{ formatMoney(totalUtility, selectedCurrency?.code || 'USD') }}</strong></p>
            </div>
          </div>

          <div v-for="section in visibleSections" :key="section" class="space-y-2">
            <h3 class="text-sm font-black uppercase tracking-wide text-[var(--dh-text-muted)]">{{ sectionLabel(section) }}</h3>
            <div
              v-for="line in rateLines.filter((item) => item.section === section)"
              :key="line.key"
              class="grid items-end gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-[minmax(180px,1fr)_150px_150px_auto]"
            >
              <div>
                <div class="flex items-center gap-2">
                  <input v-if="line.optional" v-model="line.included" type="checkbox" />
                  <p class="font-bold">{{ line.name }}</p>
                  <DhBadge v-if="line.optional" variant="neutral">Opcional</DhBadge>
                  <DhBadge v-if="line.costType === 'Variable'" variant="warning">Variable</DhBadge>
                </div>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ line.currencyCode }}</p>
              </div>
              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="!line.manual && line.costType !== 'Optional' && line.costType !== 'Variable'" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" />
              <button v-if="line.manual" type="button" class="h-10 px-2 text-xs font-black text-red-500" @click="rateLines = rateLines.filter((item) => item.key !== line.key)">Eliminar</button>
            </div>
          </div>

          <div class="rounded-2xl border border-dashed border-[var(--dh-border)] p-4">
            <p class="mb-3 text-sm font-black">Agregar cargo manual</p>
            <div class="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <DhInput v-model="form.manualName" label="Nombre del cargo" />
              <DhSelect v-model="form.manualSection" label="Etapa" :options="visibleSections.map((value) => ({ value, label: sectionLabel(value) }))" />
              <DhButton class="mt-6" variant="secondary" :disabled="!form.manualName.trim()" @click="addManualCharge"><Plus class="h-4 w-4" /> Añadir cargo</DhButton>
            </div>
          </div>

          <div v-if="createdRateId" class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div class="flex items-center gap-3"><CircleCheck class="h-5 w-5" /><strong>Alternativa creada</strong></div>
            <p class="mt-1 text-xs font-semibold">ID: {{ createdRateId }}</p>
            <DhButton class="mt-3" variant="secondary" @click="resetWizard">Crear otra alternativa</DhButton>
          </div>
        </div>
      </template>
    </section>

    <div class="flex items-center justify-between gap-3">
      <DhButton variant="secondary" :disabled="step === 1 || saving" @click="previous"><ChevronLeft class="h-4 w-4" /> Atrás</DhButton>
      <div class="text-xs font-bold text-[var(--dh-text-muted)]">{{ step }} / 7</div>
      <DhButton v-if="step < 7" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>
      <DhButton v-else :disabled="saving || !includedLines.length || Boolean(createdRateId)" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : 'Crear alternativa' }}</DhButton>
    </div>
  </div>
</template>
