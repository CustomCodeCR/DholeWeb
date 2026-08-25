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
  BrowseImportRatesQuery,
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
import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'
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
  size?: string
  kind?: string
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
  shipmentModes: [] as CatalogItemSelectDto[],
  services: [] as CatalogItemSelectDto[],
  incoterms: [] as CatalogItemSelectDto[],
  pol: [] as CatalogItemSelectDto[],
  pod: [] as CatalogItemSelectDto[],
  poe: [] as CatalogItemSelectDto[],
  containers: [] as CatalogItemSelectDto[],
  agents: [] as CatalogItemSelectDto[],
  carriers: [] as CatalogItemSelectDto[],
  currencies: [] as CatalogItemSelectDto[],
})

const form = reactive({
  modality: '' as Modality | '',
  shipmentMode: '',
  originId: '',
  destinationId: '',
  equipmentSize: '',
  equipmentType: '',
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
  'Embarque',
  'Ruta y equipo',
  'Tarifa',
  'Proveedor',
  'Carga',
  'Líneas',
]

const modalityOptions: Array<{ value: Modality; label: string; caption: string }> = [
  { value: 'Maritime', label: 'Marítimo', caption: 'FCL y LCL' },
  { value: 'Air', label: 'Aéreo', caption: 'Carga aérea LCL' },
  { value: 'Land', label: 'Terrestre', caption: 'FTL y FCL' },
  { value: 'Multimodal', label: 'Multimodal', caption: 'Marítimo + terrestre' },
]

const allowedShipmentModes: Record<Modality, string[]> = {
  Maritime: ['FCL', 'LCL'],
  Air: ['LCL'],
  Land: ['FTL', 'FCL'],
  Multimodal: ['FCL', 'LCL'],
}

const sectionOrder: RateSection[] = [
  'pickup_origin',
  'origin_charges',
  'international_freight',
  'destination_charges',
  'delivery_destination',
]

const kindLabels: Record<string, string> = {
  'dry-van': 'Dry Van',
  'high-cube': 'High Cube',
  'open-top': 'Open Top',
  'open-side': 'Open Side',
  tank: 'Tank',
  'flat-rack': 'Flat Rack',
  nor: 'NOR',
  reefer: 'Reefer',
}

function metadata(item?: CatalogItemSelectDto | null): CatalogMetadata | null {
  if (!item?.metadataJson) return null
  try {
    return JSON.parse(item.metadataJson) as CatalogMetadata
  } catch {
    return null
  }
}

function displayValue(item?: CatalogItemSelectDto | null) {
  return item ? String(item.value ?? '').trim() : ''
}

function normalizeCatalogValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\b(puerto|port|de|del|of|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function valueTokens(value: string) {
  return normalizeCatalogValue(value)
    .split(' ')
    .filter((token) => token.length > 1)
}

function valueMatchScore(leftValue: string, rightValue: string) {
  const left = new Set(valueTokens(leftValue))
  const right = new Set(valueTokens(rightValue))
  if (!left.size || !right.size) return 0

  let intersection = 0
  left.forEach((token) => {
    if (right.has(token)) intersection += 1
  })

  return intersection / Math.min(left.size, right.size)
}

function findById(items: CatalogItemSelectDto[], id: string) {
  return items.find((item) => item.id === id) ?? null
}

function findEquivalentValue(items: CatalogItemSelectDto[], sourceValue?: string | null) {
  const source = String(sourceValue ?? '').trim()
  const normalizedSource = normalizeCatalogValue(source)
  if (!normalizedSource) return null

  const exact = items.filter(
    (item) => normalizeCatalogValue(displayValue(item)) === normalizedSource,
  )
  if (exact.length === 1) return exact[0]

  const scored = items
    .map((item) => ({ item, score: valueMatchScore(displayValue(item), source) }))
    .filter((candidate) => candidate.score >= 0.75)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return null
  if (scored.length > 1 && scored[0].score === scored[1].score) return null
  return scored[0].item
}

function findEquivalent(items: CatalogItemSelectDto[], source?: CatalogItemSelectDto | null) {
  return findEquivalentValue(items, displayValue(source))
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

function modalityIcon(value: Modality) {
  if (value === 'Maritime') return Ship
  if (value === 'Air') return Plane
  if (value === 'Land') return Truck
  return Waypoints
}

function shipmentLabel(value: string, modality: Modality) {
  const normalized = value.toUpperCase()
  if (modality === 'Maritime' && normalized === 'LCL') return 'LCL · Coloading / Propio'
  if (modality === 'Multimodal' && normalized === 'LCL') return 'LCL · Consolidado propio'
  return normalized
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

function isCostaRica(item: CatalogItemSelectDto) {
  const meta = metadata(item)
  if (meta?.countryCode?.toUpperCase() === 'CR') return true
  const text = displayValue(item).toLocaleLowerCase()
  return text.includes('costa rica') || text.includes('costarica')
}

function catalogSearchText(item: CatalogItemSelectDto) {
  return displayValue(item)
}

const shipmentModeOptions = computed(() => {
  if (!form.modality) return []
  const allowed = allowedShipmentModes[form.modality]
  const configured = catalogs.shipmentModes
    .filter((item) => allowed.includes(displayValue(item).toUpperCase()))
    .map((item) => {
      const value = displayValue(item).toUpperCase()
      return {
        value,
        label: shipmentLabel(value, form.modality as Modality),
      }
    })
  return configured.length
    ? configured
    : allowed.map((value) => ({ value, label: shipmentLabel(value, form.modality as Modality) }))
})

const equipmentSource = computed(() => {
  const modality = String(form.modality)
  if (!modality) return []
  return catalogs.containers.filter((item) => {
    const meta = metadata(item)
    if (meta?.modalities?.length) return meta.modalities.includes(modality)
    if (modality === 'Air') {
      const value = displayValue(item).toUpperCase()
      return ['LOOSE', 'PALLET', 'ULD'].some((kind) => value.includes(kind))
    }
    return modality !== 'Air'
  })
})

const equipmentHasSizes = computed(() => equipmentSource.value.some((item) => Boolean(metadata(item)?.size)))

const equipmentSizeOptions = computed(() => {
  const sizes = [...new Set(equipmentSource.value.map((item) => metadata(item)?.size?.trim()).filter((value): value is string => Boolean(value)))]
  return sizes
    .sort((a, b) => number(a) - number(b))
    .map((size) => ({ value: size, label: size }))
})

const equipmentTypeOptions = computed(() => {
  if (!equipmentHasSizes.value) {
    return equipmentSource.value.map((item) => ({ value: item.id, label: displayValue(item) }))
  }

  if (!form.equipmentSize) return []
  const kinds = new Map<string, string>()
  equipmentSource.value
    .filter((item) => metadata(item)?.size === form.equipmentSize)
    .forEach((item) => {
      const kind = metadata(item)?.kind?.trim()
      if (kind) kinds.set(kind, kindLabels[kind] ?? kind.replaceAll('-', ' '))
    })

  return [...kinds.entries()].map(([value, label]) => ({ value, label }))
})

const selectedOrigin = computed(() => findById(catalogs.pol, form.originId))
const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))
const selectedEquipment = computed(() => findById(catalogs.containers, form.equipmentId))
const selectedIncoterm = computed(() => findById(catalogs.incoterms, form.incotermId))
const selectedServices = computed(() => catalogs.services.filter((item) => form.serviceIds.includes(item.id)))
const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))
const selectedCarrier = computed(() => findById(catalogs.carriers, form.carrierId))
const selectedCurrency = computed(() => findById(catalogs.currencies, form.currencyId))
const selectedImportRate = computed(() => availableRates.value.find((rate) => rate.id === form.selectedImportRateId) ?? null)

