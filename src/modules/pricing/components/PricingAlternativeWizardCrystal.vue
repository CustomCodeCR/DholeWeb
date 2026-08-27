<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Plane,
  Plus,
  Search,
  Ship,
  Sparkles,
  Truck,
  Waypoints,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type {
  BrowseImportRatesQuery,
  ChargeBasis,
  CostDetailType,
  CostPortRole,
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
import PricingInteractiveOsmMap from '@/modules/pricing/components/PricingInteractiveOsmMap.vue'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'
import {
  calculateCargoInsurance,
  canonicalServiceLine,
  cargoInsuranceNote,
  commercialTermKey,
  incotermBuyerPaysMainTransport,
  incotermRateSections,
  resolveCommercialTerms,
} from '@/modules/pricing/services/pricingCommercialRules'

type Modality = 'Maritime' | 'Air' | 'Land' | 'Multimodal'
type RateSection =
  | 'pickup_origin'
  | 'origin_charges'
  | 'international_freight'
  | 'destination_charges'
  | 'delivery_destination'

interface CatalogMetadata {
  modality?: string
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
  taxRate?: number | string
  vatRate?: number | string
  address?: string
  latitude?: number | string
  longitude?: number | string
  lat?: number | string
  lng?: number | string
  size?: string
  kind?: string
}

interface CabysItem {
  code: string
  description: string
}

interface NearestPortRecommendation {
  portId: string
  name: string
  reason: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name?: string
}

interface RateLine {
  key: string
  section: RateSection
  name: string
  costDetailType: CostDetailType
  costType: CostType
  chargeBasis: ChargeBasis
  costId?: string | null
  contextLabel?: string | null
  notes?: string | null
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  included: boolean
  optional: boolean
  manual: boolean
  applyDestinationTax?: boolean
}

const router = useRouter()
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
const locatingPickup = ref(false)
const recommendingPorts = ref(false)
const nearestPortRecommendations = ref<NearestPortRecommendation[]>([])

const catalogs = reactive({
  shipmentModes: [] as CatalogItemSelectDto[],
  services: [] as CatalogItemSelectDto[],
  incoterms: [] as CatalogItemSelectDto[],
  pol: [] as CatalogItemSelectDto[],
  pod: [] as CatalogItemSelectDto[],
  poe: [] as CatalogItemSelectDto[],
  landEquipmentTypes: [] as CatalogItemSelectDto[],
  landEquipmentSizes: [] as CatalogItemSelectDto[],
  landEquipmentKinds: [] as CatalogItemSelectDto[],
  containers: [] as CatalogItemSelectDto[],
  agents: [] as CatalogItemSelectDto[],
  carriers: [] as CatalogItemSelectDto[],
  currencies: [] as CatalogItemSelectDto[],
  warehouses: [] as CatalogItemSelectDto[],
  countries: [] as CatalogItemSelectDto[],
})

const form = reactive({
  modality: '' as Modality | '',
  shipmentMode: '',
  originId: '',
  destinationId: '',
  podId: '',
  equipmentSize: '',
  equipmentType: '',
  equipmentId: '',
  equipmentQuantity: 1,
  incotermId: '',
  serviceIds: [] as string[],
  loadDate: todayIso(),
  selectedImportRateId: '',
  manualRate: false,
  clientName: '',
  pickupAddress: '',
  warehouseId: '',
  pickupLatitude: null as number | null,
  pickupLongitude: null as number | null,
  freeDays: 0,
  transitDays: 0,
  agentId: '',
  carrierId: '',
  currencyId: '',
  freightCost: 0,
  freightSale: 0,
  cabysSearch: '',
  cabysCode: '',
  cargoDescription: '',
  cargoObservations: '',
  cargoValue: 0,
  dangerousCargo: false,
  nonStackable: false,
  overweight: false,
  merchantHaulage: false,
  carrierHaulage: false,
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
  { value: 'Land', label: 'Terrestre', caption: 'FTL y LTL' },
  { value: 'Multimodal', label: 'Multimodal', caption: 'Marítimo + terrestre' },
]

const allowedShipmentModes: Record<Modality, string[]> = {
  Maritime: ['FCL', 'LCL'],
  Air: ['LCL'],
  Land: ['FTL', 'LTL'],
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

  const best = scored[0]
  if (!best) return null
  const second = scored[1]
  if (second && best.score === second.score) return null
  return best.item
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
    pickup_origin: 'Recolecta',
    origin_charges: 'Cargos en Origen',
    international_freight: 'Flete Internacional',
    destination_charges: 'Cargos en Destino',
    delivery_destination: 'Entrega',
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

  if (modality === 'Land') {
    return catalogs.landEquipmentTypes.filter((item) => {
      const meta = metadata(item)
      if (meta?.modality && meta.modality.toLocaleLowerCase() !== 'land') return false

      if (meta?.shipmentModes?.length && form.shipmentMode) {
        const currentMode = form.shipmentMode.toUpperCase()
        return meta.shipmentModes.some(
          (value) => String(value).trim().toUpperCase() === currentMode,
        )
      }

      return true
    })
  }

  return catalogs.containers.filter((item) => {
    const meta = metadata(item)
    const normalizedModality = modality.toLocaleLowerCase()

    if (meta?.modalities?.length) {
      return meta.modalities.some(
        (value) => String(value).trim().toLocaleLowerCase() === normalizedModality,
      )
    }

    if (meta?.shipmentModes?.length && form.shipmentMode) {
      const currentMode = form.shipmentMode.toUpperCase()
      if (meta.shipmentModes.some((value) => String(value).trim().toUpperCase() === currentMode)) {
        return true
      }
    }

    if (modality === 'Air') {
      const value = displayValue(item).toUpperCase()
      return ['LOOSE', 'PALLET', 'ULD'].some((kind) => value.includes(kind))
    }

    return true
  })
})

const equipmentHasSizes = computed(() => equipmentSource.value.some((item) => Boolean(metadata(item)?.size)))

const equipmentSizeOptions = computed(() => {
  const availableSizes = new Set(
    equipmentSource.value
      .map((item) => metadata(item)?.size?.trim())
      .filter((value): value is string => Boolean(value)),
  )

  if (form.modality === 'Land' && catalogs.landEquipmentSizes.length) {
    return catalogs.landEquipmentSizes
      .filter((item) => availableSizes.has(displayValue(item)))
      .map((item) => ({ value: displayValue(item), label: item.label || `${displayValue(item)} pies` }))
  }

  return [...availableSizes]
    .sort((a, b) => number(a) - number(b))
    .map((size) => ({ value: size, label: size }))
})

const equipmentTypeOptions = computed(() => {
  if (!equipmentHasSizes.value) {
    return equipmentSource.value.map((item) => ({ value: item.id, label: item.label || displayValue(item) }))
  }

  if (!form.equipmentSize) return []

  const availableKinds = new Set(
    equipmentSource.value
      .filter((item) => metadata(item)?.size === form.equipmentSize)
      .map((item) => metadata(item)?.kind?.trim())
      .filter((value): value is string => Boolean(value)),
  )

  if (form.modality === 'Land' && catalogs.landEquipmentKinds.length) {
    const configured = catalogs.landEquipmentKinds
      .filter((item) => availableKinds.has(item.slug))
      .map((item) => ({ value: item.slug, label: item.label || displayValue(item) }))

    if (configured.length) return configured
  }

  return [...availableKinds].map((kind) => ({
    value: kind,
    label: kindLabels[kind] ?? kind.replaceAll('-', ' '),
  }))
})

const selectedOrigin = computed(() => findById(catalogs.pol, form.originId))
const selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))
const selectedPod = computed(() => findById(catalogs.pod, form.podId))
const selectedEquipment = computed(() => findById(equipmentSource.value, form.equipmentId))
const selectedIncoterm = computed(() => findById(catalogs.incoterms, form.incotermId))
const selectedIncotermCode = computed(() => String(selectedIncoterm.value?.code ?? displayValue(selectedIncoterm.value)).toUpperCase())
const selectedWarehouse = computed(() => findById(catalogs.warehouses, form.warehouseId))

