<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ChevronLeft, Edit3, Eye, Plus, RefreshCcw, Truck, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import {
  FtlTariffService,
  type CreateLandTariffItem,
  type FtlTariffDto,
  type LandCommercialProfile,
  type LtlChargeItemDto,
} from '@/core/services/ftlTariffService'
import {
  usePricingCatalogs,
  type PricingCatalogItem,
} from '@/modules/pricing/composables/usePricingCatalogs'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'

type OwnLtlTableRow = FtlTariffDto & Record<string, unknown>

interface EditableLtlCharge {
  key: string
  name: string
  costDetailType: string
  chargeBasis: string
  section: string
  costAmount: string
  saleAmount: string
  isFlat: boolean
}

const authStore = useAuthStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<OwnLtlTableRow[]>([])
const loading = ref(false)
const saving = ref(false)
const selectedOriginCountry = ref('')
const selectedDestinationCountry = ref('')
const selectedId = ref('')
const editorOpen = ref(false)
const readOnly = ref(false)
const editorSection = ref<HTMLElement | null>(null)

const LEGACY_ORIGIN = '__legacy_origin__'
const LEGACY_DESTINATION = '__legacy_destination__'
const DEFAULT_WEIGHT_KG_PER_CBM = 333.33
const DEFAULT_DUA_COST = 50
const DEFAULT_DUCA_T_COST = 30
const DEFAULT_STUFFING_COST_PER_CBM = 550 / 60
const DEFAULT_STUFFING_SALE_PER_CBM = 10
const DEFAULT_PANAMA_SURCHARGE_PER_CBM = 9