const originOptions = computed(() => catalogs.pol.map((item) => ({ value: item.id, label: displayValue(item) })))
const destinationOptions = computed(() => catalogs.poe.map((item) => ({ value: item.id, label: displayValue(item) })))
const incotermOptions = computed(() => catalogs.incoterms.map((item) => ({ value: item.id, label: displayValue(item) })))
const agentOptions = computed(() => catalogs.agents.map((item) => ({ value: item.id, label: displayValue(item) })))
const carrierOptions = computed(() => catalogs.carriers.map((item) => ({ value: item.id, label: displayValue(item) })))
const currencyOptions = computed(() => catalogs.currencies.map((item) => ({ value: item.id, label: displayValue(item) })))
const serviceOptions = computed(() => catalogs.services.map((item) => ({ value: item.id, label: displayValue(item) })))

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
  selectedServices.value.forEach((service) => metadata(service)?.rateSections?.forEach((section) => sections.add(section)))
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

function detailTypeForService(service: CatalogItemSelectDto): CostDetailType {
  const value = normalizeCatalogValue(displayValue(service))
  if (value.includes('transporte internacional')) return 'Freight'
  if (value.includes('seguro') && value.includes('carga')) return 'Insurance'
  if (value.includes('aduana')) return 'CustomsCharge'
  if (value.includes('transporte entrega') || value.includes('transporte recoleccion')) return 'InlandTransport'
  return 'Other'
}