function metadataNumber(item: CatalogItemSelectDto | null | undefined, ...keys: Array<keyof CatalogMetadata>) {
  const meta = metadata(item)
  for (const key of keys) {
    const raw = meta?.[key]
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function warehouseAddress(item: CatalogItemSelectDto | null | undefined) {
  const meta = metadata(item)
  return String(meta?.address ?? displayValue(item) ?? item?.label ?? '').trim()
}

const pickupCoordinates = computed(() => {
  if (form.pickupLatitude == null || form.pickupLongitude == null) return null
  return { latitude: form.pickupLatitude, longitude: form.pickupLongitude }
})
const warehouseMapMarkers = computed(() =>
  catalogs.warehouses.flatMap((warehouse) => {
    let latitude = metadataNumber(warehouse, 'latitude', 'lat')
    let longitude = metadataNumber(warehouse, 'longitude', 'lng')

    if (warehouse.id === form.warehouseId) {
      latitude ??= form.pickupLatitude
      longitude ??= form.pickupLongitude
    }

    if (latitude == null || longitude == null) return []
    return [{
      id: warehouse.id,
      label: warehouse.label || displayValue(warehouse) || warehouse.code,
      latitude,
      longitude,
      selected: warehouse.id === form.warehouseId,
    }]
  }),
)
const exwLocationReady = computed(() =>
  selectedIncotermCode.value !== 'EXW' ||
  Boolean(form.pickupAddress.trim() && pickupCoordinates.value),
)
const fcaLocationReady = computed(() =>
  selectedIncotermCode.value !== 'FCA' ||
  (catalogs.warehouses.length
    ? Boolean(form.warehouseId)
    : Boolean(form.pickupAddress.trim() && pickupCoordinates.value)),
)
const selectedServices = computed(() => catalogs.services.filter((item) => form.serviceIds.includes(item.id)))
const cargoInsuranceService = computed(() =>
  catalogs.services.find((item) => {
    const value = normalizeCatalogValue(displayValue(item))
    return value.includes('seguro') && value.includes('carga')
  }) ?? null,
)
const effectiveServices = computed(() => {
  const services = [...selectedServices.value]
  const insurance = cargoInsuranceService.value
  if (form.cargoValue > 0 && insurance && !services.some((item) => item.id === insurance.id)) {
    services.push(insurance)
  }
  return services
})
const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))
const selectedCarrier = computed(() => findById(catalogs.carriers, form.carrierId))
const selectedCurrency = computed(() => findById(catalogs.currencies, form.currencyId))
const destinationCountryCode = computed(() => {
  const configured = String(metadata(selectedDestination.value)?.countryCode ?? '').trim().toUpperCase()
  if (configured) return configured
  const destination = normalizeCatalogValue(displayValue(selectedDestination.value))
  if (destination.includes('costa rica')) return 'CR'
  if (destination.includes('panama')) return 'PA'
  if (destination.includes('guatemala')) return 'GT'
  return ''
})
const destinationTaxRate = computed(() => {
  const country = catalogs.countries.find((item) => {
    const code = String(item.code ?? metadata(item)?.countryCode ?? '').trim().toUpperCase()
    return code === destinationCountryCode.value
  })
  return Math.max(0, metadataNumber(country, 'vatRate', 'taxRate') ?? 0)
})
const selectedImportRate = computed(() => availableRates.value.find((rate) => rate.id === form.selectedImportRateId) ?? null)

function rateCommentRank(comment?: string | null) {
  const value = normalizeCatalogValue(String(comment ?? ''))
  if (!value) return 1
  const negative = ['sin espacio', 'no disponible', 'no space', 'not available', 'full', 'cerrado', 'closed', 'negativo', 'rechazado']
  if (negative.some((term) => value.includes(normalizeCatalogValue(term)))) return 0
  const positive = ['espacio disponible', 'disponible', 'available', 'confirmado', 'confirmed', 'positivo', 'ok', 'aprobado']
  if (positive.some((term) => value.includes(normalizeCatalogValue(term)))) return 2
  return 1
}

const sortedAvailableRates = computed(() =>
  [...availableRates.value].sort((left, right) => {
    const price = number(left.freight) - number(right.freight)
    if (price !== 0) return price
    const comment = rateCommentRank(right.spaceComment) - rateCommentRank(left.spaceComment)
    if (comment !== 0) return comment
    return new Date(right.validTo).getTime() - new Date(left.validTo).getTime()
  }),
)

function remainingValidityDays(validTo: string) {
  const end = new Date(`${String(validTo).slice(0, 10)}T12:00:00`)
  const today = new Date(`${todayIso()}T12:00:00`)
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000))
}

const originOptions = computed(() => catalogs.pol.map((item) => ({ value: item.id, label: displayValue(item) })))
const destinationOptions = computed(() => catalogs.poe.map((item) => ({ value: item.id, label: displayValue(item) })))
const podOptions = computed(() => catalogs.pod.map((item) => ({ value: item.id, label: displayValue(item) })))
const incotermOptions = computed(() => catalogs.incoterms.map((item) => ({ value: item.id, label: displayValue(item) })))
const agentOptions = computed(() => catalogs.agents.map((item) => ({ value: item.id, label: displayValue(item) })))
const carrierOptions = computed(() => catalogs.carriers.map((item) => ({ value: item.id, label: displayValue(item) })))
const currencyOptions = computed(() => catalogs.currencies.map((item) => ({ value: item.id, label: displayValue(item) })))
const serviceOptions = computed(() => catalogs.services.map((item) => ({ value: item.id, label: displayValue(item) })))
const warehouseOptions = computed(() => catalogs.warehouses.map((item) => ({
  value: item.id,
  label: item.label || displayValue(item) || item.code,
})))

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

const incotermResponsibilitySections = computed<RateSection[]>(() => {
  const configured = (metadata(selectedIncoterm.value)?.rateSections ?? ['international_freight']) as RateSection[]
  return incotermRateSections(selectedIncoterm.value?.code, configured) as RateSection[]
})

const visibleSections = computed<RateSection[]>(() => {
  // El Incoterm es el límite de responsabilidad. Servicios y costos pueden aportar
  // líneas dentro de ese límite, pero nunca volver a mostrar una etapa que el
  // Incoterm quitó para el comprador.
  const allowed = new Set<RateSection>(incotermResponsibilitySections.value)
  return sectionOrder.filter((section) => allowed.has(section))
})

const includedLines = computed(() => rateLines.value.filter((line) => line.included))
const optionalChargeOptions = computed(() =>
  rateLines.value
    .filter((line) => line.optional)
    .map((line) => ({
      value: line.key,
      label: `${line.name} · ${sectionLabel(line.section)}`,
    })),
)
const selectedOptionalChargeKeys = computed<string[]>({
  get: () =>
    rateLines.value
      .filter((line) => line.optional && line.included)
      .map((line) => line.key),
  set: (keys) => {
    const selected = new Set(keys)
    rateLines.value.forEach((line) => {
      if (line.optional) line.included = selected.has(line.key)
    })
  },
})
function standardSectionLines(section: RateSection) {
  return rateLines.value.filter(
    (line) =>
      line.section === section &&
      line.included &&
      !line.optional &&
      !line.manual &&
      line.costDetailType !== 'AgentCharge',
  )
}

const agentLines = computed(() =>
  rateLines.value.filter(
    (line) => line.included && !line.optional && !line.manual && line.costDetailType === 'AgentCharge',
  ),
)

const insuranceLines = computed(() =>
  rateLines.value.filter((line) => line.included && !line.manual && line.costDetailType === 'Insurance'),
)

const bottomRateLines = computed(() =>
  rateLines.value.filter(
    (line) => line.included && (line.optional || line.manual) && line.costDetailType !== 'Insurance',
  ),
)

const orderedRateGroups = computed(() => [
  { key: 'pickup', label: 'Recolecta', lines: standardSectionLines('pickup_origin') },
  { key: 'origin', label: 'Cargos de origen', lines: standardSectionLines('origin_charges') },
  { key: 'agent', label: 'Costos de agente', lines: agentLines.value },
  { key: 'freight', label: 'Flete internacional', lines: standardSectionLines('international_freight') },
  { key: 'destination', label: 'Cargos en destino', lines: standardSectionLines('destination_charges') },
  { key: 'insurance', label: 'Seguro de carga', lines: insuranceLines.value },
  { key: 'delivery', label: 'Entrega', lines: standardSectionLines('delivery_destination') },
].filter((group) => group.lines.length > 0))