function canonicalLtlCharges(profile: LandCommercialProfile): EditableLtlCharge[] {
  const isNvocc = profile === 'Nvocc'
  return [
    { key: 'dua', name: 'DUA', costDetailType: 'CustomsCharge', chargeBasis: 'PerDocument', section: 'origin_charges', costAmount: '50', saleAmount: '60', isFlat: true },
    { key: 'duca-t', name: 'DUCA-T', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', costAmount: '30', saleAmount: isNvocc ? '30' : '35', isFlat: true },
    { key: 'stuffing', name: 'Stuffing', costDetailType: 'OriginCharge', chargeBasis: 'PerChargeableCbm', section: 'origin_charges', costAmount: String(DEFAULT_STUFFING_COST_PER_CBM), saleAmount: '10', isFlat: true },
    { key: 'carta-porte', name: 'Carta Porte', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', costAmount: '0', saleAmount: isNvocc ? '35' : '45', isFlat: true },
    { key: 'manejos', name: 'Manejos', costDetailType: 'AgentCharge', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '0', saleAmount: isNvocc ? '25' : '45', isFlat: true },
    { key: 'seguro', name: 'Seguro', costDetailType: 'Insurance', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'recolecta', name: 'Recolecta', costDetailType: 'OriginCharge', chargeBasis: 'PerShipment', section: 'pickup_origin', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'reembarque', name: 'Reembarque', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'inspeccion', name: 'Inspección', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'tramite-aduanas-destino', name: 'Trámite Aduanas Destino', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'destination_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'entrega-destino', name: 'Entrega en Destino', costDetailType: 'InlandTransport', chargeBasis: 'PerShipment', section: 'delivery_destination', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'otros', name: 'Otros', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'destination_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'duca-f', name: 'DUCA-F', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'impuesto-exportacion', name: 'Impuesto Exportación', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'recepcion-destino', name: 'Recepción en Destino', costDetailType: 'DestinationCharge', chargeBasis: 'PerShipment', section: 'destination_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'carga-peligrosa', name: 'Carga Peligrosa', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '', saleAmount: '', isFlat: false },
    { key: 'sobrepeso', name: 'Sobrepeso', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', costAmount: '', saleAmount: '', isFlat: false },
  ]
}

function hydrateLtlCharges(
  profile: LandCommercialProfile,
  source?: LtlChargeItemDto[] | null,
): EditableLtlCharge[] {
  const defaults = canonicalLtlCharges(profile)
  if (!source?.length) return defaults

  const sourceByKey = new Map(source.map((item) => [item.key.toLowerCase(), item]))
  return defaults.map((item) => {
    const incoming = sourceByKey.get(item.key.toLowerCase())
    if (!incoming || item.isFlat) return item
    return {
      ...item,
      costAmount: incoming.costAmount == null ? '' : String(incoming.costAmount),
      saleAmount: incoming.saleAmount == null ? '' : String(incoming.saleAmount),
    }
  })
}

function ltlChargeBasisLabel(value: string) {
  if (value === 'PerChargeableCbm' || value === 'PerCbm') return 'CBM'
  if (value === 'PerDocument') return 'Documento'
  return 'Embarque'
}

const COUNTRY_NAMES: Record<string, string> = {
  PA: 'Panamá',
  CR: 'Costa Rica',
  NI: 'Nicaragua',
  HN: 'Honduras',
  GT: 'Guatemala',
  SV: 'El Salvador',
  BZ: 'Belice',
  MX: 'México',
  US: 'Estados Unidos',
}

const canCreate = computed(() =>
  authStore.hasScope(PRICING_SCOPES.costs.create)
  || authStore.hasRole('Administrador')
  || authStore.hasRole('Admin')
  || authStore.hasRole('Administrator'),
)

const canUpdate = computed(() =>
  authStore.hasScope(PRICING_SCOPES.costs.update)
  || authStore.hasRole('Administrador')
  || authStore.hasRole('Admin')
  || authStore.hasRole('Administrator'),
)

const form = reactive({
  commercialProfile: 'FinalClient' as LandCommercialProfile,
  originId: '',
  destinationId: '',
  currencyId: '',
  priceAmount: '',
  minimumAmount: '',
  costPerCbm: '',
  weightKgPerCbm: String(DEFAULT_WEIGHT_KG_PER_CBM),
  duaCost: String(DEFAULT_DUA_COST),
  ducaTCost: String(DEFAULT_DUCA_T_COST),
  stuffingCostPerCbm: String(DEFAULT_STUFFING_COST_PER_CBM),
  stuffingSalePerCbm: String(DEFAULT_STUFFING_SALE_PER_CBM),
  panamaCostSurchargePerCbm: String(DEFAULT_PANAMA_SURCHARGE_PER_CBM),
  ltlCharges: hydrateLtlCharges('FinalClient'),
  transitDays: '',
  warehouseName: '',
  source: '',
  notes: '',
  validFrom: '',
  validTo: '',
  isActive: true,
  submitted: false,
})

const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null)

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function routeTerminalType(item: PricingCatalogItem, fallback: 'CY' | 'SD' = 'CY') {
  if (item.metadataJson) {
    try {
      const metadata = JSON.parse(item.metadataJson) as Record<string, unknown>
      const configured = String(metadata.terminalType ?? '').trim().toUpperCase()
      if (configured === 'CY' || configured === 'SD') return configured as 'CY' | 'SD'
    } catch {
      // Usar la convención del código cuando metadata no sea JSON válido.
    }
  }

  const code = String(item.code || '').trim().toUpperCase()
  if (code.startsWith('SD_') || code.endsWith('_SD') || code.includes('_SD_')) return 'SD'
  if (code.startsWith('CY_') || code.endsWith('_CY') || code.includes('_CY_')) return 'CY'
  return fallback
}

function metadataCountryCode(item: PricingCatalogItem | null | undefined) {
  if (!item?.metadataJson) return ''
  try {
    const metadata = JSON.parse(item.metadataJson) as Record<string, unknown>
    return String(metadata.countryCode ?? metadata.country ?? '')
      .trim()
      .toUpperCase()
  } catch {
    return ''
  }
}

function inferCountryCode(value: unknown) {
  const text = normalize(value)
  if (!text) return ''
  if (text.includes('panama') || text.includes('panamá') || text.includes('cfz') || text.includes('colon') || text.includes('colón')) return 'PA'
  if (text.includes('costa rica') || text.includes('san jose') || text.includes('san josé') || text.includes('alajuela') || text.includes('heredia') || text.includes('coyol')) return 'CR'
  if (text.includes('nicaragua') || text.includes('managua')) return 'NI'
  if (text.includes('honduras') || text.includes('san pedro sula') || text.includes('tegucigalpa')) return 'HN'
  if (text.includes('guatemala')) return 'GT'
  if (text.includes('el salvador') || text.includes('san salvador')) return 'SV'
  if (text.includes('belice') || text.includes('belize')) return 'BZ'
  if (text.includes('mexico') || text.includes('méxico')) return 'MX'
  if (text.includes('miami') || text.includes('united states') || text.includes('estados unidos')) return 'US'
  return ''
}

function locationCountryCode(item: PricingCatalogItem | null | undefined) {
  return metadataCountryCode(item) || inferCountryCode([item?.name, item?.code, item?.value].filter(Boolean).join(' '))
}

function countryName(code: string) {
  return COUNTRY_NAMES[code] || code || 'Sin país'
}

function originLabel(code: string) {
  if (code === 'PA') return 'CFZ, Panamá'
  if (code === 'CR') return 'San José, Costa Rica'
  return countryName(code)
}

function isAllowedLtlOriginRow(row: FtlTariffDto) {
  const value = normalize([row.originName, row.originCode].filter(Boolean).join(' '))
  const country = rowCountryCode(row, 'origin')

  if (country === 'PA') {
    return value.includes('cfz')
      || value.includes('colon free zone')
      || value.includes('zona libre de colon')
      || value.includes('zona libre colon')
  }

  if (country === 'CR') {
    return value.includes('san jose')
  }

  return false
}

const allLandOrigins = computed(() =>
  catalogs.polPorts.value.filter((item) => routeTerminalType(item, 'CY') === 'SD'),
)

function isAllowedLtlOriginItem(item: PricingCatalogItem) {
  const value = normalize([item.name, item.code, item.value, item.slug].filter(Boolean).join(' '))
  const country = locationCountryCode(item)

  if (country === 'PA') {
    return value.includes('cfz')
      || value.includes('colon free zone')
      || value.includes('zona libre de colon')
      || value.includes('zona libre colon')
  }

  if (country === 'CR') {
    return value.includes('san jose')
  }

  return false
}

const landOrigins = computed(() =>
  allLandOrigins.value.filter(isAllowedLtlOriginItem),
)

const landDestinations = computed(() =>
  catalogs.poePorts.value.filter((item) => routeTerminalType(item, 'CY') === 'SD'),
)

function catalogItemById(id: string | null | undefined, role: 'origin' | 'destination') {
  if (!id) return null
  return (role === 'origin' ? landOrigins.value : landDestinations.value)
    .find((item) => item.id === id) ?? null
}

function rowCountryCode(row: FtlTariffDto, role: 'origin' | 'destination') {
  const item = catalogItemById(role === 'origin' ? row.originId : row.destinationId, role)
  if (item) {
    const code = locationCountryCode(item)
    if (code) return code
  }

  return inferCountryCode(
    role === 'origin'
      ? [row.originName, row.originCode].filter(Boolean).join(' ')
      : [row.destinationName, row.destinationCode].filter(Boolean).join(' '),
  )
}

function uniqueCountries(values: string[]) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => countryName(a).localeCompare(countryName(b), 'es'))
}

const profileRows = computed(() =>
  rows.value.filter((row) => isAllowedLtlOriginRow(row)),
)

const originCountries = computed(() => ['PA', 'CR'])

const destinationCountries = computed(() =>
  uniqueCountries([
    ...landDestinations.value.map(locationCountryCode),
    ...profileRows.value.map((row) => rowCountryCode(row, 'destination')),
  ]),
)

const selectedPairRows = computed(() =>
  profileRows.value.filter((row) =>
    rowCountryCode(row, 'origin') === selectedOriginCountry.value
    && rowCountryCode(row, 'destination') === selectedDestinationCountry.value,
  ),
)

function originRouteCount(code: string) {
  return profileRows.value.filter((row) => rowCountryCode(row, 'origin') === code).length
}

function destinationRouteCount(code: string) {
  return profileRows.value.filter((row) =>
    rowCountryCode(row, 'origin') === selectedOriginCountry.value
    && rowCountryCode(row, 'destination') === code,
  ).length
}

function routeSnapshot(value: string, role: 'origin' | 'destination') {
  if (value === LEGACY_ORIGIN && role === 'origin' && selected.value) {
    return {
      id: null,
      name: selected.value.originName,
      code: selected.value.originCode,
    }
  }

  if (value === LEGACY_DESTINATION && role === 'destination' && selected.value) {
    return {
      id: null,
      name: selected.value.destinationName,
      code: selected.value.destinationCode,
    }
  }

  const list = role === 'origin' ? landOrigins.value : landDestinations.value
  const item = list.find((candidate) => candidate.id === value)
  return item ? { id: item.id, name: item.name, code: item.code } : null
}

function optionsForCountry(role: 'origin' | 'destination', countryCode: string) {
  const list = role === 'origin' ? landOrigins.value : landDestinations.value
  return list
    .filter((item) => locationCountryCode(item) === countryCode)
    .map((item) => ({
      value: item.id,
      label: item.name,
      searchText: [item.code, item.value, item.slug, item.name].filter(Boolean).join(' '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

const originLocationOptions = computed(() => {
  const options = optionsForCountry('origin', selectedOriginCountry.value)

  if (selected.value && !selected.value.originId) {
    options.unshift({
      value: LEGACY_ORIGIN,
      label: selected.value.originName + ' · ruta actual',
      searchText: [selected.value.originCode, selected.value.originName].filter(Boolean).join(' '),
    })
  }

  return options
})

const destinationLocationOptions = computed(() => {
  const options = optionsForCountry('destination', selectedDestinationCountry.value)

  if (selected.value && !selected.value.destinationId) {
    options.unshift({
      value: LEGACY_DESTINATION,
      label: selected.value.destinationName + ' · ruta actual',
      searchText: [selected.value.destinationCode, selected.value.destinationName].filter(Boolean).join(' '),
    })
  }

  return options
})

function isPanamaValue(value: unknown) {
  const normalized = normalize(value)
  return normalized.includes('panama')
    || normalized.includes('panamá')
    || normalized.includes('cfz')
    || normalized.includes('colon free zone')
    || normalized.includes('zona libre de colon')
}

function isPanamaOrigin(row: FtlTariffDto) {
  return rowCountryCode(row, 'origin') === 'PA'
    || isPanamaValue([row.originName, row.originCode].filter(Boolean).join(' '))
}

const formOrigin = computed(() => routeSnapshot(form.originId, 'origin'))
const formDestination = computed(() => routeSnapshot(form.destinationId, 'destination'))
const formIsPanamaOrigin = computed(() =>
  selectedOriginCountry.value === 'PA'
  || isPanamaValue([formOrigin.value?.name, formOrigin.value?.code].filter(Boolean).join(' ')),
)

const effectiveCostPerCbm = computed(() =>
  Math.max(Number(form.costPerCbm || 0), 0)
  + (formIsPanamaOrigin.value ? Math.max(Number(form.panamaCostSurchargePerCbm || 0), 0) : 0),
)

const documentCostTotal = computed(() =>
  Math.max(Number(form.duaCost || 0), 0) + Math.max(Number(form.ducaTCost || 0), 0),
)

const variableCostPerCbm = computed(() =>
  effectiveCostPerCbm.value + Math.max(Number(form.stuffingCostPerCbm || 0), 0),
)

const routeTitle = computed(() => {
  if (!formOrigin.value && !formDestination.value) {
    return originLabel(selectedOriginCountry.value) + ' → ' + countryName(selectedDestinationCountry.value)
  }

  return (formOrigin.value?.name || originLabel(selectedOriginCountry.value))
    + ' → '
    + (formDestination.value?.name || countryName(selectedDestinationCountry.value))
})

function effectiveRowCost(row: FtlTariffDto) {
  return Number(row.costPerCbm ?? 0)
    + (isPanamaOrigin(row) ? Number(row.panamaCostSurchargePerCbm ?? DEFAULT_PANAMA_SURCHARGE_PER_CBM) : 0)
}

function selectOriginCountry(code: string) {
  selectedOriginCountry.value = code
  selectedDestinationCountry.value = ''
  closeEditor()
}

function selectDestinationCountry(code: string) {
  selectedDestinationCountry.value = code
  closeEditor()
}

function resetForm() {
  selectedId.value = ''
  readOnly.value = false
  Object.assign(form, {
    commercialProfile: 'FinalClient' as LandCommercialProfile,
    originId: '',
    destinationId: '',
    currencyId: catalogs.currencies.value.find((item) => String(item.code || item.value).toUpperCase() === 'USD')?.id || '',
    priceAmount: '',
    minimumAmount: '',
    costPerCbm: '',
    weightKgPerCbm: String(DEFAULT_WEIGHT_KG_PER_CBM),
    duaCost: String(DEFAULT_DUA_COST),
    ducaTCost: String(DEFAULT_DUCA_T_COST),
    stuffingCostPerCbm: String(DEFAULT_STUFFING_COST_PER_CBM),
    stuffingSalePerCbm: String(DEFAULT_STUFFING_SALE_PER_CBM),
    panamaCostSurchargePerCbm: String(DEFAULT_PANAMA_SURCHARGE_PER_CBM),
    ltlCharges: hydrateLtlCharges('FinalClient' as LandCommercialProfile),
    transitDays: '',
    warehouseName: '',
    source: '',
    notes: '',
    validFrom: '',
    validTo: '',
    isActive: true,
    submitted: false,
  })

  if (originLocationOptions.value.length === 1) form.originId = originLocationOptions.value[0]!.value
  if (destinationLocationOptions.value.length === 1) form.destinationId = destinationLocationOptions.value[0]!.value
}

async function scrollToEditor() {
  await nextTick()
  requestAnimationFrame(() => {
    editorSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function newRouteForPair() {
  if (!canCreate.value) {
    toastStore.warning('Permiso requerido', 'Necesita el scope pricing.cost.create para crear una tarifa LTL.')
    return
  }

  if (!selectedOriginCountry.value || !selectedDestinationCountry.value) {
    toastStore.warning('Seleccione la ruta', 'Seleccione país de origen y país de destino.')
    return
  }

  resetForm()
  editorOpen.value = true
  await scrollToEditor()
}

function hydrateForm(row: FtlTariffDto) {
  Object.assign(form, {
    commercialProfile: row.commercialProfile === 'Nvocc' ? 'Nvocc' : 'FinalClient',
    originId: row.originId || LEGACY_ORIGIN,
    destinationId: row.destinationId || LEGACY_DESTINATION,
    currencyId: row.currencyId || '',
    priceAmount: String(row.priceAmount ?? ''),
    minimumAmount: row.minimumAmount == null ? '' : String(row.minimumAmount),
    costPerCbm: row.costPerCbm == null ? '' : String(row.costPerCbm),
    weightKgPerCbm: String(row.weightKgPerCbm ?? DEFAULT_WEIGHT_KG_PER_CBM),
    duaCost: String(row.duaCost ?? DEFAULT_DUA_COST),
    ducaTCost: String(row.ducaTCost ?? DEFAULT_DUCA_T_COST),
    stuffingCostPerCbm: String(row.stuffingCostPerCbm ?? DEFAULT_STUFFING_COST_PER_CBM),
    stuffingSalePerCbm: String(row.stuffingSalePerCbm ?? DEFAULT_STUFFING_SALE_PER_CBM),
    panamaCostSurchargePerCbm: String(row.panamaCostSurchargePerCbm ?? DEFAULT_PANAMA_SURCHARGE_PER_CBM),
    ltlCharges: hydrateLtlCharges(
      row.commercialProfile === 'Nvocc' ? 'Nvocc' : 'FinalClient',
      row.ltlChargeItems,
    ),
    transitDays: row.transitDays == null ? '' : String(row.transitDays),
    warehouseName: row.warehouseName || '',
    source: row.source || '',
    notes: row.notes || '',
    validFrom: row.validFrom?.slice(0, 10) || '',
    validTo: row.validTo?.slice(0, 10) || '',
    isActive: row.isActive,
    submitted: false,
  })
}

async function openRow(row: OwnLtlTableRow, mode: 'view' | 'edit') {
  selectedOriginCountry.value = rowCountryCode(row, 'origin')
  selectedDestinationCountry.value = rowCountryCode(row, 'destination')
  selectedId.value = row.id
  readOnly.value = mode === 'view'
  hydrateForm(row)
  editorOpen.value = true
  await scrollToEditor()
}

function closeEditor() {
  editorOpen.value = false
  selectedId.value = ''
  readOnly.value = false
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function buildPayload(): CreateLandTariffItem | null {
  form.submitted = true

  const origin = routeSnapshot(form.originId, 'origin')
  const destination = routeSnapshot(form.destinationId, 'destination')
  const currency = catalogs.currencies.value.find((item) => item.id === form.currencyId)

  const priceAmount = numberOrNull(form.priceAmount)
  const minimumAmount = numberOrNull(form.minimumAmount)
  const costPerCbm = numberOrNull(form.costPerCbm)
  const weightKgPerCbm = numberOrNull(form.weightKgPerCbm)
  const duaCost = numberOrNull(form.duaCost)
  const ducaTCost = numberOrNull(form.ducaTCost)
  const stuffingCostPerCbm = numberOrNull(form.stuffingCostPerCbm)
  const stuffingSalePerCbm = numberOrNull(form.stuffingSalePerCbm)
  const panamaCostSurchargePerCbm = numberOrNull(form.panamaCostSurchargePerCbm)
  const transitDays = numberOrNull(form.transitDays)
  const ltlChargeItems = form.ltlCharges.map((charge) => {
    const costAmount = numberOrNull(charge.costAmount)
    const saleAmount = numberOrNull(charge.saleAmount)
    return {
      key: charge.key,
      name: charge.name,
      costDetailType: charge.costDetailType,
      chargeBasis: charge.chargeBasis,
      section: charge.section,
      costAmount,
      saleAmount,
      isFlat: charge.isFlat,
    } satisfies LtlChargeItemDto
  })
  const invalidVariableCharge = form.ltlCharges.some((charge, index) => {
    if (charge.isFlat) return false
    const value = ltlChargeItems[index]!
    return (charge.costAmount.trim() && (value.costAmount == null || !Number.isFinite(value.costAmount) || value.costAmount < 0))
      || (charge.saleAmount.trim() && (value.saleAmount == null || !Number.isFinite(value.saleAmount) || value.saleAmount < 0))
  })

  if (
    !origin
    || !destination
    || !currency
    || priceAmount == null
    || !Number.isFinite(priceAmount)
    || priceAmount < 0
    || costPerCbm == null
    || !Number.isFinite(costPerCbm)
    || costPerCbm < 0
    || weightKgPerCbm == null
    || !Number.isFinite(weightKgPerCbm)
    || weightKgPerCbm <= 0
    || (minimumAmount != null && (!Number.isFinite(minimumAmount) || minimumAmount < 0))
    || [duaCost, ducaTCost, stuffingCostPerCbm, stuffingSalePerCbm, panamaCostSurchargePerCbm]
      .some((value) => value == null || !Number.isFinite(value) || value < 0)
    || invalidVariableCharge
    || (transitDays != null && (!Number.isInteger(transitDays) || transitDays < 0))
    || (form.validFrom && form.validTo && form.validFrom > form.validTo)
  ) {
    return null
  }

  return {
    originId: origin.id,
    originName: origin.name,
    originCode: origin.code || null,
    destinationId: destination.id,
    destinationName: destination.name,
    destinationCode: destination.code || null,
    shipmentMode: 'Ltl',
    commercialProfile: form.commercialProfile,
    equipmentClass: 'LTL_CBM',
    equipmentLabel: 'LTL · Consolidado',
    applicableEquipmentClasses: ['LTL_CBM'],
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code || currency.value || currency.name,
    priceAmount,
    rateBasis: 'PerCbm',
    minimumAmount,
    costPerCbm,
    weightKgPerCbm,
    duaCost,
    ducaTCost,
    stuffingCostPerCbm,
    stuffingSalePerCbm,
    panamaCostSurchargePerCbm,
    ltlChargeItems,
    transitDays,
    warehouseName: form.warehouseName.trim() || null,
    source: form.source.trim() || null,
    notes: form.notes.trim() || null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    isActive: form.isActive,
  }
}

async function load() {
  loading.value = true
  try {
    await catalogs.loadAll()
    rows.value = (await FtlTariffService.browse('Ltl')) as OwnLtlTableRow[]
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la matriz LTL propia.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (readOnly.value) return

  const editing = Boolean(selectedId.value)
  if (editing && !canUpdate.value) {
    toastStore.warning('Permiso requerido', 'Necesita el scope pricing.cost.update para editar una tarifa LTL.')
    return
  }
  if (!editing && !canCreate.value) {
    toastStore.warning('Permiso requerido', 'Necesita el scope pricing.cost.create para crear una tarifa LTL.')
    return
  }

  const payload = buildPayload()
  if (!payload) {
    toastStore.error(
      'Revise la ruta',
      'Seleccione los puntos de origen y destino y complete costo/venta por CBM, factor de peso y cargos LTL.',
    )
    return
  }

  try {
    saving.value = true
    let targetId = selectedId.value

    if (targetId) {
      await FtlTariffService.update(targetId, payload)
    } else {
      const created = await FtlTariffService.create(payload)
      targetId = created.id
      selectedId.value = created.id
    }

    toastStore.success(
      editing ? 'Ruta actualizada' : 'Ruta creada',
      payload.originName + ' → ' + payload.destinationName + ' quedó guardada como tarifa LTL.',
    )

    await load()
    const row = rows.value.find((item) => item.id === targetId)
    if (row) openRow(row, 'view')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la ruta LTL.')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Tarifas LTL"
      description="Administre las tarifas LTL por país de origen y destino."
    />

    <section class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow)] backdrop-blur-2xl">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] p-5">
        <div>
          <div class="flex items-center gap-2">
            <Truck class="h-5 w-5 text-[var(--dh-primary)]" />
            <h2 class="text-lg font-black">Rutas LTL</h2>
          </div>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Primero seleccione el país de origen y luego el país de destino para administrar sus datos.
          </p>
        </div>
      </header>

      <div class="p-5">
        <section>
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">1. Origen</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El LTL solo puede salir desde CFZ, Panamá o San José, Costa Rica.</p>
            </div>
            <DhButton
              v-if="selectedOriginCountry"
              label="Cambiar origen"
              :icon="ChevronLeft"
              variant="ghost"
              size="sm"
              @click="selectedOriginCountry = ''; selectedDestinationCountry = ''; closeEditor()"
            />
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              v-for="code in originCountries"
              :key="code"
              type="button"
              class="rounded-2xl border px-4 py-4 text-left transition hover:border-[var(--dh-primary)]"
              :class="selectedOriginCountry === code
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/8'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)]'"
              @click="selectOriginCountry(code)"
            >
              <p class="font-black text-[var(--dh-text)]">{{ originLabel(code) }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ originRouteCount(code) }} rutas configuradas</p>
            </button>
          </div>

          <div v-if="originCountries.length === 0" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-5 text-sm font-semibold text-[var(--dh-text-muted)]">
            No hay países de origen terrestres configurados.
          </div>
        </section>

        <section v-if="selectedOriginCountry" class="mt-6 border-t border-[var(--dh-border)] pt-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">2. País de destino</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                Origen seleccionado: <strong class="text-[var(--dh-text)]">{{ originLabel(selectedOriginCountry) }}</strong>
              </p>
            </div>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              v-for="code in destinationCountries"
              :key="code"
              type="button"
              class="rounded-2xl border px-4 py-4 text-left transition hover:border-[var(--dh-primary)]"
              :class="selectedDestinationCountry === code
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/8'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)]'"
              @click="selectDestinationCountry(code)"
            >
              <p class="font-black text-[var(--dh-text)]">{{ countryName(code) }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ destinationRouteCount(code) }} rutas desde {{ countryName(selectedOriginCountry) }}</p>
            </button>
          </div>
        </section>

        <section v-if="selectedOriginCountry && selectedDestinationCountry" class="mt-6 border-t border-[var(--dh-border)] pt-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">3. Datos de la ruta</p>
              <p class="mt-1 text-sm font-black text-[var(--dh-text)]">
                {{ originLabel(selectedOriginCountry) }} → {{ countryName(selectedDestinationCountry) }}
              </p>
            </div>
            <DhButton v-if="canCreate" label="Agregar ruta" :icon="Plus" @click.stop="newRouteForPair" />
          </div>

          <div v-if="selectedPairRows.length" class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)]">
            <table class="w-full min-w-[920px] text-sm">
              <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]">
                <tr>
                  <th class="px-4 py-3 text-left">Origen</th>
                  <th class="px-4 py-3 text-left">Destino</th>
                  <th class="px-4 py-3 text-right">Costo / CBM</th>
                  <th class="px-4 py-3 text-right">Venta / CBM</th>
                  <th class="px-4 py-3 text-right">Mínimo</th>
                  <th class="px-4 py-3 text-right">Documentos</th>
                  <th class="px-4 py-3 text-center">Tránsito</th>
                  <th class="px-4 py-3 text-center">Estado</th>
                  <th class="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in selectedPairRows" :key="row.id" class="border-t border-[var(--dh-border)] first:border-t-0">
                  <td class="px-4 py-3">
                    <p class="font-black">{{ row.originName }}</p>
                    <p class="mt-0.5 text-[11px] text-[var(--dh-text-muted)]">{{ row.warehouseName || 'Sin almacén' }}</p>
                  </td>
                  <td class="px-4 py-3 font-black">{{ row.destinationName }}</td>
                  <td class="px-4 py-3 text-right">
                    <p class="font-black">USD {{ money(effectiveRowCost(row)) }}</p>
                    <p v-if="isPanamaOrigin(row)" class="text-[10px] text-[var(--dh-text-muted)]">incluye +USD {{ money(row.panamaCostSurchargePerCbm ?? DEFAULT_PANAMA_SURCHARGE_PER_CBM) }}</p>
                  </td>
                  <td class="px-4 py-3 text-right font-black text-[var(--dh-primary)]">USD {{ money(row.priceAmount) }}</td>
                  <td class="px-4 py-3 text-right font-black">USD {{ money(row.minimumAmount) }}</td>
                  <td class="px-4 py-3 text-right text-xs font-bold">
                    <p>DUA {{ money(row.duaCost ?? DEFAULT_DUA_COST) }}</p>
                    <p class="text-[var(--dh-text-muted)]">DUCA-T {{ money(row.ducaTCost ?? DEFAULT_DUCA_T_COST) }}</p>
                  </td>
                  <td class="px-4 py-3 text-center font-bold">{{ row.transitDays == null ? '—' : row.transitDays + ' días' }}</td>
                  <td class="px-4 py-3 text-center">
                    <DhBadge :label="row.isActive ? 'Activa' : 'Inactiva'" :variant="row.isActive ? 'success' : 'neutral'" />
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-1">
                      <DhButton :icon="Eye" variant="ghost" size="sm" aria-label="Ver ruta" @click.stop="openRow(row, 'view')" />
                      <DhButton v-if="canUpdate" :icon="Edit3" variant="ghost" size="sm" aria-label="Editar ruta" @click.stop="openRow(row, 'edit')" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] px-5 py-10 text-center">
            <p class="font-black text-[var(--dh-text)]">No hay una ruta configurada para esta combinación.</p>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Use “Agregar ruta” para ingresar los valores de {{ originLabel(selectedOriginCountry) }} → {{ countryName(selectedDestinationCountry) }}.</p>
          </div>
        </section>
      </div>
    </section>

    <section ref="editorSection" v-if="editorOpen" class="scroll-mt-36 rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow)] backdrop-blur-2xl">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] p-5">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <Truck class="h-5 w-5 text-[var(--dh-primary)]" />
            <h2 class="text-lg font-black">{{ routeTitle }}</h2>
            <DhBadge v-if="readOnly" label="Solo lectura" variant="neutral" />
          </div>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ originLabel(selectedOriginCountry) }} → {{ countryName(selectedDestinationCountry) }} · Los valores quedan asociados a esta ruta LTL.
          </p>
        </div>
        <DhButton :icon="X" variant="ghost" aria-label="Cerrar" @click="closeEditor" />
      </header>

      <div class="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div class="space-y-5">
          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <p class="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Datos de la ruta</p>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3">
                <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Modalidad</p>
                <p class="mt-1 text-sm font-black">LTL</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3">
                <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Origen</p>
                <p class="mt-1 text-sm font-black">{{ originLabel(selectedOriginCountry) }}</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3">
                <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">País destino</p>
                <p class="mt-1 text-sm font-black">{{ countryName(selectedDestinationCountry) }}</p>
              </div>

              <PricingLocationSearchSelect
                v-model="form.originId"
                label="Punto de origen"
                placeholder="Buscar origen"
                search-placeholder="Buscar ubicación terrestre…"
                terminal-type="SD"
                :disabled="readOnly"
                :options="originLocationOptions"
              />

              <PricingLocationSearchSelect
                v-model="form.destinationId"
                label="Punto de destino"
                placeholder="Buscar destino"
                search-placeholder="Buscar ubicación terrestre…"
                terminal-type="SD"
                :disabled="readOnly"
                :options="destinationLocationOptions"
              />

              <DhSelect
                v-model="form.currencyId"
                label="Moneda"
                :disabled="readOnly"
                :options="catalogs.currencyOptions.value"
              />

              <DhInput v-model="form.transitDays" type="number" min="0" step="1" label="Días de tránsito" :disabled="readOnly" />
              <DhInput v-model="form.warehouseName" label="Almacén de ingreso" placeholder="Opcional" :disabled="readOnly" />
              <DhInput v-model="form.source" label="Fuente / proveedor" placeholder="Opcional" :disabled="readOnly" />
              <DhInput v-model="form.validFrom" type="date" label="Vigencia desde" :disabled="readOnly" />
              <DhInput v-model="form.validTo" type="date" label="Vigencia hasta" :disabled="readOnly" />
            </div>

            <div class="mt-4">
              <DhTextarea v-model="form.notes" label="Notas" :rows="3" :disabled="readOnly" />
            </div>

            <label class="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--dh-border)] px-4 py-3">
              <input v-model="form.isActive" type="checkbox" class="h-4 w-4" :disabled="readOnly" />
              <span>
                <strong class="block text-sm text-[var(--dh-text)]">Ruta activa</strong>
                <span class="text-xs font-semibold text-[var(--dh-text-muted)]">Disponible para resolver cotizaciones LTL.</span>
              </span>
            </label>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifario de la ruta · costos y ventas</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Ingrese los valores de esta combinación de país origen y país destino.</p>
            </div>

            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
              <table class="w-full min-w-[760px] text-sm">
                <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]">
                  <tr>
                    <th class="px-4 py-3 text-left">Concepto</th>
                    <th class="px-4 py-3 text-left">Base cobro</th>
                    <th class="px-4 py-3 text-right">Costo USD</th>
                    <th class="px-4 py-3 text-right">Venta USD</th>
                    <th class="px-4 py-3 text-right">Mínimo USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3">
                      <p class="font-black">Flete terrestre LTL</p>
                      <p v-if="formIsPanamaOrigin" class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">Al costo base se suma el recargo de salida Panamá.</p>
                    </td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">CBM</td>
                    <td class="px-4 py-3 text-right"><input v-model="form.costPerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                    <td class="px-4 py-3 text-right"><input v-model="form.priceAmount" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                    <td class="px-4 py-3 text-right"><input v-model="form.minimumAmount" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                  </tr>

                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3"><p class="font-black">Recargo salida Panamá</p><p class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">Solo se aplica cuando el origen es Panamá.</p></td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">CBM</td>
                    <td class="px-4 py-3 text-right"><input v-model="form.panamaCostSurchargePerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Cargos y recargos LTL</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                Los cargos Flat tienen costo/venta definidos. Los variables no tienen monto fijo y se completan cuando corresponda.
              </p>
            </div>

            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
              <table class="w-full min-w-[760px] text-sm">
                <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]">
                  <tr>
                    <th class="px-4 py-3 text-left">Concepto</th>
                    <th class="px-4 py-3 text-left">Tipo</th>
                    <th class="px-4 py-3 text-left">Base</th>
                    <th class="px-4 py-3 text-right">Costo USD</th>
                    <th class="px-4 py-3 text-right">Venta USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="charge in form.ltlCharges" :key="charge.key" class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3">
                      <p class="font-black">{{ charge.name }}</p>
                      <p v-if="charge.key === 'stuffing'" class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                        Costo por CBM = USD 550 ÷ 60. Venta = USD 10 / CBM.
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <DhBadge :label="charge.isFlat ? 'Flat' : 'Variable'" :variant="charge.isFlat ? 'success' : 'warning'" />
                    </td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">{{ ltlChargeBasisLabel(charge.chargeBasis) }}</td>
                    <td class="px-4 py-3 text-right">
                      <span v-if="charge.isFlat" class="font-black">USD {{ money(charge.costAmount) }}</span>
                      <input
                        v-else
                        v-model="charge.costAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Variable"
                        :disabled="readOnly"
                        class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60"
                      />
                    </td>
                    <td class="px-4 py-3 text-right">
                      <span v-if="charge.isFlat" class="font-black text-[var(--dh-primary)]">USD {{ money(charge.saleAmount) }}</span>
                      <input
                        v-else
                        v-model="charge.saleAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Variable"
                        :disabled="readOnly"
                        class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Regla de cubicaje LTL</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Se usa el mayor entre CBM dimensional y CBM por peso.</p>
              </div>
              <div class="w-full sm:w-64"><DhInput v-model="form.weightKgPerCbm" type="number" min="0.01" step="0.01" label="Peso kg por CBM" :disabled="readOnly" /></div>
            </div>
          </section>
        </div>

        <aside class="space-y-4">
          <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-5 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Resumen de la ruta</p>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo base / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(form.costPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Venta / CBM</p><p class="mt-1 text-xl font-black text-[var(--dh-primary)]">USD {{ money(form.priceAmount) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo efectivo / CBM</p><p class="mt-1 text-xl font-black text-[var(--dh-primary)]">USD {{ money(effectiveCostPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Documentos</p><p class="mt-1 text-xl font-black">USD {{ money(documentCostTotal) }}</p></div>
            </div>
            <div class="mt-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo variable proyectado</p><p class="mt-1 text-2xl font-black text-[var(--dh-primary)]">USD {{ money(variableCostPerCbm) }} / CBM</p></div>
            <div class="mt-3 rounded-2xl border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-primary)]">Venta mínima</p><p class="mt-1 text-2xl font-black">USD {{ money(form.minimumAmount) }}</p></div>
          </section>

          <div v-if="!readOnly" class="flex justify-end gap-2">
            <DhButton label="Cancelar" variant="secondary" @click="closeEditor" />
            <DhButton :label="selectedId ? 'Guardar ruta' : 'Crear ruta'" :loading="saving" @click="save" />
          </div>

          <div v-else class="flex justify-end">
            <DhButton v-if="canUpdate" label="Editar" :icon="Edit3" variant="secondary" @click="readOnly = false" />
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>