function sectionForDetail(type: CostDetailType, name = ''): RateSection {
  if (type === 'Freight') return 'international_freight'
  if (type === 'OriginCharge') return 'origin_charges'
  if (type === 'DestinationCharge' || type === 'Insurance') return 'destination_charges'
  if (type === 'InlandTransport') return /recole|pickup|origen/i.test(name) ? 'pickup_origin' : 'delivery_destination'
  if (type === 'CustomsCharge') return /exterior|origen/i.test(name) ? 'origin_charges' : 'destination_charges'
  return 'destination_charges'
}

function sectionForManual(section: RateSection): CostDetailType {
  if (section === 'international_freight') return 'Freight'
  if (section === 'origin_charges') return 'OriginCharge'
  if (section === 'destination_charges') return 'DestinationCharge'
  if (section === 'pickup_origin' || section === 'delivery_destination') return 'InlandTransport'
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
  const serviceValue = normalizeCatalogValue(displayValue(service))
  if (serviceValue.includes('seguro') && serviceValue.includes('carga') && form.cargoValue > 0) {
    const cost = Math.max(form.cargoValue * number(meta?.costFactor), number(meta?.costMinimumUsd))
    const sale = Math.max(form.cargoValue * number(meta?.saleFactor), number(meta?.saleMinimumUsd))
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
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: number(form.freightCost),
      saleAmount: number(form.freightSale),
      included: true,
      optional: false,
      manual: false,
    })
  }

  selectedServices.value
    .filter((service) => !normalizeCatalogValue(displayValue(service)).includes('transporte internacional'))
    .forEach((service) => {
      const meta = metadata(service)
      const name = displayValue(service)
      const detailType = detailTypeForService(service)
      const section = meta?.rateSections?.[0] ?? sectionForDetail(detailType, name)
      if (!visible.has(section)) return
      const amounts = serviceAmounts(service)
      const optional = Boolean(meta?.optional)
      lines.push({
        key: `service:${service.id}`,
        section,
        name,
        costDetailType: detailType,
        costType: optional ? 'Optional' : 'Fixed',
        currencyId: currency.id,
        currencyName: displayValue(currency),
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
    if (lines.some((line) => line.name.trim().toLocaleLowerCase() === cost.name.trim().toLocaleLowerCase())) return
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
    currencyName: displayValue(currency),
    currencyCode: currency.code,
    costAmount: 0,
    saleAmount: 0,
    included: true,
    optional: false,
    manual: true,
  })
  form.manualName = ''
}

function selectDefaultService() {
  const internationalTransport = catalogs.services.find((item) =>
    normalizeCatalogValue(displayValue(item)).includes('transporte internacional'),
  )
  form.serviceIds = internationalTransport ? [internationalTransport.id] : []
}

function chooseModality(value: Modality) {
  form.modality = value
  form.shipmentMode = ''
  form.equipmentSize = ''
  form.equipmentType = ''
  form.equipmentId = ''
  selectDefaultService()
}

async function loadCatalogs() {
  try {
    loadingCatalogs.value = true
    const select = (slug: string) => CatalogItemsService.select({ catalogGroupSlug: slug })
    const [
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      agents,
      carriers,
      currencies,
      selectedCosts,
    ] = await Promise.all([
      select('shipment-modes'),
      select('pricing-services'),
      select('incoterms'),
      select('pol'),
      select('pod'),
      select('poe'),
      select('container-types'),
      select('agents'),
      select('carriers'),
      select('currencies'),
      PricingService.selectCosts().catch(() => [] as CostSelectDto[]),
    ])

    Object.assign(catalogs, {
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      containers,
      agents,
      carriers,
      currencies,
    })
    costs.value = selectedCosts
    const usd = currencies.find((item) => normalizeCatalogValue(displayValue(item)) === 'usd') ?? currencies[0]
    form.currencyId = usd?.id ?? ''
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los catálogos de Pricing.')
  } finally {
    loadingCatalogs.value = false
  }
}

function resolvePodForDestination() {
  const fromRate = selectedImportRate.value?.podId
    ? findById(catalogs.pod, selectedImportRate.value.podId)
    : null
  if (fromRate) return fromRate

  const fromDestination = findEquivalent(catalogs.pod, selectedDestination.value)
  if (fromDestination) return fromDestination

  return findEquivalentValue(catalogs.pod, selectedImportRate.value?.pod)
}

async function searchApprovedRates() {
  availableRates.value = []
  form.selectedImportRateId = ''
  form.manualRate = false

  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {
    form.manualRate = true
    return
  }

  try {
    loadingRates.value = true
    const query: BrowseImportRatesQuery = {
      pol: catalogSearchText(selectedOrigin.value),
      poe: catalogSearchText(selectedDestination.value),
      containerType: catalogSearchText(selectedEquipment.value),
      quoteDate: form.loadDate,
    }
    const pod = resolvePodForDestination()
    if (pod) query.pod = catalogSearchText(pod)
    availableRates.value = await PricingService.selectImportRates(query)
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

  const rateCarrier = normalizeCatalogValue(String(rate.carrier ?? ''))
  const carrier = catalogs.carriers.find((item) =>
    normalizeCatalogValue(displayValue(item)).includes(rateCarrier),
  )
  if (carrier) form.carrierId = carrier.id

  const rateCurrency = normalizeCatalogValue(String(rate.currency ?? ''))
  const currency = catalogs.currencies.find((item) =>
    normalizeCatalogValue(displayValue(item)).includes(rateCurrency),
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

async function saveRate() {
  const origin = selectedOrigin.value
  const poe = selectedDestination.value
  const pod = resolvePodForDestination()
  const equipment = selectedEquipment.value
  const incoterm = selectedIncoterm.value
  const agent = selectedAgent.value
  const carrier = selectedCarrier.value
  const currency = selectedCurrency.value

  const missing: string[] = []
  if (!origin) missing.push('origen')
  if (!poe) missing.push('destino/POE')
  if (!pod) missing.push(`POD relacionado con “${displayValue(poe)}”`)
  if (!equipment) missing.push('equipo')
  if (!incoterm) missing.push('Incoterm')
  if (!agent) missing.push('agente')
  if (!carrier) missing.push('proveedor')
  if (!currency) missing.push('moneda')

  if (missing.length) {
    toastStore.error(`No se pudo resolver: ${missing.join(', ')}.`)
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
    const equipmentName = displayValue(equipment!)
    createdRateId.value = await PricingService.createRate({
      sourceImportFclRateId: form.selectedImportRateId || null,
      agentId: agent!.id,
      agentName: displayValue(agent),
      agentCode: agent!.code,
      carrierId: carrier!.id,
      carrierName: displayValue(carrier),
      carrierCode: carrier!.code,
      polId: origin!.id,
      polName: displayValue(origin),
      polCode: origin!.code,
      poeId: poe!.id,
      poeName: displayValue(poe),
      poeCode: poe!.code,
      podId: pod!.id,
      podName: displayValue(pod),
      podCode: pod!.code,
      containerTypeId: equipment!.id,
      containerTypeName: equipmentName,
      containerTypeCode: equipment!.code,
      incotermId: incoterm!.id,
      incotermName: displayValue(incoterm),
      incotermCode: incoterm!.code,
      currencyId: currency!.id,
      currencyName: displayValue(currency),
      currencyCode: currency!.code,
      freeDays: number(selectedImportRate.value?.freeDays),
      validFrom: form.loadDate,
      validTo: selectedImportRate.value?.validTo?.slice(0, 10) || addDaysIso(form.loadDate, 30),
      containerQuantity: form.equipmentQuantity,
      rateType: 'Spot',
      shipmentMode: shipmentModeForApi.value,
      containers: [
        {
          containerTypeId: equipment!.id,
          containerTypeName: equipmentName,
          containerTypeCode: equipment!.code,
          quantity: form.equipmentQuantity,
        },
      ],
      transitTime: selectedImportRate.value?.transitDays ? `${selectedImportRate.value.transitDays} días` : null,
      includes: selectedServices.value.map(displayValue).join('\n'),
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
        ? [{
            description: `${form.cabysCode ? `CABYS ${form.cabysCode} · ` : ''}${form.cargoDescription}`,
            packages: 0,
            pallets: 0,
            weightKg: 0,
            lengthCm: 0,
            widthCm: 0,
            heightCm: 0,
          }]
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
    equipmentSize: '',
    equipmentType: '',
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

watch(
  () => form.equipmentSize,
  () => {
    if (!equipmentHasSizes.value) return
    if (form.equipmentType && !equipmentTypeOptions.value.some((option) => option.value === form.equipmentType)) {
      form.equipmentType = ''
      form.equipmentId = ''
    }
  },
)

watch(
  () => [form.equipmentSize, form.equipmentType, form.modality] as const,
  () => {
    if (!form.modality || !form.equipmentType) {
      form.equipmentId = ''
      return
    }

    if (!equipmentHasSizes.value) {
      form.equipmentId = equipmentSource.value.some((item) => item.id === form.equipmentType)
        ? form.equipmentType
        : ''
      return
    }

    const equipment = equipmentSource.value.find((item) => {
      const meta = metadata(item)
      return meta?.size === form.equipmentSize && meta?.kind === form.equipmentType
    })
    form.equipmentId = equipment?.id ?? ''
  },
)

watch(() => form.currencyId, () => {
  if (step.value === 7) rebuildRateLines()
})

onMounted(loadCatalogs)
</script>

<template>
  <div class="pricing-crystal-shell space-y-5">
    <div class="crystal-orb crystal-orb--one" />
    <div class="crystal-orb crystal-orb--two" />

    <DhPageHeader
      title="Seleccionar alternativa"
      description="Construya la alternativa paso a paso con catálogos filtrados por modalidad."
    />

    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 xl:grid-cols-7">
      <button
        v-for="(title, index) in stepTitles"
        :key="title"
        type="button"
        class="crystal-step"
        :class="{
          'crystal-step--active': index + 1 === step,
          'crystal-step--done': index + 1 < step,
        }"
        @click="index + 1 < step ? (step = index + 1) : undefined"
      >
        <span class="text-[10px] font-black uppercase tracking-[0.16em]">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="mt-1 block text-xs font-extrabold">{{ title }}</span>
      </button>
    </div>

    <section class="crystal-panel min-h-[470px] p-5 md:p-8">
      <div v-if="loadingCatalogs" class="grid min-h-[390px] place-items-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Cargando configuración de Pricing…
      </div>

      <template v-else>
        <div v-if="step === 1" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 1</p>
            <h2 class="crystal-title">Seleccione la modalidad</h2>
            <p class="crystal-description">Al elegir una modalidad se agrega Transporte Internacional como servicio inicial.</p>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="option in modalityOptions"
              :key="option.value"
              type="button"
              class="crystal-choice group"
              :class="form.modality === option.value ? 'crystal-choice--active' : ''"
              @click="chooseModality(option.value)"
            >
              <span class="crystal-icon"><component :is="modalityIcon(option.value)" class="h-6 w-6" /></span>
              <span class="mt-5 block text-lg font-black">{{ option.label }}</span>
              <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">{{ option.caption }}</span>
              <Check v-if="form.modality === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
            </button>
          </div>
        </div>

        <div v-else-if="step === 2" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 2</p>
            <h2 class="crystal-title">Tipo de embarque</h2>
            <p class="crystal-description">Solo se muestran los tipos compatibles con la modalidad elegida.</p>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <button
              v-for="option in shipmentModeOptions"
              :key="option.value"
              type="button"
              class="crystal-choice min-h-[120px]"
              :class="form.shipmentMode === option.value ? 'crystal-choice--active' : ''"
              @click="form.shipmentMode = option.value"
            >
              <span class="text-lg font-black">{{ option.label }}</span>
              <Check v-if="form.shipmentMode === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
            </button>
          </div>
        </div>

        <div v-else-if="step === 3" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 3</p>
            <h2 class="crystal-title">Ruta, equipo, Incoterm y servicios</h2>
            <p class="crystal-description">Destino corresponde al POE. Los equipos se filtran automáticamente por modalidad.</p>
          </div>

          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">
            <DhSelect v-model="form.originId" label="Origen" placeholder="Seleccione origen" :options="originOptions" />
            <DhSelect v-model="form.destinationId" label="Destino (POE)" placeholder="Seleccione POE" :options="destinationOptions" />

            <DhSelect
              v-if="equipmentHasSizes"
              v-model="form.equipmentSize"
              label="Tamaño"
              placeholder="Seleccione tamaño"
              :options="equipmentSizeOptions"
            />
            <DhSelect
              v-model="form.equipmentType"
              :label="equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'"
              :placeholder="equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'"
              :disabled="equipmentHasSizes && !form.equipmentSize"
              :options="equipmentTypeOptions"
            />

            <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />
            <DhSelect v-model="form.incotermId" label="Incoterm" placeholder="Seleccione Incoterm" :options="incotermOptions" />
            <DhInput v-model="form.loadDate" type="date" label="Fecha de carga" />

            <div class="md:col-span-2 xl:col-span-3">
              <PricingCrystalMultiSelect
                v-model="form.serviceIds"
                label="Servicios"
                placeholder="Seleccione servicios"
                search-placeholder="Buscar servicio..."
                :options="serviceOptions"
              />
            </div>
          </div>

          <div v-if="selectedEquipment || direction" class="crystal-route-summary">
            <div>
              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Operación</span>
              <strong class="mt-1 block text-sm">{{ direction || 'Por determinar' }}</strong>
            </div>
            <div v-if="selectedEquipment">
              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Equipo</span>
              <strong class="mt-1 block text-sm">{{ displayValue(selectedEquipment) }}</strong>
            </div>
            <div>
              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Servicios</span>
              <strong class="mt-1 block text-sm">{{ selectedServices.length }}</strong>
            </div>
          </div>
        </div>

        <div v-else-if="step === 4" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 4</p>
            <h2 class="crystal-title">Tarifas aprobadas disponibles</h2>
            <p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga.</p>
          </div>

          <div v-if="loadingRates" class="py-14 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>

          <template v-else-if="availableRates.length">
            <div class="grid gap-4 lg:grid-cols-2">
              <button
                v-for="rate in availableRates"
                :key="rate.id"
                type="button"
                class="crystal-rate-card"
                :class="form.selectedImportRateId === rate.id ? 'crystal-rate-card--active' : ''"
                @click="chooseRate(rate)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-black">{{ rate.carrier }}</p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                      {{ rate.pol }} → {{ rate.poe || rate.pod }} · {{ rate.containerType }}
                    </p>
                  </div>
                  <DhBadge variant="success">Aprobada</DhBadge>
                </div>
                <p class="mt-5 text-2xl font-black">{{ formatMoney(rate.freight, rate.currencyCode || rate.currency || 'USD') }}</p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Vigencia {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</p>
              </button>
            </div>
            <div class="flex justify-end">
              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>
            </div>
          </template>

          <div v-else class="crystal-empty p-9 text-center">
            <p class="text-lg font-black">No existen tarifas vigentes para esa ruta y tamaño de equipo</p>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">Puede continuar y capturar el flete manualmente.</p>
            <DhButton class="mt-5" @click="continueManual">Continuar de manera manual</DhButton>
          </div>

          <div v-if="form.manualRate && availableRates.length" class="crystal-soft px-4 py-3 text-sm font-bold">
            Se usará captura manual en la siguiente pantalla.
          </div>
        </div>

        <div v-else-if="step === 5" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 5</p>
            <h2 class="crystal-title">Proveedor y flete internacional</h2>
            <p class="crystal-description">Los selects muestran el Value configurado en Config.</p>
          </div>

          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">
            <DhSelect v-model="form.agentId" label="Agente" :options="agentOptions" />
            <DhSelect v-model="form.carrierId" label="Naviera / proveedor" :options="carrierOptions" />
            <DhSelect v-model="form.currencyId" label="Moneda" :options="currencyOptions" />
            <DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" label="Flete internacional · costo" />
            <DhInput v-model.number="form.freightSale" type="number" min="0" step="0.01" label="Flete internacional · venta" />
          </div>
        </div>

        <div v-else-if="step === 6" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 6</p>
            <h2 class="crystal-title">Descripción de carga y CABYS</h2>
          </div>

          <div class="crystal-soft space-y-4 p-4 md:p-5">
            <div class="flex flex-col gap-2 sm:flex-row">
              <div class="flex-1">
                <DhInput v-model="form.cabysSearch" label="Buscar CABYS de Hacienda" placeholder="Ej. repuestos, textiles, maquinaria…" @keyup.enter="searchCabys" />
              </div>
              <DhButton class="sm:mt-6" :disabled="loadingCabys" @click="searchCabys"><Search class="h-4 w-4" /> Buscar</DhButton>
            </div>

            <div v-if="cabysResults.length" class="max-h-52 overflow-auto rounded-[20px] border border-[var(--dh-border)] bg-[rgb(var(--dh-primary-rgb)/0.025)]">
              <button
                v-for="item in cabysResults"
                :key="item.code"
                type="button"
                class="flex w-full gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-left last:border-b-0 hover:bg-[rgb(var(--dh-primary-rgb)/0.06)]"
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
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <button type="button" class="crystal-flag" :class="form.dangerousCargo ? 'crystal-flag--active' : ''" @click="form.dangerousCargo = !form.dangerousCargo">
              <Check v-if="form.dangerousCargo" class="h-4 w-4" /> Carga peligrosa
            </button>
            <button type="button" class="crystal-flag" :class="form.nonStackable ? 'crystal-flag--active' : ''" @click="form.nonStackable = !form.nonStackable">
              <Check v-if="form.nonStackable" class="h-4 w-4" /> No estibable
            </button>
            <button type="button" class="crystal-flag" :class="form.overweight ? 'crystal-flag--active' : ''" @click="form.overweight = !form.overweight">
              <Check v-if="form.overweight" class="h-4 w-4" /> Sobrepeso
            </button>
          </div>
        </div>

        <div v-else class="space-y-6">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="crystal-kicker">Pantalla 7</p>
              <h2 class="crystal-title">Líneas de tarifa</h2>
              <p class="crystal-description">Las etapas se forman con el Incoterm y los servicios seleccionados.</p>
            </div>
            <div class="crystal-total-card">
              <span>Costo <strong>{{ formatMoney(totalCost, selectedCurrency?.code || 'USD') }}</strong></span>
              <span>Venta <strong>{{ formatMoney(totalSale, selectedCurrency?.code || 'USD') }}</strong></span>
              <span>Utilidad <strong>{{ formatMoney(totalUtility, selectedCurrency?.code || 'USD') }}</strong></span>
            </div>
          </div>

          <div v-for="section in visibleSections" :key="section" class="space-y-2">
            <h3 class="text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]">{{ sectionLabel(section) }}</h3>
            <div
              v-for="line in rateLines.filter((item) => item.section === section)"
              :key="line.key"
              class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(180px,1fr)_150px_150px_auto]"
            >
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-if="line.optional"
                    type="button"
                    class="crystal-mini-toggle"
                    :class="line.included ? 'crystal-mini-toggle--active' : ''"
                    @click="line.included = !line.included"
                  >
                    {{ line.included ? 'Incluido' : 'Excluir' }}
                  </button>
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

          <div class="crystal-soft p-4">
            <p class="mb-3 text-sm font-black">Agregar cargo manual</p>
            <div class="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <DhInput v-model="form.manualName" label="Nombre del cargo" />
              <DhSelect v-model="form.manualSection" label="Etapa" :options="visibleSections.map((value) => ({ value, label: sectionLabel(value) }))" />
              <DhButton class="md:mt-6" variant="secondary" :disabled="!form.manualName.trim()" @click="addManualCharge"><Plus class="h-4 w-4" /> Añadir cargo</DhButton>
            </div>
          </div>

          <div v-if="createdRateId" class="crystal-success p-4">
            <div class="flex items-center gap-3"><CircleCheck class="h-5 w-5" /><strong>Alternativa creada</strong></div>
            <p class="mt-1 text-xs font-semibold">ID: {{ createdRateId }}</p>
            <DhButton class="mt-3" variant="secondary" @click="resetWizard">Crear otra alternativa</DhButton>
          </div>
        </div>
      </template>
    </section>

    <div class="crystal-footer flex items-center justify-between gap-3 p-3">
      <DhButton variant="secondary" :disabled="step === 1 || saving" @click="previous"><ChevronLeft class="h-4 w-4" /> Atrás</DhButton>
      <div class="text-xs font-black tracking-[0.14em] text-[var(--dh-text-muted)]">{{ step }} / 7</div>
      <DhButton v-if="step < 7" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>
      <DhButton v-else :disabled="saving || !includedLines.length || Boolean(createdRateId)" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : 'Crear alternativa' }}</DhButton>
    </div>
  </div>
</template>

<style scoped>
.pricing-crystal-shell {
  position: relative;
  isolation: isolate;
  padding-bottom: 0.5rem;
}

.crystal-orb {
  position: absolute;
  z-index: -1;
  border-radius: 9999px;
  pointer-events: none;
  filter: blur(76px);
  opacity: 0.22;
  background: rgb(var(--dh-primary-rgb) / 0.48);
}

.crystal-orb--one {
  width: 260px;
  height: 260px;
  top: 70px;
  right: 6%;
}

.crystal-orb--two {
  width: 220px;
  height: 220px;
  top: 420px;
  left: 2%;
  opacity: 0.13;
}

.crystal-panel,
.crystal-stepbar,
.crystal-footer,
.crystal-soft,
.crystal-route-summary,
.crystal-total-card,
.crystal-line,
.crystal-success {
  border: 1px solid color-mix(in srgb, var(--dh-border-strong) 64%, transparent);
  background: color-mix(in srgb, var(--dh-card) 68%, transparent);
  box-shadow: 0 22px 65px rgb(15 23 42 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.32);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
}

.crystal-panel {
  border-radius: 30px;
  overflow: visible;
}

.crystal-stepbar,
.crystal-footer {
  border-radius: 22px;
}

.crystal-step {
  min-height: 58px;
  border-radius: 16px;
  border: 1px solid transparent;
  padding: 0.6rem 0.75rem;
  text-align: left;
  color: var(--dh-text-muted);
  transition: 180ms ease;
}

.crystal-step:hover {
  background: rgb(var(--dh-primary-rgb) / 0.05);
}

.crystal-step--active {
  border-color: rgb(var(--dh-primary-rgb) / 0.24);
  background: rgb(var(--dh-primary-rgb) / 0.1);
  color: var(--dh-text);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.24);
}

.crystal-step--done {
  color: var(--dh-text-soft);
  background: color-mix(in srgb, var(--dh-card-hover) 52%, transparent);
}

.crystal-choice,
.crystal-rate-card,
.crystal-empty,
.crystal-flag {
  position: relative;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--dh-border) 72%, transparent);
  background: color-mix(in srgb, var(--dh-card) 54%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.25);
  backdrop-filter: blur(20px) saturate(135%);
  -webkit-backdrop-filter: blur(20px) saturate(135%);
  transition: 180ms ease;
}

.crystal-choice {
  min-height: 150px;
  padding: 1.25rem;
  text-align: left;
}

.crystal-choice:hover,
.crystal-rate-card:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--dh-primary-rgb) / 0.32);
  box-shadow: 0 18px 48px rgb(15 23 42 / 0.09), inset 0 1px 0 rgb(255 255 255 / 0.32);
}