const providerAgentCosts = computed(() => {
  const seen = new Set<string>()
  return applicableConfiguredCosts().filter((cost) => {
    if (cost.costDetailType !== 'AgentCharge' || cost.costType === 'Optional') return false
    const key = normalizeCatalogValue(cost.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const providerAgentCost = computed(() =>
  providerAgentCosts.value.reduce((sum, cost) => sum + number(cost.costAmount), 0),
)
const providerAgentSale = computed(() =>
  providerAgentCosts.value.reduce((sum, cost) => sum + number(cost.saleAmount), 0),
)
const providerCost = computed(() => number(form.freightCost) + providerAgentCost.value)
const providerSale = computed(() => number(form.freightSale) + providerAgentSale.value)
const providerUtility = computed(() => providerSale.value - providerCost.value)
const providerMarginPercentage = computed(() =>
  providerSale.value > 0 ? (providerUtility.value / providerSale.value) * 100 : 0,
)
function canApplyDestinationTax(line: RateLine) {
  return line.section === 'destination_charges' || line.optional
}
function lineTaxAmount(line: RateLine) {
  return line.applyDestinationTax && canApplyDestinationTax(line)
    ? Math.round(number(line.saleAmount) * destinationTaxRate.value) / 100
    : 0
}
function lineSaleWithTax(line: RateLine) {
  return number(line.saleAmount) + lineTaxAmount(line)
}
const totalCost = computed(() => includedLines.value.reduce((sum, line) => sum + number(line.costAmount), 0))
const totalSale = computed(() => includedLines.value.reduce((sum, line) => sum + lineSaleWithTax(line), 0))
const totalUtility = computed(() => totalSale.value - totalCost.value)
const totalMarginPercentage = computed(() =>
  totalSale.value > 0 ? (totalUtility.value / totalSale.value) * 100 : 0,
)

function financialTone(value: number) {
  if (value < 0) return 'danger'
  if (value > 0) return 'success'
  return 'neutral'
}

function validityTone(validTo: string) {
  const days = remainingValidityDays(validTo)
  if (days <= 3) return 'danger'
  if (days <= 7) return 'warning'
  return 'success'
}

const canNext = computed(() => {
  if (step.value === 1) return Boolean(form.modality)
  if (step.value === 2) return Boolean(form.shipmentMode)
  if (step.value === 3) {
    return Boolean(
      form.originId &&
      form.destinationId &&
      selectedEquipment.value &&
      form.equipmentQuantity > 0 &&
      form.incotermId &&
      form.serviceIds.length &&
      form.loadDate &&
      exwLocationReady.value &&
      fcaLocationReady.value,
    )
  }
  if (step.value === 4) return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)
  if (step.value === 5) return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)
  if (step.value === 6) return true
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

function sectionFromPortRole(
  role: CostPortRole | null | undefined,
  detailType: CostDetailType,
): RateSection | null {
  if (!role || role === 'Any') return null
  if (role === 'Pol') {
    return detailType === 'InlandTransport' ? 'pickup_origin' : 'origin_charges'
  }
  return detailType === 'InlandTransport' ? 'delivery_destination' : 'destination_charges'
}

function sectionForDetail(type: CostDetailType, name = ''): RateSection {
  const normalized = normalizeCatalogValue(name)
  const mentionsOrigin = /(^| )(origen|origin)( |$)/.test(normalized)
  const mentionsDestination = /(^| )(destino|destination)( |$)/.test(normalized)
  const mentionsPickup = /recole|pickup/.test(normalized)
  const mentionsDelivery = /entrega|delivery/.test(normalized)

  if (type === 'Freight') return 'international_freight'
  if (type === 'OriginCharge') return 'origin_charges'
  if (type === 'DestinationCharge' || type === 'Insurance') return 'destination_charges'
  if (type === 'PortCharge') return mentionsOrigin ? 'origin_charges' : 'destination_charges'
  if (type === 'InlandTransport') {
    return mentionsPickup || mentionsOrigin ? 'pickup_origin' : 'delivery_destination'
  }
  if (type === 'CustomsCharge') {
    return mentionsOrigin || /exterior|export/.test(normalized)
      ? 'origin_charges'
      : 'destination_charges'
  }
  if (type === 'AgentCharge') {
    if (mentionsOrigin) return 'origin_charges'
    if (mentionsDestination) return 'destination_charges'
    return normalizeCatalogValue(direction.value).includes('exportacion')
      ? 'origin_charges'
      : 'destination_charges'
  }
  if (type === 'Documentation') {
    if (mentionsOrigin) return 'origin_charges'
    if (mentionsDestination) return 'destination_charges'
    return 'international_freight'
  }
  if (mentionsPickup) return 'pickup_origin'
  if (mentionsDelivery) return 'delivery_destination'
  if (mentionsOrigin) return 'origin_charges'
  return 'destination_charges'
}

function sectionForCost(cost: CostSelectDto): RateSection {
  const byPortRole = sectionFromPortRole(cost.portRole, cost.costDetailType)
  if (byPortRole) return byPortRole

  if (cost.polId && !cost.poeId && !cost.podId) {
    return cost.costDetailType === 'InlandTransport' ? 'pickup_origin' : 'origin_charges'
  }
  if ((cost.poeId || cost.podId) && !cost.polId) {
    return cost.costDetailType === 'InlandTransport'
      ? 'delivery_destination'
      : 'destination_charges'
  }

  return sectionForDetail(cost.costDetailType, cost.name)
}

function sectionForManual(section: RateSection): CostDetailType {
  if (section === 'international_freight') return 'Freight'
  if (section === 'origin_charges') return 'OriginCharge'
  if (section === 'destination_charges') return 'DestinationCharge'
  if (section === 'pickup_origin' || section === 'delivery_destination') return 'InlandTransport'
  return 'Other'
}

function defaultChargeBasis(type: CostDetailType): ChargeBasis {
  if (type === 'Documentation') return 'PerDocument'
  if (type === 'Freight' || type === 'InlandTransport') {
    if (shipmentModeForApi.value === 'Fcl') return 'PerContainer'
    if (shipmentModeForApi.value === 'Ftl') return 'PerTruck'
    if (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'Ltl') {
      return 'PerChargeableCbm'
    }
  }
  return 'PerShipment'
}

function quantityForChargeBasis(basis: ChargeBasis) {
  if (basis === 'PerContainer' || basis === 'PerTruck') {
    return Math.max(1, form.equipmentQuantity)
  }
  if (basis === 'PerTeu') {
    const equipment = `${selectedEquipment.value?.code ?? ''} ${displayValue(selectedEquipment.value)}`
    const multiplier = /(^|\D)20(\D|$)/.test(equipment) ? 1 : 2
    return Math.max(1, form.equipmentQuantity) * multiplier
  }
  return 1
}

function detailTypeLabel(type: CostDetailType) {
  return ({
    Freight: 'Flete internacional',
    AgentCharge: 'Costo de agente',
    OriginCharge: 'Cargo en origen',
    DestinationCharge: 'Cargo en destino',
    PortCharge: 'Cargo portuario',
    CustomsCharge: 'Aduana',
    InlandTransport: 'Transporte interno',
    Documentation: 'Documentación',
    Insurance: 'Seguro',
    Other: 'Otro',
  } as Record<CostDetailType, string>)[type]
}

function chargeBasisLabel(basis: ChargeBasis) {
  return ({
    PerShipment: 'Por embarque',
    PerContainer: 'Por contenedor',
    PerTeu: 'Por TEU',
    PerTruck: 'Por camión',
    PerCbm: 'Por CBM',
    PerChargeableCbm: 'Por CBM cobrable',
    PerKg: 'Por kg',
    Per100Kg: 'Por 100 kg',
    PerTon: 'Por tonelada',
    PerPallet: 'Por pallet',
    PerPackage: 'Por bulto',
    PerDocument: 'Por documento',
  } as Record<ChargeBasis, string>)[basis]
}

function costContextLabel(cost: CostSelectDto) {
  const parts: string[] = []
  if (cost.agentName) parts.push(`Agente: ${cost.agentName}`)
  if (cost.carrierName) parts.push(`Naviera: ${cost.carrierName}`)
  if (cost.polName) parts.push(`POL: ${cost.polName}`)
  if (cost.poeName) parts.push(`POE: ${cost.poeName}`)
  if (cost.podName) parts.push(`POD: ${cost.podName}`)
  if (cost.portName && !parts.some((part) => part.includes(cost.portName!))) {
    const role = cost.portRole && cost.portRole !== 'Any' ? cost.portRole.toUpperCase() : 'Puerto'
    parts.push(`${role}: ${cost.portName}`)
  }
  return parts.join(' · ') || null
}

function applicableCost(cost: CostSelectDto) {
  if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
  if (cost.incoterms?.length && !cost.incoterms.some((incoterm) => incoterm.id === form.incotermId)) return false
  if (cost.carrierId && cost.carrierId !== form.carrierId) return false
  if (cost.agentId && cost.agentId !== form.agentId) return false
  if (cost.polId && cost.polId !== form.originId) return false
  if (cost.poeId && cost.poeId !== form.destinationId) return false
  if (cost.podId && cost.podId !== form.podId) return false
  if (!incotermResponsibilitySections.value.includes(sectionForCost(cost))) return false

  if (cost.portId) {
    const matchesLegacyPort = cost.portRole === 'Pol'
      ? cost.portId === form.originId
      : cost.portRole === 'Poe'
        ? cost.portId === form.destinationId
        : cost.portRole === 'Pod'
          ? cost.portId === form.podId
          : [form.originId, form.destinationId, form.podId].includes(cost.portId)
    if (!matchesLegacyPort) return false
  }

  return true
}

function costSpecificity(cost: CostSelectDto) {
  let score = 0
  if (cost.shipmentMode) score += 2
  if (cost.incoterms?.length) score += 2
  if (cost.carrierId) score += 3
  if (cost.agentId) score += 3
  if (cost.polId) score += 4
  if (cost.poeId) score += 4
  if (cost.podId) score += 4
  if (cost.portId) score += 4
  if (cost.portRole && cost.portRole !== 'Any') score += 1
  return score
}

function isDangerousCargoCost(cost: CostSelectDto) {
  const value = normalizeCatalogValue(`${cost.name} ${cost.notes ?? ''}`)
  return value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')
}

function isOverweightCost(cost: CostSelectDto) {
  const value = normalizeCatalogValue(`${cost.name} ${cost.notes ?? ''}`)
  return value.includes('sobrepeso') || value.includes('overweight') || value.includes('over weight')
}

function isCargoConditionLine(line: RateLine, kind: 'dangerous' | 'overweight') {
  const value = normalizeCatalogValue(line.name)
  return kind === 'dangerous'
    ? value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')
    : value.includes('sobrepeso') || value.includes('overweight') || value.includes('over weight')
}

function applicableConfiguredCosts() {
  return costs.value
    .filter(applicableCost)
    .sort((left, right) => costSpecificity(right) - costSpecificity(left))
}

async function loadApplicableCosts() {
  try {
    costs.value = await PricingService.selectCosts({
      carrierId: form.carrierId || undefined,
      agentId: form.agentId || undefined,
      polId: form.originId || undefined,
      poeId: form.destinationId || undefined,
      podId: form.podId || undefined,
      incotermId: form.incotermId || undefined,
      shipmentMode: shipmentModeForApi.value,
      isActive: true,
      applicableToContext: true,
    } as any)
  } catch (error) {
    costs.value = []
    toastStore.backendError(
      error,
      'No se pudieron cargar los costos que coinciden con Naviera, Agente, POL, POE, POD e Incoterm.',
    )
  }
}

function rebuildRateLines() {
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return

  const visible = new Set(visibleSections.value)
  const lines: RateLine[] = []
  const hasEquivalent = (name: string, detailType: CostDetailType) =>
    lines.some((line) =>
      line.costDetailType === detailType &&
      normalizeCatalogValue(line.name) === normalizeCatalogValue(name),
    )

  if (visible.has('international_freight')) {
    lines.push({
      key: 'freight',
      section: 'international_freight',
      name: 'Flete Internacional',
      costDetailType: 'Freight',
      costType: 'Variable',
      chargeBasis: defaultChargeBasis('Freight'),
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

  const configuredCosts = applicableConfiguredCosts()
  configuredCosts.forEach((cost) => {
    const section = sectionForCost(cost)
    if (!visible.has(section)) return
    if (cost.costDetailType === 'Freight' && lines.some((line) => line.costDetailType === 'Freight')) return
    if (hasEquivalent(cost.name, cost.costDetailType)) return
    lines.push({
      key: `cost:${cost.id}`,
      section,
      name: cost.name,
      costDetailType: cost.costDetailType,
      costType: cost.costType,
      chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
      costId: cost.id,
      contextLabel: costContextLabel(cost),
      notes: cost.notes?.trim() || null,
      currencyId: cost.currencyId,
      currencyName: cost.currencyName,
      currencyCode: cost.currencyCode,
      costAmount: number(cost.costAmount),
      saleAmount: number(cost.saleAmount),
      included:
        cost.costType !== 'Optional' ||
        (form.dangerousCargo && isDangerousCargoCost(cost)) ||
        (form.overweight && isOverweightCost(cost)),
      optional: cost.costType === 'Optional',
      manual: false,
    })
  })


const addVariableSectionFallback = (
  section: RateSection,
  name: string,
  detailType: CostDetailType,
  contextLabel: string,
) => {
  const alreadyPresent = section === 'pickup_origin'
    ? lines.some((line) => line.section === section && line.costDetailType === 'InlandTransport')
    : lines.some((line) => line.section === section && line.costDetailType === 'OriginCharge')
  if (!visible.has(section) || alreadyPresent) return
  lines.push({
    key: `variable-section:${section}`,
    section,
    name,
    costDetailType: detailType,
    costType: 'Variable',
    chargeBasis: defaultChargeBasis(detailType),
    contextLabel,
    currencyId: currency.id,
    currencyName: displayValue(currency),
    currencyCode: currency.code,
    costAmount: 0,
    saleAmount: 0,
    included: true,
    optional: false,
    manual: false,
  })
}

addVariableSectionFallback(
  'pickup_origin',
  'Recolecta',
  'InlandTransport',
  'Variable: complete costo y venta según la recolección aplicable.',
)
addVariableSectionFallback(
  'origin_charges',
  'Cargos en Origen',
  'OriginCharge',
  'Variable: complete costo y venta según los cargos de origen aplicables.',
)

  const cargoConditionSection: RateSection | null = visible.has('destination_charges')
    ? 'destination_charges'
    : visible.has('international_freight')
      ? 'international_freight'
      : visibleSections.value[0] ?? null

  const addCargoConditionFallback = (kind: 'dangerous' | 'overweight', name: string) => {
    if (!cargoConditionSection || lines.some((line) => isCargoConditionLine(line, kind))) return
    lines.push({
      key: `cargo-condition:${kind}`,
      section: cargoConditionSection,
      name,
      costDetailType: 'Other',
      costType: 'Variable',
      chargeBasis: 'PerShipment',
      contextLabel: 'Agregado automáticamente por condición de carga.',
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: 0,
      saleAmount: 0,
      included: true,
      optional: false,
      manual: false,
    })
  }

  if (form.dangerousCargo) addCargoConditionFallback('dangerous', 'Carga peligrosa')
  if (form.overweight) addCargoConditionFallback('overweight', 'Sobrepeso')

  const addHaulageOption = (key: string, name: string) => {
    if (!visible.has('destination_charges')) return
    lines.push({
      key,
      section: 'destination_charges',
      name,
      costDetailType: 'InlandTransport',
      costType: 'Optional',
      chargeBasis: 'PerShipment',
      contextLabel: 'Opción agregada automáticamente según la responsabilidad de transporte seleccionada.',
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: 0,
      saleAmount: 0,
      included: false,
      optional: true,
      manual: false,
    })
  }
  if (form.merchantHaulage) addHaulageOption('haulage:merchant', 'Gate + Inland GAM Merchant')
  if (form.carrierHaulage) addHaulageOption('haulage:carrier', 'Inland GAM Naviera')

  if (form.cargoValue > 0 && !lines.some((line) => line.costDetailType === 'Insurance') && visible.has('destination_charges')) {
    const insurance = calculateCargoInsurance(form.cargoValue, form.freightCost)
    lines.push({
      key: 'cargo-insurance:auto',
      section: 'destination_charges',
      name: 'Seguro de carga',
      costDetailType: 'Insurance',
      costType: 'Optional',
      chargeBasis: 'PerShipment',
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      costAmount: insurance.cost,
      saleAmount: insurance.sale,
      included: false,
      optional: true,
      manual: false,
    })
  }

  rateLines.value = lines
}

function addManualCharge() {
  const name = form.manualName.trim()
  const currency = selectedCurrency.value
  if (!name || !currency) return
  const detailType = sectionForManual(form.manualSection)
  rateLines.value.push({
    key: `manual:${crypto.randomUUID()}`,
    section: form.manualSection,
    name,
    costDetailType: detailType,
    costType: 'Variable',
    chargeBasis: defaultChargeBasis(detailType),
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
  step.value = 2
}

function chooseShipmentMode(value: string) {
  form.shipmentMode = value
  form.equipmentSize = ''
  form.equipmentType = ''
  form.equipmentId = ''
  if (value.toUpperCase() === 'FCL') form.nonStackable = false
  step.value = 3
}

function toggleMerchantHaulage() {
  form.merchantHaulage = !form.merchantHaulage
  if (form.merchantHaulage) form.carrierHaulage = false
}

function toggleCarrierHaulage() {
  form.carrierHaulage = !form.carrierHaulage
  if (form.carrierHaulage) form.merchantHaulage = false
}

async function loadCatalogs() {
  try {
    loadingCatalogs.value = true
    const select = (slug: string) => CatalogItemsService.select({ catalogGroupSlug: slug })
    const selectOptional = async (...slugs: string[]) => {
      for (const slug of slugs) {
        try {
          const items = await select(slug)
          if (items.length) return items
        } catch {
          // Compatibility with installations that use an older WHS catalog slug.
        }
      }
      return [] as CatalogItemSelectDto[]
    }
    const [
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      landEquipmentTypes,
      landEquipmentSizes,
      landEquipmentKinds,
      containers,
      agents,
      carriers,
      currencies,
      warehouses,
      countries,
      selectedCosts,
    ] = await Promise.all([
      select('shipment-modes'),
      select('pricing-services'),
      select('incoterms'),
      select('pol'),
      select('pod'),
      select('poe'),
      select('land-equipment-types'),
      select('land-equipment-sizes'),
      select('land-equipment-kinds'),
      select('container-types'),
      select('agents'),
      select('carriers'),
      select('currencies'),
      selectOptional('pricing-warehouses', 'warehouses', 'whs', 'fca-warehouses'),
      selectOptional('country-vat-rates', 'countries', 'country-tax-rates'),
      PricingService.selectCosts().catch(() => [] as CostSelectDto[]),
    ])

    Object.assign(catalogs, {
      shipmentModes,
      services,
      incoterms,
      pol,
      pod,
      poe,
      landEquipmentTypes,
      landEquipmentSizes,
      landEquipmentKinds,
      containers,
      agents,
      carriers,
      currencies,
      countries,
      warehouses,
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
  if (selectedPod.value) return selectedPod.value

  const fromRate = selectedImportRate.value?.podId
    ? findById(catalogs.pod, selectedImportRate.value.podId)
    : null
  if (fromRate) return fromRate

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
      pod: selectedPod.value ? catalogSearchText(selectedPod.value) : undefined,
      containerType: catalogSearchText(selectedEquipment.value),
      quoteDate: form.loadDate,
    }
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
  form.freeDays = number(rate.freeDays)
  form.transitDays = number(rate.transitDays)

  const ratePod = rate.podId
    ? findById(catalogs.pod, rate.podId)
    : findEquivalentValue(catalogs.pod, rate.pod)
  if (ratePod) form.podId = ratePod.id

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

  step.value = 5
}

function continueManual() {
  form.selectedImportRateId = ''
  form.manualRate = true
  step.value = 5
}

async function reverseGeocodePickup(latitude: number, longitude: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    { headers: { Accept: 'application/json', 'Accept-Language': 'es' } },
  )
  if (!response.ok) throw new Error(`Nominatim ${response.status}`)
  const location = await response.json() as { display_name?: string }
  return location.display_name?.trim() || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

async function selectPickupFromMap(point: { latitude: number; longitude: number }) {
  form.pickupLatitude = point.latitude
  form.pickupLongitude = point.longitude
  nearestPortRecommendations.value = []

  try {
    locatingPickup.value = true
    form.pickupAddress = await reverseGeocodePickup(point.latitude, point.longitude)
  } catch {
    form.pickupAddress = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
  } finally {
    locatingPickup.value = false
  }

  if (selectedIncotermCode.value === 'EXW') await recommendNearestPorts()
}

function selectWarehouseFromMap(warehouseId: string) {
  if (catalogs.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    form.warehouseId = warehouseId
  }
}

function parseNearestPortResponse(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  const parsed = JSON.parse(cleaned) as {
    recommendations?: Array<{ portId?: string; reason?: string }>
  }
  return Array.isArray(parsed.recommendations) ? parsed.recommendations : []
}

async function recommendNearestPorts() {
  if (selectedIncotermCode.value !== 'EXW' || !form.pickupAddress.trim()) return
  if (!catalogs.pol.length) {
    toastStore.warning('Sin puertos configurados', 'No existen POL configurados para calcular opciones cercanas.')
    return
  }

  try {
    recommendingPorts.value = true
    nearestPortRecommendations.value = []
    const response = await callEndpoint<unknown, Record<string, unknown>>(
      { method: 'POST', path: '/api/ai/logistics/nearest-ports', headers: { Accept: 'application/json' } },
      {
        body: {
          pickupAddress: form.pickupAddress.trim(),
          latitude: form.pickupLatitude,
          longitude: form.pickupLongitude,
          ports: catalogs.pol.map((port) => ({
            id: port.id,
            name: displayValue(port) || port.label || port.code,
            code: port.code,
            country: metadata(port)?.countryCode ?? null,
            latitude: metadataNumber(port, 'latitude', 'lat'),
            longitude: metadataNumber(port, 'longitude', 'lng'),
          })),
        },
      },
    )
    const result = unwrapApiResponse<{ content?: string }>(response as never)
    const recommendations = parseNearestPortResponse(String(result.content ?? ''))
    const allowed = new Map(catalogs.pol.map((port) => [port.id, port]))
    const seen = new Set<string>()
    nearestPortRecommendations.value = recommendations
      .filter((item) => Boolean(item.portId && allowed.has(item.portId) && !seen.has(item.portId)))
      .slice(0, 3)
      .map((item) => {
        const portId = item.portId!
        seen.add(portId)
        const port = allowed.get(portId)!
        return {
          portId,
          name: displayValue(port) || port.label || port.code,
          reason: String(item.reason ?? 'Puerto recomendado por cercanía logística.'),
        }
      })

    if (!nearestPortRecommendations.value.length) {
      toastStore.warning('Sin recomendación concluyente', 'La IA no pudo determinar un puerto cercano con suficiente confianza.')
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron recomendar los puertos cercanos con IA.')
  } finally {
    recommendingPorts.value = false
  }
}

async function geocodePickupAddress(recommendAfter = true) {
  const address = form.pickupAddress.trim()
  if (!address) {
    toastStore.warning('Dirección requerida', 'Escriba la dirección que desea ubicar.')
    return
  }

  try {
    locatingPickup.value = true
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`,
      { headers: { Accept: 'application/json', 'Accept-Language': 'es' } },
    )
    if (!response.ok) throw new Error(`Nominatim ${response.status}`)
    const rows = await response.json() as NominatimResult[]
    const match = rows[0]
    if (!match) {
      toastStore.warning('Dirección no encontrada', 'Revise la dirección e inténtelo nuevamente.')
      return
    }
    form.pickupLatitude = Number(match.lat)
    form.pickupLongitude = Number(match.lon)
    if (match.display_name) form.pickupAddress = match.display_name
    if (recommendAfter && selectedIncotermCode.value === 'EXW') await recommendNearestPorts()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo ubicar la dirección en OpenStreetMap.')
  } finally {
    locatingPickup.value = false
  }
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    toastStore.warning('Ubicación no disponible', 'El navegador no permite obtener la ubicación actual.')
    return
  }

  try {
    locatingPickup.value = true
    const position = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }),
    )
    await selectPickupFromMap({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo obtener la ubicación actual.')
  } finally {
    locatingPickup.value = false
  }
}

function selectRecommendedPort(portId: string) {
  if (catalogs.pol.some((port) => port.id === portId)) form.originId = portId
}

async function applySelectedWarehouse() {
  const warehouse = selectedWarehouse.value
  if (!warehouse) return
  form.pickupAddress = warehouseAddress(warehouse)
  form.pickupLatitude = metadataNumber(warehouse, 'latitude', 'lat')
  form.pickupLongitude = metadataNumber(warehouse, 'longitude', 'lng')
  nearestPortRecommendations.value = []
  if (form.pickupAddress && (form.pickupLatitude == null || form.pickupLongitude == null)) {
    await geocodePickupAddress(false)
  }
}

async function next() {
  if (!canNext.value) return
  if (step.value === 3) await searchApprovedRates()
  if (step.value === 6) {
    await loadApplicableCosts()
    rebuildRateLines()
  }
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
  if (!equipment) missing.push(form.modality === 'Land' ? 'furgón / equipo terrestre' : 'equipo')
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
    chargeBasis: line.chargeBasis,
    currencyId: line.currencyId,
    currencyName: line.currencyName,
    currencyCode: line.currencyCode,
    costAmount: number(line.costAmount),
    saleAmount: lineSaleWithTax(line),
    quantity: quantityForChargeBasis(line.chargeBasis),
    notes: line.costDetailType === 'Insurance'
      ? [line.notes, cargoInsuranceNote(form.cargoValue, form.freightCost)].filter(Boolean).join(' · ')
      : line.applyDestinationTax
        ? [line.notes, `IVA ${destinationTaxRate.value}%: ${lineTaxAmount(line).toFixed(2)}; venta total: ${lineSaleWithTax(line).toFixed(2)}`].filter(Boolean).join(' · ')
      : line.manual
        ? line.notes || 'Cargo manual agregado desde el wizard de Pricing.'
        : line.notes || null,
  }))

  const includedNameKeys = new Set(
    includedLines.value.map((line) => normalizeCatalogValue(line.name)),
  )
  const serviceCodes = new Set<string>()
  selectedServices.value.forEach((service) => {
    const code = service.code?.trim().toUpperCase()
    if (!code) return
    const canonical = canonicalServiceLine(code, displayValue(service))
    if (
      Boolean(metadata(service)?.optional) &&
      !includedNameKeys.has(normalizeCatalogValue(canonical.name))
    ) return
    serviceCodes.add(code)
  })
  if (!incotermBuyerPaysMainTransport(incoterm!.code)) serviceCodes.delete('INT_TRANSPORT')
  if (includedLines.value.some((line) => line.costDetailType === 'Insurance'))
    serviceCodes.add('CARGO_INSURANCE')
  else
    serviceCodes.delete('CARGO_INSURANCE')
  if (form.dangerousCargo) serviceCodes.add('DANGEROUS_CARGO')
  if (form.overweight) serviceCodes.add('OVERWEIGHT')

  const commercialTerms = await resolveCommercialTerms({
    transportModality: form.modality as Modality,
    shipmentMode: shipmentModeForApi.value,
    direction: direction.value,
    incotermId: incoterm!.id,
    incotermCode: incoterm!.code,
    serviceCodes: [...serviceCodes],
    routeText: [displayValue(origin), displayValue(poe), displayValue(pod)]
      .filter(Boolean)
      .join(' '),
  })

  const uniqueText = (values: Array<string | null | undefined>) => {
    const seen = new Set<string>()
    return values.filter((value): value is string => {
      const text = String(value ?? '').trim()
      if (!text) return false
      const key = normalizeCatalogValue(text)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const includeTerms = uniqueText([
    ...commercialTerms.includes.map((item) => item.text),
    ...includedLines.value.map((line) => line.name),
  ])
  const includeKeys = new Set(includeTerms.map(commercialTermKey))
  const subjectTerms = uniqueText([
    ...commercialTerms.subjectTo.map((item) => item.text),
    form.dangerousCargo ? 'Carga peligrosa' : null,
    form.nonStackable ? 'Carga no estibable' : null,
    form.overweight ? 'Sobrepeso' : null,
  ]).filter((text) => !includeKeys.has(commercialTermKey(text)))
  const subjectKeys = new Set(subjectTerms.map(commercialTermKey))
  const excludeTerms = uniqueText(
    commercialTerms.excludes.map((item) => item.text),
  ).filter((text) => {
    const key = commercialTermKey(text)
    return !includeKeys.has(key) && !subjectKeys.has(key)
  })

  try {
    saving.value = true
    const equipmentName = displayValue(equipment!)
    const rateId = await PricingService.createRate({
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
      podId: pod?.id ?? null,
      podName: pod ? displayValue(pod) : null,
      podCode: pod?.code ?? null,
      containerTypeId: equipment!.id,
      containerTypeName: equipmentName,
      containerTypeCode: equipment!.code,
      incotermId: incoterm!.id,
      incotermName: displayValue(incoterm),
      incotermCode: incoterm!.code,
      currencyId: currency!.id,
      currencyName: displayValue(currency),
      currencyCode: currency!.code,
      clientName: form.clientName.trim() || null,
      freeDays: number(form.freeDays),
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
      transitTime: form.transitDays > 0 ? `${form.transitDays} días` : null,
      includes: includeTerms.join('\n') || null,
      subjectTo: subjectTerms.join('\n') || null,
      excludes: excludeTerms.join('\n') || null,
      totalPackages: 0,
      totalPallets: 0,
      totalWeightKg: 0,
      totalVolumeCbm: 0,
      cargoLines: form.cargoDescription
        ? [{
            description: [
              `${form.cabysCode ? `CABYS ${form.cabysCode} · ` : ''}${form.cargoDescription}`,
              form.cargoObservations ? `Observaciones: ${form.cargoObservations}` : '',
              form.pickupAddress ? `Recolección: ${form.pickupAddress}` : '',
              selectedWarehouse.value ? `WHS FCA: ${selectedWarehouse.value.label || displayValue(selectedWarehouse.value)}` : '',
            ].filter(Boolean).join(' · '),
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
    createdRateId.value = rateId
    toastStore.success('Tarifa creada correctamente.')
    await router.push({ name: 'pricing-rates', query: { rateId } })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo crear la tarifa.')
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
    podId: '',
    equipmentSize: '',
    equipmentType: '',
    equipmentId: '',
    equipmentQuantity: 1,
    incotermId: '',
    serviceIds: [],
    loadDate: todayIso(),
    selectedImportRateId: '',
    manualRate: false,
    clientName: '',
    pickupAddress: '',
    warehouseId: '',
    pickupLatitude: null,
    pickupLongitude: null,
    freeDays: 0,
    transitDays: 0,
    agentId: '',
    carrierId: '',
    freightCost: 0,
    freightSale: 0,
    cabysSearch: '',
    cabysCode: '',
    cargoDescription: '',
    cargoObservations: '',
    cargoValue: 0,
    dangerousCargo: false,
    nonStackable: false,
    overweight: false,
    manualName: '',
    manualSection: 'destination_charges',
  })
}

watch(
  () => selectedIncotermCode.value,
  (code) => {
    nearestPortRecommendations.value = []
    if (code !== 'FCA') form.warehouseId = ''
    if (code !== 'EXW' && code !== 'FCA') {
      form.pickupAddress = ''
      form.pickupLatitude = null
      form.pickupLongitude = null
    }
  },
)

watch(
  () => form.warehouseId,
  () => {
    if (selectedIncotermCode.value === 'FCA') void applySelectedWarehouse()
  },
)

watch(
  () => form.destinationId,
  () => {
    const equivalent = findEquivalent(catalogs.pod, selectedDestination.value)
    form.podId = equivalent?.id ?? ''
  },
)

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

watch(
  () => [form.agentId, form.carrierId] as const,
  async ([agentId]) => {
    if (step.value < 5 || !agentId) return
    await loadApplicableCosts()
    if (step.value === 7) rebuildRateLines()
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
              @click="chooseShipmentMode(option.value)"
            >
              <span class="text-lg font-black">{{ option.label }}</span>
              <Check v-if="form.shipmentMode === option.value" class="absolute right-4 top-4 h-4 w-4 text-[var(--dh-primary)]" />
            </button>
          </div>
        </div>

        <div v-else-if="step === 3" class="space-y-6">
          <div>
            <p class="crystal-kicker">Pantalla 3</p>
            <h2 class="crystal-title">{{ form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>
            <p class="crystal-description">Seleccione el POE. El POD es opcional; si existe una equivalencia clara, se sugiere automáticamente.</p>
          </div>

          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">
            <DhInput v-model="form.clientName" label="Nombre del cliente" placeholder="Escriba el nombre del cliente" />
            <DhSelect v-model="form.originId" label="Origen" placeholder="Seleccione origen" :options="originOptions" />
            <DhSelect v-model="form.destinationId" label="Destino (POE)" placeholder="Seleccione POE" :options="destinationOptions" />
            <DhSelect v-model="form.podId" label="POD (opcional)" placeholder="Seleccione POD si aplica" :options="podOptions" />

            <DhSelect
              v-if="equipmentHasSizes"
              v-model="form.equipmentSize"
              :label="form.modality === 'Land' ? 'Tamaño de furgón' : 'Tamaño'"
              :placeholder="form.modality === 'Land' ? 'Seleccione tamaño de furgón' : 'Seleccione tamaño'"
              :options="equipmentSizeOptions"
            />
            <DhSelect
              v-model="form.equipmentType"
              :label="form.modality === 'Land' ? 'Furgón / equipo terrestre' : equipmentHasSizes ? 'Tipo' : 'Tipo de equipo'"
              :placeholder="form.modality === 'Land' ? 'Seleccione furgón' : equipmentHasSizes ? 'Seleccione tipo' : 'Seleccione equipo'"
              :disabled="equipmentHasSizes && !form.equipmentSize"
              :options="equipmentTypeOptions"
            />

            <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" :label="form.modality === 'Land' ? 'Cantidad de unidades' : 'Cantidad'" />
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

          <div v-if="selectedIncotermCode === 'EXW' || selectedIncotermCode === 'FCA'" class="crystal-soft space-y-4 p-4 md:p-5">
            <div>
              <p class="font-black">{{ selectedIncotermCode === 'EXW' ? 'Lugar de recolección EXW' : 'WHS de entrega FCA' }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ selectedIncotermCode === 'EXW'
                  ? 'Ubique la recolección en el mapa y consulte con IA los POL configurados más cercanos.'
                  : 'Seleccione uno de los WHS globales configurados. Su ubicación se refleja en el mapa.' }}
              </p>
            </div>

            <DhSelect
              v-if="selectedIncotermCode === 'FCA' && warehouseOptions.length"
              v-model="form.warehouseId"
              label="WHS global"
              placeholder="Seleccione WHS"
              :options="warehouseOptions"
            />
            <div
              v-else-if="selectedIncotermCode === 'FCA'"
              class="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs font-bold text-[var(--dh-text-soft)]"
            >
              No hay WHS cargados todavía en Config. Puede indicar una dirección temporal mientras se completa el catálogo “WHS globales”.
            </div>

            <DhInput
              v-model="form.pickupAddress"
              :label="selectedIncotermCode === 'EXW' ? 'Dirección de recolección' : 'Dirección del WHS'"
              placeholder="Ciudad, provincia/estado y país"
              :disabled="selectedIncotermCode === 'FCA' && warehouseOptions.length > 0"
            />

            <div class="flex flex-wrap gap-2">
              <DhButton
                variant="secondary"
                :disabled="locatingPickup || !form.pickupAddress.trim()"
                @click="geocodePickupAddress(selectedIncotermCode === 'EXW')"
              >
                <Waypoints class="h-4 w-4" /> {{ locatingPickup ? 'Ubicando…' : 'Ubicar en mapa' }}
              </DhButton>
              <DhButton
                v-if="selectedIncotermCode === 'EXW'"
                variant="ghost"
                :disabled="locatingPickup"
                @click="useCurrentLocation"
              >
                Usar mi ubicación
              </DhButton>
            </div>

            <PricingInteractiveOsmMap
              v-if="selectedIncotermCode === 'EXW'"
              :latitude="form.pickupLatitude"
              :longitude="form.pickupLongitude"
              :interactive-selection="true"
              :initial-zoom="11"
              :selection-zoom="13"
              hint="Arrastre para explorar y toque el mapa para fijar el punto exacto de recolección."
              @select-point="selectPickupFromMap"
            />
            <PricingInteractiveOsmMap
              v-else
              :latitude="form.pickupLatitude"
              :longitude="form.pickupLongitude"
              :markers="warehouseMapMarkers"
              :interactive-selection="false"
              :fit-markers="true"
              :initial-zoom="3"
              :selection-zoom="10"
              hint="Los marcadores corresponden a los WHS globales configurados en Dhole. Toque uno para seleccionarlo."
              @select-marker="selectWarehouseFromMap"
            />
            <p
              v-if="selectedIncotermCode === 'FCA' && warehouseOptions.length > warehouseMapMarkers.length"
              class="text-[11px] font-bold text-amber-600"
            >
              Algunos WHS todavía no tienen coordenadas configuradas; siguen disponibles en la lista y se ubican al seleccionarlos.
            </p>
            <p v-if="pickupCoordinates" class="text-[11px] font-bold text-[var(--dh-text-muted)]">
              Coordenadas: {{ pickupCoordinates.latitude.toFixed(6) }}, {{ pickupCoordinates.longitude.toFixed(6) }}
            </p>

            <div v-if="selectedIncotermCode === 'EXW'" class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-sm font-black">Puertos cercanos sugeridos por IA</p>
                  <p class="text-xs font-semibold text-[var(--dh-text-muted)]">La IA solo puede elegir entre los POL configurados en Dhole.</p>
                </div>
                <DhButton
                  variant="secondary"
                  :disabled="recommendingPorts || !form.pickupAddress.trim()"
                  @click="recommendNearestPorts"
                >
                  <Sparkles class="h-4 w-4" /> {{ recommendingPorts ? 'Analizando…' : 'Buscar puertos cercanos' }}
                </DhButton>
              </div>

              <div v-if="nearestPortRecommendations.length" class="grid gap-2 md:grid-cols-3">
                <button
                  v-for="recommendation in nearestPortRecommendations"
                  :key="recommendation.portId"
                  type="button"
                  class="min-h-24 rounded-2xl border p-3 text-left transition"
                  :class="form.originId === recommendation.portId
                    ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.10)]'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[rgb(var(--dh-primary-rgb)/0.35)]'"
                  @click="selectRecommendedPort(recommendation.portId)"
                >
                  <span class="block text-sm font-black">{{ recommendation.name }}</span>
                  <span class="mt-1 block text-xs font-semibold leading-relaxed text-[var(--dh-text-muted)]">{{ recommendation.reason }}</span>
                </button>
              </div>
            </div>

            <a
              class="inline-flex min-h-11 touch-manipulation items-center font-black text-[var(--dh-primary)]"
              :href="pickupCoordinates
                ? `https://www.openstreetmap.org/?mlat=${pickupCoordinates.latitude}&mlon=${pickupCoordinates.longitude}#map=12/${pickupCoordinates.latitude}/${pickupCoordinates.longitude}`
                : `https://www.openstreetmap.org/search?query=${encodeURIComponent(form.pickupAddress)}`"
              target="_blank"
              rel="noopener noreferrer"
            >Abrir ubicación en OpenStreetMap</a>
          </div>

          <div v-if="selectedEquipment || direction" class="crystal-route-summary">
            <div>
              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Operación</span>
              <strong class="mt-1 block text-sm">{{ direction || 'Por determinar' }}</strong>
            </div>
            <div v-if="selectedEquipment">
              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">{{ form.modality === 'Land' ? 'Furgón' : 'Equipo' }}</span>
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
            <h2 class="crystal-title">Tarifas preaprobadas disponibles</h2>
            <p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.</p>
          </div>

          <div v-if="loadingRates" class="py-14 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>

          <template v-else-if="availableRates.length">
            <div class="grid gap-4 lg:grid-cols-2">
              <button
                v-for="rate in sortedAvailableRates"
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
                <p class="mt-5 text-2xl font-black">{{ formatMoney(rate.freight, displayValue(findById(catalogs.currencies, rate.currencyId)) || rate.currency || 'USD') }}</p>
                <div class="crystal-validity">
        <div class="crystal-validity-range">
          <span>Vigencia</span>
          <strong>{{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</strong>
        </div>
        <div class="crystal-validity-days" :class="`crystal-validity-days--${validityTone(rate.validTo)}`">
          <strong>{{ remainingValidityDays(rate.validTo) }}</strong>
          <span>días restantes</span>
        </div>
      </div>
                <p v-if="rate.spaceComment" class="mt-3 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--dh-text-muted)]">
                  Comentario: {{ rate.spaceComment }}
                </p>
                <p class="mt-3 text-left text-xs font-black" :class="rate.freeDays > 0 ? 'text-emerald-600' : 'text-amber-600'">
                  {{ rate.freeDays > 0 ? `Incluye ${rate.freeDays} días libres` : 'No incluye días libres; deberá ingresarlos en la pantalla 5' }}
                </p>
              </button>
            </div>
            <div class="flex justify-end">
              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>
            </div>
          </template>

          <div v-else class="crystal-empty p-9 text-center">
            <p class="text-lg font-black">No existen tarifas vigentes para esa ruta y equipo</p>
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
            <DhInput v-model.number="form.freeDays" type="number" min="0" label="Días libres" :disabled="number(selectedImportRate?.freeDays) > 0" />
            <DhInput v-model.number="form.transitDays" type="number" min="0" label="Días de tránsito" />
          </div>

          <div class="crystal-route-summary grid gap-3 md:grid-cols-4">
  <div class="crystal-metric crystal-metric--cost">
    <span class="block text-[10px] font-black uppercase tracking-[0.16em]">Costo</span>
    <strong class="mt-1 block text-sm">{{ formatMoney(providerCost, displayValue(selectedCurrency) || 'USD') }}</strong>
    <small v-if="providerAgentCost > 0">Incluye {{ formatMoney(providerAgentCost, displayValue(selectedCurrency) || 'USD') }} de agente</small>
  </div>
  <div class="crystal-metric crystal-metric--sale">
    <span class="block text-[10px] font-black uppercase tracking-[0.16em]">Venta</span>
    <strong class="mt-1 block text-sm">{{ formatMoney(providerSale, displayValue(selectedCurrency) || 'USD') }}</strong>
  </div>
  <div class="crystal-metric" :class="`crystal-metric--${financialTone(providerUtility)}`">
    <span class="block text-[10px] font-black uppercase tracking-[0.16em]">Utilidad</span>
    <strong class="mt-1 block text-sm">{{ formatMoney(providerUtility, displayValue(selectedCurrency) || 'USD') }}</strong>
  </div>
  <div class="crystal-metric" :class="`crystal-metric--${financialTone(providerMarginPercentage)}`">
    <span class="block text-[10px] font-black uppercase tracking-[0.16em]">Margen</span>
    <strong class="mt-1 block text-sm">{{ providerMarginPercentage.toFixed(2) }}%</strong>
  </div>
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
            <DhTextarea v-model="form.cargoObservations" label="Observaciones de la carga" :rows="4" />

            <p v-if="form.cabysCode" class="text-xs font-bold text-[var(--dh-text-muted)]">CABYS seleccionado: {{ form.cabysCode }}</p>
            <p v-if="form.cargoValue > 0" class="crystal-insurance-hint">
              Se mostrará Seguro de carga como opcional en Líneas con costo y venta calculados sobre el valor de la carga.
            </p>
          </div>

          <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <button type="button" class="crystal-flag" :class="form.dangerousCargo ? 'crystal-flag--active' : ''" @click="form.dangerousCargo = !form.dangerousCargo">
              <Check v-if="form.dangerousCargo" class="h-4 w-4" /> Carga peligrosa
            </button>
            <button v-if="shipmentModeForApi !== 'Fcl'" type="button" class="crystal-flag" :class="form.nonStackable ? 'crystal-flag--active' : ''" @click="form.nonStackable = !form.nonStackable">
              <Check v-if="form.nonStackable" class="h-4 w-4" /> No estibable
            </button>
            <button type="button" class="crystal-flag" :class="form.overweight ? 'crystal-flag--active' : ''" @click="form.overweight = !form.overweight">
              <Check v-if="form.overweight" class="h-4 w-4" /> Sobrepeso
            </button>
            <button type="button" class="crystal-flag" :class="form.merchantHaulage ? 'crystal-flag--active' : ''" @click="toggleMerchantHaulage">
              <Check v-if="form.merchantHaulage" class="h-4 w-4" /> Merchant
            </button>
            <button type="button" class="crystal-flag" :class="form.carrierHaulage ? 'crystal-flag--active' : ''" @click="toggleCarrierHaulage">
              <Check v-if="form.carrierHaulage" class="h-4 w-4" /> Carrier
            </button>
          </div>
        </div>

        <div v-else class="crystal-lines-stage space-y-6">
          <div class="crystal-lines-header flex flex-wrap items-end justify-between gap-4">
            <div>
              <p class="crystal-kicker">Pantalla 7</p>
              <h2 class="crystal-title">Líneas de tarifa</h2>
              <p class="crystal-description">Los costos aplicables vienen de Pricing según rubro, ruta, Incoterm, proveedor y base de cobro.</p>
            </div>
            <div class="crystal-total-card">
    <span class="crystal-total-card__metric crystal-total-card__metric--cost">Costo <strong>{{ formatMoney(totalCost, displayValue(selectedCurrency) || 'USD') }}</strong></span>
    <span class="crystal-total-card__metric crystal-total-card__metric--sale">Venta <strong>{{ formatMoney(totalSale, displayValue(selectedCurrency) || 'USD') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalUtility)}`">Utilidad <strong>{{ formatMoney(totalUtility, displayValue(selectedCurrency) || 'USD') }}</strong></span>
    <span class="crystal-total-card__metric" :class="`crystal-total-card__metric--${financialTone(totalMarginPercentage)}`">Margen <strong>{{ totalMarginPercentage.toFixed(2) }}%</strong></span>
  </div>
          </div>

          <div v-for="group in orderedRateGroups" :key="group.key" class="space-y-2">
            <h3 class="text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]">{{ group.label }}</h3>
            <div
              v-for="line in group.lines"
              :key="line.key"
              class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
            >
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-bold">{{ line.name }}</p>
                  <DhBadge v-if="line.costType === 'Variable'" variant="warning">Variable</DhBadge>
                </div>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  Rubro: {{ detailTypeLabel(line.costDetailType) }} · Moneda: {{ line.currencyName }} · {{ chargeBasisLabel(line.chargeBasis) }}
                </p>
                <p v-if="line.contextLabel" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ line.contextLabel }}</p>
      <div v-if="line.notes" class="mt-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2 text-left">
        <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Comentario de Costos y recargos</span>
        <p class="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-relaxed text-[var(--dh-text-soft)]">{{ line.notes }}</p>
      </div>
              </div>
              <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="line.costType !== 'Variable'" />
              <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" />
              <div v-if="canApplyDestinationTax(line)" class="space-y-2">
                <DhCheckbox :model-value="Boolean(line.applyDestinationTax)" :label="`Aplicar IVA destino (${destinationTaxRate}%)`" :disabled="destinationTaxRate <= 0" @update:model-value="line.applyDestinationTax = $event" />
                <div v-if="line.applyDestinationTax" class="grid grid-cols-2 gap-2">
                  <DhInput :model-value="lineTaxAmount(line)" type="number" label="Monto IVA" disabled />
                  <DhInput :model-value="lineSaleWithTax(line)" type="number" label="Venta + IVA" disabled />
                </div>
              </div>
              <span v-else />
            </div>
          </div>

          <div class="crystal-bottom-charges space-y-4 p-4">
            <div v-if="optionalChargeOptions.length">
              <PricingCrystalMultiSelect
                v-model="selectedOptionalChargeKeys"
                label="Cargos opcionales"
                placeholder="Seleccione cargos opcionales"
                search-placeholder="Buscar cargo opcional..."
                :options="optionalChargeOptions"
              />
            </div>

            <div v-if="bottomRateLines.length" class="space-y-2">
              <p class="text-xs font-black uppercase tracking-[0.15em] text-[var(--dh-text-muted)]">Opcionales y rubros manuales</p>
              <div
                v-for="line in bottomRateLines"
                :key="line.key"
                class="crystal-line grid items-end gap-3 p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
              >
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-bold">{{ line.name }}</p>
                    <DhBadge v-if="line.optional" variant="neutral">Opcional</DhBadge>
                    <DhBadge v-if="line.manual" variant="primary">Manual</DhBadge>
                    <DhBadge v-if="line.costType === 'Variable'" variant="warning">Variable</DhBadge>
                  </div>
                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                    {{ sectionLabel(line.section) }} · Rubro: {{ detailTypeLabel(line.costDetailType) }} · {{ chargeBasisLabel(line.chargeBasis) }}
                  </p>
        <p v-if="line.contextLabel" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ line.contextLabel }}</p>
        <div v-if="line.notes" class="mt-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2 text-left">
          <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Comentario de Costos y recargos</span>
          <p class="mt-1 whitespace-pre-wrap break-words text-xs font-semibold leading-relaxed text-[var(--dh-text-soft)]">{{ line.notes }}</p>
        </div>
                </div>
                <DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" />
                <DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" />
                <div v-if="canApplyDestinationTax(line)" class="space-y-2">
                  <DhCheckbox :model-value="Boolean(line.applyDestinationTax)" :label="`Aplicar IVA destino (${destinationTaxRate}%)`" :disabled="destinationTaxRate <= 0" @update:model-value="line.applyDestinationTax = $event" />
                  <div v-if="line.applyDestinationTax" class="grid grid-cols-2 gap-2">
                    <DhInput :model-value="lineTaxAmount(line)" type="number" label="Monto IVA" disabled />
                    <DhInput :model-value="lineSaleWithTax(line)" type="number" label="Venta + IVA" disabled />
                  </div>
                </div>
                <button v-if="line.manual" type="button" class="h-10 px-2 text-xs font-black text-red-500" @click="rateLines = rateLines.filter((item) => item.key !== line.key)">Eliminar</button>
                <span v-else />
              </div>
            </div>

            <div>
              <p class="mb-3 text-sm font-black">Agregar rubro manual</p>
              <div class="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <DhInput v-model="form.manualName" label="Nombre del rubro" />
                <DhSelect v-model="form.manualSection" label="Etapa" :options="visibleSections.map((value) => ({ value, label: sectionLabel(value) }))" />
                <DhButton class="md:mt-6" variant="secondary" :disabled="!form.manualName.trim()" @click="addManualCharge"><Plus class="h-4 w-4" /> Añadir rubro</DhButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>

    <div class="crystal-footer flex items-center justify-between gap-3 p-3">
      <DhButton variant="secondary" :disabled="step === 1 || saving" @click="previous"><ChevronLeft class="h-4 w-4" /> Atrás</DhButton>
      <div class="text-xs font-black tracking-[0.14em] text-[var(--dh-text-muted)]">{{ step }} / 7</div>
      <DhButton v-if="step < 7 && ![1, 2, 4].includes(step)" :disabled="!canNext || loadingRates" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>
      <DhButton v-else :disabled="saving || !includedLines.length" @click="saveRate"><Check class="h-4 w-4" /> {{ saving ? 'Guardando…' : 'Crear tarifa' }}</DhButton>
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
  border: 1px solid color-mix(in srgb, var(--dh-border-strong) 82%, transparent);
  background: color-mix(in srgb, var(--dh-card) 96%, var(--dh-text) 4%);
  box-shadow: 0 26px 76px rgb(15 23 42 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.34);
  backdrop-filter: blur(34px) saturate(145%);
  -webkit-backdrop-filter: blur(34px) saturate(145%);
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
  border: 1px solid color-mix(in srgb, var(--dh-border) 84%, transparent);
  background: color-mix(in srgb, var(--dh-card) 94%, var(--dh-text) 6%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.24);
  backdrop-filter: blur(30px) saturate(145%);
  -webkit-backdrop-filter: blur(30px) saturate(145%);
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
  box-shadow: 0 14px 40px rgb(15 23 42 / 0.09), inset 0 1px 0 rgb(255 255 255 / 0.24);
}

.crystal-lines-stage {
  border-radius: 26px;
  background: color-mix(in srgb, var(--dh-card) 97%, var(--dh-text) 3%);
  padding: 1rem;
}

.crystal-bottom-charges {
  border: 1px solid color-mix(in srgb, var(--dh-border-strong) 82%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--dh-card) 96%, var(--dh-text) 4%);
  box-shadow: 0 18px 48px rgb(15 23 42 / 0.12);
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

.crystal-validity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid color-mix(in srgb, var(--dh-border) 86%, transparent);
}

.crystal-validity-range {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  color: var(--dh-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.crystal-validity-range strong {
  color: var(--dh-text-soft);
  font-size: 0.78rem;
}

.crystal-validity-days {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0.4rem;
  min-width: 120px;
  border: 1px solid currentColor;
  border-radius: 14px;
  padding: 0.42rem 0.65rem;
  background: color-mix(in srgb, currentColor 9%, transparent);
  line-height: 1;
}

.crystal-validity-days strong {
  font-size: 1.35rem;
  font-weight: 950;
}

.crystal-validity-days span {
  max-width: 54px;
  font-size: 0.62rem;
  font-weight: 900;
  line-height: 1.08;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.crystal-validity-days--success { color: rgb(5 150 105); }
.crystal-validity-days--warning { color: rgb(217 119 6); }
.crystal-validity-days--danger { color: rgb(220 38 38); }

.crystal-metric {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--dh-border) 88%, transparent);
  border-radius: 14px;
  padding: 0.55rem 0.7rem;
  background: color-mix(in srgb, var(--dh-card) 72%, transparent);
  color: var(--dh-text-soft);
}

.crystal-metric small {
  display: block;
  margin-top: 0.18rem;
  font-size: 0.62rem;
  font-weight: 800;
  color: currentColor;
  opacity: 0.82;
}

.crystal-total-card__metric {
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--dh-border) 88%, transparent);
  border-radius: 999px;
  padding: 0.32rem 0.55rem;
}

.crystal-metric--cost,
.crystal-total-card__metric--cost {
  color: rgb(217 119 6);
  border-color: rgb(217 119 6 / 0.28);
  background: rgb(217 119 6 / 0.08);
}

.crystal-metric--sale,
.crystal-total-card__metric--sale {
  color: var(--dh-primary);
  border-color: rgb(var(--dh-primary-rgb) / 0.26);
  background: rgb(var(--dh-primary-rgb) / 0.08);
}

.crystal-metric--success,
.crystal-total-card__metric--success {
  color: rgb(5 150 105);
  border-color: rgb(5 150 105 / 0.28);
  background: rgb(5 150 105 / 0.08);
}

.crystal-metric--danger,
.crystal-total-card__metric--danger {
  color: rgb(220 38 38);
  border-color: rgb(220 38 38 / 0.3);
  background: rgb(220 38 38 / 0.09);
}

.crystal-metric--neutral,
.crystal-total-card__metric--neutral {
  color: var(--dh-text-soft);
  border-color: color-mix(in srgb, var(--dh-border) 88%, transparent);
  background: color-mix(in srgb, var(--dh-card) 72%, transparent);
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

.crystal-lines-header {
  position: sticky;
  top: 6.25rem;
  z-index: 25;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  padding: 0.8rem;
  background: color-mix(in srgb, var(--dh-card) 97%, transparent);
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.crystal-total-card span {
  display: flex;
  gap: 0.3rem;
}

.crystal-line {
  border-radius: 20px;
  transition: opacity 160ms ease, border-color 160ms ease, background 160ms ease;
}

.crystal-line--optional-off {
  border-style: dashed;
  opacity: 0.68;
  background: color-mix(in srgb, var(--dh-card) 42%, transparent);
}

.crystal-line--optional-off .crystal-mini-toggle {
  opacity: 1;
  border-color: rgb(var(--dh-primary-rgb) / 0.32);
  background: rgb(var(--dh-primary-rgb) / 0.06);
  color: var(--dh-primary);
}

.crystal-insurance-hint {
  border-radius: 14px;
  border: 1px solid rgb(var(--dh-primary-rgb) / 0.18);
  background: rgb(var(--dh-primary-rgb) / 0.06);
  padding: 0.7rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 750;
  color: var(--dh-text-soft);
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
  background-color: color-mix(in srgb, var(--dh-input) 94%, var(--dh-card) 6%);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
}

@media (max-width: 640px) {
  .pricing-crystal-shell :deep(button),
  .pricing-crystal-shell :deep(a) {
    min-height: 44px;
  }

  .crystal-footer {
    position: sticky;
    bottom: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--dh-card) 96%, transparent);
    backdrop-filter: blur(20px);
  }

  .crystal-footer :deep(button) {
    flex: 1 1 0;
    padding-inline: 0.75rem;
  }

  .crystal-lines-header {
    top: 5rem;
    gap: 0.5rem;
    padding: 0.65rem;
  }

  .crystal-lines-header .crystal-kicker,
  .crystal-lines-header .crystal-description {
    display: none;
  }

  .crystal-lines-header .crystal-title {
    margin-top: 0;
    font-size: 1rem;
  }

  .crystal-lines-header .crystal-total-card {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    padding: 0.4rem;
  }

  .crystal-lines-header .crystal-total-card__metric {
    min-width: 0;
    justify-content: space-between;
    border-radius: 12px;
    padding: 0.4rem 0.5rem;
  }

  .crystal-panel {
    border-radius: 24px;
  }

  .crystal-orb {
    opacity: 0.12;
  }
}
</style>