.crystal-choice--active,
.crystal-rate-card--active {
  border-color: rgb(var(--dh-primary-rgb) / 0.44);
  background: rgb(var(--dh-primary-rgb) / 0.085);
  box-shadow: 0 18px 55px rgb(var(--dh-primary-rgb) / 0.11), inset 0 1px 0 rgb(255 255 255 / 0.32);
}

.crystal-icon {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 16px;
  background: rgb(var(--dh-primary-rgb) / 0.095);
  color: var(--dh-primary);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.crystal-soft {
  border-radius: 24px;
  box-shadow: 0 14px 40px rgb(15 23 42 / 0.055), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.crystal-route-summary {
  display: grid;
  gap: 1rem;
  border-radius: 20px;
  padding: 0.85rem 1rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.crystal-rate-card {
  padding: 1rem;
  text-align: left;
}

.crystal-empty {
  border-style: dashed;
}

.crystal-flag {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  font-size: 0.875rem;
  font-weight: 800;
}

.crystal-flag--active,
.crystal-mini-toggle--active {
  border-color: rgb(var(--dh-primary-rgb) / 0.3);
  background: rgb(var(--dh-primary-rgb) / 0.1);
  color: var(--dh-primary);
}

.crystal-total-card {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 1rem;
  border-radius: 18px;
  padding: 0.75rem 0.9rem;
  font-size: 0.78rem;
}

.crystal-total-card span {
  display: flex;
  gap: 0.3rem;
}

.crystal-line {
  border-radius: 20px;
}

.crystal-mini-toggle {
  border-radius: 999px;
  border: 1px solid var(--dh-border);
  padding: 0.24rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 900;
  transition: 150ms ease;
}

.crystal-success {
  border-color: rgb(16 185 129 / 0.28);
  border-radius: 20px;
  background: rgb(16 185 129 / 0.08);
}

.crystal-kicker {
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--dh-primary);
}

.crystal-title {
  margin-top: 0.25rem;
  font-size: clamp(1.35rem, 2vw, 1.8rem);
  font-weight: 900;
  letter-spacing: -0.025em;
  color: var(--dh-text);
}

.crystal-description {
  margin-top: 0.35rem;
  max-width: 760px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--dh-text-muted);
}

.crystal-panel :deep(select),
.crystal-panel :deep(input) {
  background-color: color-mix(in srgb, var(--dh-input) 68%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

@media (max-width: 640px) {
  .crystal-panel {
    border-radius: 24px;
  }

  .crystal-orb {
    opacity: 0.12;
  }
}
</style>
