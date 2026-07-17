<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { AlertTriangle, Info, LockKeyhole, Plus, Save, Ship, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type {
  CostDetailType,
  CostSelectDto,
  CostType,
  CreateRateDetailRequest,
  CreateRateRequest,
  ImportRateDto,
  RateDetailDto,
  RateDto,
  UpdateRateRequest,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingMultiSelect, { type PricingMultiSelectOption } from './PricingMultiSelect.vue'
import {
  calculateMargin,
  formatMoney,
  minimumSale,
  toDateInput,
} from '@/modules/pricing/utils/pricingFormat'

interface EditableDetail {
  key: string
  id?: string | null
  costId?: string | null
  name: string
  costDetailType: CostDetailType
  costType: CostType
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: string
  saleAmount: string
  notes: string
  locked: boolean
  importedFreight?: boolean
  estimated?: boolean
  fixedDecisionCost?: boolean
}

const props = defineProps<{
  rate?: RateDto
  sourceImport?: ImportRateDto
  decisionInternationalLandFreight?: number | null
  onSaved?: (rateId?: string) => void | Promise<void>
}>()

const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const authStore = useAuthStore()
const catalogs = usePricingCatalogs()
const availableCosts = ref<CostSelectDto[]>([])
const details = ref<EditableDetail[]>([])
const optionalCostIds = ref<string[]>([])
const removedDetailIds = ref<string[]>([])
const initialized = ref(false)

const today = new Date()
const nextMonth = new Date(today)
nextMonth.setDate(nextMonth.getDate() + 30)
const dateValue = (date: Date) => date.toISOString().slice(0, 10)

const form = reactive({
  agentId: props.rate?.agentId ?? '',
  carrierId: props.rate?.carrierId ?? '',
  polId: props.rate?.polId ?? '',
  poeId: props.rate?.poeId ?? '',
  podId: props.rate?.podId ?? '',
  containerTypeId: props.rate?.containerTypeId ?? '',
  currencyId: props.rate?.currencyId ?? '',
  containerQuantity: String(props.rate?.containerQuantity ?? 1),
  freeDays: String(props.rate?.freeDays ?? props.sourceImport?.freeDays ?? 0),
  validFrom:
    toDateInput(props.rate?.validFrom ?? props.sourceImport?.validFrom) || dateValue(today),
  validTo: toDateInput(props.rate?.validTo ?? props.sourceImport?.validTo) || dateValue(nextMonth),
  clientName: props.rate?.clientName ?? '',
  idtraNumber: props.rate?.idtraNumber ?? '',
  quoNumber: props.rate?.quoNumber ?? '',
  includes: props.rate?.includes ?? '',
  subjectTo: props.rate?.subjectTo ?? '',
  excludes: props.rate?.excludes ?? '',
  transitDays: String(props.rate?.transitDays ?? props.sourceImport?.transitDays ?? ''),
  submitted: false,
  saving: false,
})

const isEditing = computed(() => Boolean(props.rate))
const isFromImport = computed(() => Boolean(props.sourceImport || props.rate?.sourceImportFclRateId))
const isHeaderLocked = isFromImport
const canAutoApprove = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin))
const selectedCurrency = computed(() =>
  catalogs.findById(catalogs.currencies.value, form.currencyId),
)
const currencyName = computed(
  () =>
    selectedCurrency.value?.name ||
    props.rate?.currencyName ||
    props.sourceImport?.currency ||
    'USD',
)

const detailTypeOptions: Array<{ label: string; value: CostDetailType }> = [
  { label: 'Flete internacional', value: 'Freight' },
  { label: 'Costo de agente', value: 'AgentCharge' },
  { label: 'Cargo en origen', value: 'OriginCharge' },
  { label: 'Cargo en destino', value: 'DestinationCharge' },
  { label: 'Cargo portuario', value: 'PortCharge' },
  { label: 'Aduana', value: 'CustomsCharge' },
  { label: 'Transporte interno', value: 'InlandTransport' },
  { label: 'Documentación', value: 'Documentation' },
  { label: 'Seguro', value: 'Insurance' },
  { label: 'Otro', value: 'Other' },
]

const editableTypeOptions = [
  { label: 'Variable', value: 'Variable' },
  { label: 'Opcional', value: 'Optional' },
]

function normalizeKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function readRawValues(raw: string, keys: string[]) {
  if (!raw.trim().startsWith('{') && !raw.trim().startsWith('[')) return []

  try {
    const results: string[] = []
    const targetKeys = new Set(keys.map(normalizeKey))
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit)
        return
      }

      if (!value || typeof value !== 'object') return

      for (const [key, item] of Object.entries(value)) {
        if (
          targetKeys.has(normalizeKey(key)) &&
          (typeof item === 'string' || typeof item === 'number')
        ) {
          results.push(String(item))
        }
        visit(item)
      }
    }

    visit(JSON.parse(raw) as unknown)
    return [...new Set(results)]
  } catch {
    return []
  }
}

function fromRateDetail(detail: RateDetailDto): EditableDetail {
  const masterCost = detail.costId
    ? availableCosts.value.find((cost) => cost.id === detail.costId)
    : undefined

  return {
    key: detail.id,
    id: detail.id,
    costId: detail.costId,
    name: detail.name,
    costDetailType: detail.costDetailType,
    costType: detail.costType,
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    costAmount: String(detail.costAmount),
    saleAmount: String(detail.saleAmount),
    notes: detail.notes?.trim() || masterCost?.notes?.trim() || '',
    locked: detail.costType === 'Fixed' && Boolean(detail.costId),
  }
}

function fromCost(cost: CostSelectDto): EditableDetail {
  return {
    key: `cost-${cost.id}`,
    costId: cost.id,
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    currencyId: cost.currencyId,
    currencyName: cost.currencyName,
    currencyCode: cost.currencyCode,
    costAmount: String(cost.costAmount),
    saleAmount: String(cost.agentId ? 0 : cost.saleAmount),
    notes: cost.notes ?? '',
    locked: false,
  }
}

function addManualDetail(type: CostDetailType = 'Other') {
  details.value.push({
    key: crypto.randomUUID(),
    name: type === 'Freight' ? 'Flete internacional' : '',
    costDetailType: type,
    costType: 'Variable',
    currencyId: form.currencyId,
    currencyName: selectedCurrency.value?.name ?? '',
    currencyCode: selectedCurrency.value?.code ?? '',
    costAmount: '',
    saleAmount: '',
    notes: '',
    locked: false,
  })
}

function removeDetail(detail: EditableDetail) {
  if (detail.locked || detail.fixedDecisionCost) return
  if (detail.id) removedDetailIds.value.push(detail.id)
  if (detail.costId)
    optionalCostIds.value = optionalCostIds.value.filter((id) => id !== detail.costId)
  details.value = details.value.filter((item) => item.key !== detail.key)
}

const optionalCosts = computed(() => {
  const routePortIds = new Set([form.polId, form.poeId, form.podId].filter(Boolean))
  return availableCosts.value.filter((cost) => {
    if (cost.costType !== 'Optional') return false
    if (form.currencyId && cost.currencyId !== form.currencyId) return false
    if (cost.carrierId && cost.carrierId !== form.carrierId) return false
    if (cost.agentId && cost.agentId !== form.agentId) return false
    if (cost.portId && routePortIds.size && !routePortIds.has(cost.portId)) return false
    return true
  })
})

const optionalOptions = computed<PricingMultiSelectOption[]>(() =>
  optionalCosts.value.map((cost) => ({
    value: cost.id,
    label: cost.name,
    description: `${cost.costDetailType} · ${formatMoney(cost.costAmount, cost.currencyName)}`,
    notes: cost.notes?.trim() || undefined,
  })),
)

function matchesCostScope(cost: CostSelectDto) {
  if (form.currencyId && cost.currencyId !== form.currencyId) return false
  if (cost.agentId && cost.agentId !== form.agentId) return false
  if (cost.carrierId && cost.carrierId !== form.carrierId) return false
  if (!cost.portId) return true

  const roleByPort = new Map<string, CostSelectDto['portRole']>([
    [form.polId, 'Pol'],
    [form.poeId, 'Poe'],
    [form.podId, 'Pod'],
  ])
  const matchedRole = roleByPort.get(cost.portId)
  if (!matchedRole) return false
  return !cost.portRole || cost.portRole === 'Any' || cost.portRole === matchedRole
}

const automaticFixedCosts = computed(() =>
  availableCosts.value.filter((cost) => cost.costType === 'Fixed' && matchesCostScope(cost)),
)


async function loadOperationalCosts(): Promise<CostSelectDto[]> {
  const costs = await PricingService.selectCosts({ isActive: true })

  return costs.map((cost) => ({
    ...cost,
    notes: typeof cost.notes === 'string' ? cost.notes.trim() || null : null,
  }))
}

const selectorsChanged = computed(() =>
  Boolean(
    props.rate &&
    (props.rate.agentId !== form.agentId ||
      props.rate.carrierId !== form.carrierId ||
      props.rate.polId !== form.polId ||
      props.rate.poeId !== form.poeId ||
      props.rate.podId !== form.podId),
  ),
)

const visibleDetails = computed(() => {
  const currentRows = selectorsChanged.value
    ? details.value.filter((detail) => !detail.locked)
    : details.value
  const currentFixedIds = new Set(
    currentRows.filter((detail) => detail.locked).map((detail) => detail.costId),
  )
  const estimated = automaticFixedCosts.value
    .filter((cost) => !currentFixedIds.has(cost.id))
    .map((cost) => ({
      ...fromCost(cost),
      key: `estimated-${cost.id}`,
      locked: true,
      estimated: true,
    }))
  return [...currentRows, ...estimated]
})

const totalCost = computed(() =>
  visibleDetails.value.reduce((sum, detail) => sum + Number(detail.costAmount || 0), 0),
)
const totalSale = computed(() =>
  visibleDetails.value.reduce((sum, detail) => sum + Number(detail.saleAmount || 0), 0),
)
const totalUtility = computed(() => totalSale.value - totalCost.value)
const margin = computed(() => calculateMargin(totalCost.value, totalSale.value))

const groups = computed(() => [
  {
    key: 'agent',
    title: 'Costos de agente',
    hint: 'No generan venta.',
    rows: visibleDetails.value.filter((detail) => detail.costDetailType === 'AgentCharge'),
  },
  {
    key: 'freight',
    title: 'Flete internacional',
    hint: 'Costo y venta marítima.',
    rows: visibleDetails.value.filter((detail) => detail.costDetailType === 'Freight'),
  },
  {
    key: 'destination',
    title: 'Costos de destino',
    hint: 'POE, POD y transporte interno.',
    rows: visibleDetails.value.filter((detail) =>
      ['DestinationCharge', 'InlandTransport'].includes(detail.costDetailType),
    ),
  },
  {
    key: 'other',
    title: 'Otros rubros',
    hint: 'Origen, documentación, seguro y adicionales.',
    rows: visibleDetails.value.filter(
      (detail) =>
        !['AgentCharge', 'Freight', 'DestinationCharge', 'InlandTransport'].includes(
          detail.costDetailType,
        ),
    ),
  },
])

watch(
  optionalCostIds,
  (ids) => {
    if (!initialized.value) return
    const selected = new Set(ids)

    for (const costId of ids) {
      if (!details.value.some((detail) => detail.costId === costId)) {
        const cost = availableCosts.value.find((item) => item.id === costId)
        if (cost) details.value.push(fromCost(cost))
      }
    }

    const removed = details.value.filter(
      (detail) => detail.costType === 'Optional' && detail.costId && !selected.has(detail.costId),
    )
    for (const detail of removed) if (detail.id) removedDetailIds.value.push(detail.id)
    details.value = details.value.filter(
      (detail) => detail.costType !== 'Optional' || !detail.costId || selected.has(detail.costId),
    )
  },
  { deep: true },
)

watch(
  () => form.currencyId,
  () => {
    const currency = selectedCurrency.value
    if (!currency) return
    for (const detail of details.value) {
      if (!detail.costId && !detail.locked && !detail.fixedDecisionCost) {
        detail.currencyId = currency.id
        detail.currencyName = currency.name
        detail.currencyCode = currency.code
      }
    }
  },
)

function fieldError(value: string, label: string) {
  return form.submitted && !value ? `Seleccione ${label}.` : undefined
}

function detailError(detail: EditableDetail) {
  if (!form.submitted) return ''
  if (!detail.name.trim()) return 'Indique el nombre del rubro.'
  if (!detail.currencyId) return 'Seleccione una moneda.'
  if (Number(detail.costAmount) < 0 || Number(detail.saleAmount) < 0)
    return 'Los montos no pueden ser negativos.'
  return ''
}

function mapDetail(detail: EditableDetail): CreateRateDetailRequest {
  const agentCost = detail.costDetailType === 'AgentCharge'
  return {
    costId: detail.costId ?? null,
    name: detail.name.trim(),
    costDetailType: detail.costDetailType,
    costType: detail.costType,
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    costAmount: Number(detail.costAmount || 0),
    saleAmount: agentCost ? 0 : Number(detail.saleAmount || 0),
    notes: detail.notes.trim() || null,
  }
}

function buildHeader() {
  const agent = catalogs.findById(catalogs.agents.value, form.agentId)
  const carrier = catalogs.findById(catalogs.carriers.value, form.carrierId)
  const pol = catalogs.findById(catalogs.polPorts.value, form.polId)
  const poe = catalogs.findById(catalogs.poePorts.value, form.poeId)
  const pod = catalogs.findById(catalogs.podPorts.value, form.podId)
  const container = catalogs.findById(catalogs.containerTypes.value, form.containerTypeId)
  const currency = catalogs.findById(catalogs.currencies.value, form.currencyId)

  if (!agent || !carrier || !pol || !poe || !pod || !container || !currency) return null

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentCode: agent.code,
    carrierId: carrier.id,
    carrierName: carrier.name,
    carrierCode: carrier.code,
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
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code,
    freeDays: Number(form.freeDays || 0),
    validFrom: form.validFrom,
    validTo: form.validTo,
    containerQuantity: Number(form.containerQuantity || 1),
    clientName: form.clientName.trim() || null,
    idtraNumber: form.idtraNumber.trim() || null,
    quoNumber: form.quoNumber.trim() || null,
    includes: form.includes.trim() || null,
    subjectTo: form.subjectTo.trim() || null,
    excludes: form.excludes.trim() || null,
    transitDays: form.transitDays.trim() ? Number(form.transitDays) : null,
  }
}

function validate() {
  form.submitted = true
  if (!buildHeader()) return false
  if (
    Number(form.freeDays) < 0 ||
    Number(form.containerQuantity) <= 0 ||
    (form.transitDays.trim() && Number(form.transitDays) < 0) ||
    !form.validFrom ||
    !form.validTo ||
    form.validTo < form.validFrom
  )
    return false
  const applicable = details.value.filter((detail) => !selectorsChanged.value || !detail.locked)
  if (!applicable.some((detail) => detail.costDetailType === 'Freight')) return false
  return applicable.every((detail) => !detailError(detail))
}

function updatePayloadFromRate(
  rate: RateDto,
  freightSale?: number,
  headerOverride?: NonNullable<ReturnType<typeof buildHeader>>,
): UpdateRateRequest {
  const extraDetails = rate.rateDetails.map((detail) => ({
    id: detail.id,
    costId: detail.costId,
    name: detail.name,
    costDetailType: detail.costDetailType,
    costType: detail.costType,
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    costAmount: detail.costAmount,
    saleAmount:
      detail.costDetailType === 'Freight' && freightSale !== undefined
        ? freightSale
        : detail.saleAmount,
    notes: detail.notes,
  }))

  const header = headerOverride ?? {
    agentId: rate.agentId!,
    agentName: rate.agentName!,
    agentCode: rate.agentCode!,
    carrierId: rate.carrierId!,
    carrierName: rate.carrierName!,
    carrierCode: rate.carrierCode!,
    polId: rate.polId,
    polName: rate.polName,
    polCode: rate.polCode,
    poeId: rate.poeId,
    poeName: rate.poeName,
    poeCode: rate.poeCode,
    podId: rate.podId,
    podName: rate.podName,
    podCode: rate.podCode,
    containerTypeId: rate.containerTypeId,
    containerTypeName: rate.containerTypeName,
    containerTypeCode: rate.containerTypeCode,
    currencyId: rate.currencyId,
    currencyName: rate.currencyName,
    currencyCode: rate.currencyCode,
    freeDays: rate.freeDays,
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    containerQuantity: rate.containerQuantity,
    clientName: rate.clientName ?? null,
    idtraNumber: rate.idtraNumber ?? null,
    quoNumber: rate.quoNumber ?? null,
    includes: rate.includes ?? null,
    subjectTo: rate.subjectTo ?? null,
    excludes: rate.excludes ?? null,
    transitDays: rate.transitDays ?? null,
  }

  return {
    ...header,
    extraDetails,
    removedExtraDetailIds: [],
  }
}

async function approveIfAllowed(rateId: string) {
  const result = await PricingService.getRate(rateId)
  if (result.status === 'PendingApproval' && canAutoApprove.value) {
    await PricingService.approveRateMargin(rateId)
    toastStore.success(
      'Tarifa guardada y aprobada',
      'Su permiso permitió aprobar automáticamente el margen inferior al 12%.',
    )
  } else if (result.status === 'PendingApproval') {
    toastStore.warning(
      'Tarifa pendiente de aprobación',
      'El margen actual es inferior al 12% y debe revisarlo una persona autorizada.',
    )
  } else {
    toastStore.success(
      isEditing.value ? 'Tarifa actualizada' : 'Tarifa creada',
      'Los totales y el margen se recalcularon correctamente.',
    )
  }
}

async function submit() {
  if (!validate()) return
  const header = buildHeader()!

  try {
    form.saving = true
    let rateId = props.rate?.id

    if (props.rate) {
      const payload: UpdateRateRequest = {
        ...header,
        extraDetails: details.value
          .filter(
            (detail) => !detail.importedFreight && (!selectorsChanged.value || !detail.locked),
          )
          .map((detail) => ({ ...mapDetail(detail), id: detail.id ?? null })),
        removedExtraDetailIds: [...new Set(removedDetailIds.value)],
      }
      await PricingService.updateRate(props.rate.id, payload)
    } else {
      const payload: CreateRateRequest = {
        sourceImportFclRateId: props.sourceImport?.id ?? null,
        ...header,
        details: details.value
          .filter((detail) => !detail.locked && !detail.importedFreight)
          .map(mapDetail),
      }
      rateId = await PricingService.createRate(payload)

      // Imported freight is created by Pricing from the source row. Apply the
      // sale entered by the user immediately through the supported update flow.
      const importedFreight = details.value.find((detail) => detail.importedFreight)
      if (importedFreight) {
        const created = await PricingService.getRate(rateId)
        await PricingService.updateRate(
          rateId,
          updatePayloadFromRate(created, Number(importedFreight.saleAmount || 0), header),
        )
      }
    }

    if (rateId) await approveIfAllowed(rateId)
    drawerStore.close()
    await props.onSaved?.(rateId)
  } catch (error) {
    toastStore.backendError(
      error,
      isEditing.value ? 'No se pudo actualizar la tarifa.' : 'No se pudo crear la tarifa.',
    )
  } finally {
    form.saving = false
  }
}

async function initialize() {
  await catalogs.loadAll()

  try {
    // Este endpoint usa pricing.cost.select, el mismo permiso necesario para
    // construir tarifas, y devuelve las notas operativas de costos fijos y opcionales.
    availableCosts.value = await loadOperationalCosts()
  } catch (error) {
    availableCosts.value = []
    toastStore.backendError(
      error,
      'No se pudieron cargar los costos ni sus notas operativas.',
    )
  }

  if (props.rate) {
    details.value = props.rate.rateDetails.map(fromRateDetail)
    optionalCostIds.value = props.rate.rateDetails
      .filter((detail) => detail.costType === 'Optional' && detail.costId)
      .map((detail) => detail.costId!)
  } else if (props.sourceImport) {
    const source = props.sourceImport
    const raw = source.rawDataJson ?? ''
    const agent = catalogs.findBestMatch(
      catalogs.agents.value,
      source.agentId,
      source.agent,
      source.agentCode,
      source.agentSlug,
      ...readRawValues(raw, ['agent', 'agente', 'client', 'cliente', 'customer']),
    )
    const carrier = catalogs.findBestMatch(
      catalogs.carriers.value,
      source.carrierId,
      source.carrier,
      source.carrierCode,
      source.carrierSlug,
      ...readRawValues(raw, ['carrier', 'carrierName', 'naviera', 'shippingLine']),
    )
    const pol = catalogs.findBestMatch(
      catalogs.polPorts.value,
      source.polId,
      source.pol,
      source.polCode,
      source.polSlug,
      ...readRawValues(raw, ['pol', 'origin', 'originPort', 'portOfLoading', 'puertoOrigen']),
    )
    const pod = catalogs.findBestMatch(
      catalogs.podPorts.value,
      source.podId,
      source.pod,
      source.podCode,
      source.podSlug,
      ...readRawValues(raw, [
        'pod',
        'destination',
        'destinationPort',
        'portOfDischarge',
        'puertoDestino',
      ]),
    )
    const poe = catalogs.findBestMatch(
      catalogs.poePorts.value,
      source.poeId,
      source.poe,
      source.poeCode,
      source.poeSlug,
      ...readRawValues(raw, [
        'poe',
        'entryPort',
        'portOfEntry',
        'puertoEntrada',
        'transshipmentPort',
      ]),
      source.pod,
      source.podCode,
    )
    const container = catalogs.findBestMatch(
      catalogs.containerTypes.value,
      source.containerTypeId,
      source.containerType,
      source.containerTypeCode,
      source.containerTypeSlug,
      ...readRawValues(raw, ['container', 'containerType', 'equipment', 'equipmentType', 'tamano']),
    )
    const currency = catalogs.findBestMatch(
      catalogs.currencies.value,
      source.currencyId,
      source.currency,
      source.currencyCode,
      source.currencySlug,
      ...readRawValues(raw, ['currency', 'currencyCode', 'moneda']),
    )

    form.agentId =
      agent?.id ??
      catalogs.findByCode(catalogs.agents.value, 'WWL')?.id ??
      catalogs.findByCode(catalogs.agents.value, 'RS')?.id ??
      ''
    form.carrierId = carrier?.id ?? ''
    form.polId = pol?.id ?? ''
    form.poeId = poe?.id ?? ''
    form.podId = pod?.id ?? ''
    form.containerTypeId = container?.id ?? ''
    form.currencyId =
      currency?.id ?? catalogs.findByCode(catalogs.currencies.value, 'USD')?.id ?? ''
    const importedDetails: EditableDetail[] = [
      {
        key: `import-freight-${props.sourceImport.id}`,
        name: 'Flete internacional',
        costDetailType: 'Freight',
        costType: 'Variable',
        currencyId: form.currencyId,
        currencyName: selectedCurrency.value?.name ?? props.sourceImport.currency,
        currencyCode: selectedCurrency.value?.code ?? props.sourceImport.currency,
        costAmount: String(props.sourceImport.freight),
        saleAmount: String(props.sourceImport.freight),
        notes: '',
        locked: false,
        importedFreight: true,
      },
    ]

    if ((props.decisionInternationalLandFreight ?? 0) > 0) {
      const usdCurrency =
        catalogs.findByCode(catalogs.currencies.value, 'USD') ?? selectedCurrency.value
      importedDetails.push({
        key: `decision-land-freight-${props.sourceImport.id}`,
        name: 'Flete terrestre internacional',
        costDetailType: 'InlandTransport',
        costType: 'Variable',
        currencyId: usdCurrency?.id ?? form.currencyId,
        currencyName: usdCurrency?.name ?? 'USD',
        currencyCode: usdCurrency?.code ?? 'USD',
        costAmount: String(props.decisionInternationalLandFreight),
        saleAmount: String(props.decisionInternationalLandFreight),
        notes: 'Valor fijo aplicado por selección de vía multimodal desde el dashboard.',
        locked: false,
        fixedDecisionCost: true,
      })
    }

    details.value = importedDetails
  } else {
    form.agentId =
      catalogs.findByCode(catalogs.agents.value, 'WWL')?.id ??
      catalogs.findByCode(catalogs.agents.value, 'RS')?.id ??
      ''
    addManualDetail('Freight')
  }

  initialized.value = true
}

onMounted(initialize)
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <section
      v-if="rate"
      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
    >
      <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
        Nombre de la tarifa
      </p>
      <p class="mt-1 text-lg font-black text-[var(--dh-text)]">
        {{ rate.rateName || rate.rateCode }}
      </p>
    </section>

    <section
      v-if="sourceImport"
      class="flex items-start gap-3 rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-4 text-blue-800 dark:text-blue-200"
    >
      <Info class="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p class="font-black">Creando desde tarifa importada</p>
        <p class="mt-1 text-sm font-semibold opacity-80">
          {{ sourceImport.carrier }} · {{ sourceImport.pol }} → {{ sourceImport.pod }} ·
          {{ sourceImport.containerType }}. El encabezado operativo proviene de la importación y no puede modificarse; los costos y ventas sí permanecen editables.
          <span v-if="decisionInternationalLandFreight">
            La vía multimodal ya incluye el costo terrestre fijo de
            {{ formatMoney(decisionInternationalLandFreight, 'USD') }}.
          </span>
        </p>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-center gap-3">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >1</span
        >
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Ruta y responsables</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            Todos los valores provienen de catálogos para evitar datos inconsistentes.
          </p>
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DhSelect
          v-model="form.agentId"
          :disabled="isHeaderLocked"
          label="Agente"
          placeholder="Seleccione agente"
          :options="catalogs.agentOptions.value"
          :error="fieldError(form.agentId, 'el agente')"
        />
        <DhSelect
          v-model="form.carrierId"
          :disabled="isHeaderLocked"
          label="Naviera"
          placeholder="Seleccione naviera"
          :options="catalogs.carrierOptions.value"
          :error="fieldError(form.carrierId, 'la naviera')"
        />
        <DhSelect
          v-model="form.containerTypeId"
          :disabled="isHeaderLocked"
          label="Contenedor"
          placeholder="Seleccione contenedor"
          :options="catalogs.containerOptions.value"
          :error="fieldError(form.containerTypeId, 'el contenedor')"
        />
        <DhSelect
          v-model="form.polId"
          :disabled="isHeaderLocked"
          label="POL · Origen"
          placeholder="Seleccione POL"
          :options="catalogs.polOptions.value"
          :error="fieldError(form.polId, 'el POL')"
        />
        <DhSelect
          v-model="form.poeId"
          :disabled="isHeaderLocked"
          label="POE · Entrada"
          placeholder="Seleccione POE"
          :options="catalogs.poeOptions.value"
          :error="fieldError(form.poeId, 'el POE')"
        />
        <DhSelect
          v-model="form.podId"
          :disabled="isHeaderLocked"
          label="POD · Destino final"
          placeholder="Seleccione POD"
          :options="catalogs.podOptions.value"
          :error="fieldError(form.podId, 'el POD')"
        />
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-center gap-3">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >2</span
        >
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Vigencia y moneda</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            La vigencia se valida antes de enviar la tarifa.
          </p>
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DhSelect
          v-model="form.currencyId"
          :disabled="isHeaderLocked"
          label="Moneda"
          placeholder="Seleccione moneda"
          :options="catalogs.currencyOptions.value"
          :error="fieldError(form.currencyId, 'la moneda')"
        />
        <DhInput
          v-model="form.freeDays"
          :disabled="isHeaderLocked"
          type="number"
          label="Días libres"
          :error="
            form.submitted && Number(form.freeDays) < 0 ? 'No puede ser negativo.' : undefined
          "
        />
        <DhInput
          v-model="form.validFrom"
          :disabled="isHeaderLocked"
          type="date"
          label="Válida desde"
          :error="form.submitted && !form.validFrom ? 'Indique la fecha.' : undefined"
        />
        <DhInput
          v-model="form.validTo"
          :disabled="isHeaderLocked"
          type="date"
          label="Válida hasta"
          :error="
            form.submitted && (!form.validTo || form.validTo < form.validFrom)
              ? 'Revise el rango.'
              : undefined
          "
        />
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-center gap-3">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >3</span
        >
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Datos y condiciones comerciales</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            Identificadores del cliente y condiciones que se mostrarán en la cotización.
          </p>
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DhInput v-model="form.clientName" label="Cliente" placeholder="Nombre del cliente" />
        <DhInput v-model="form.idtraNumber" label="Número IDTRA" placeholder="IDTRA-..." />
        <DhInput v-model="form.quoNumber" label="Número QUO" placeholder="QUO-..." />
        <DhInput
          v-model="form.containerQuantity"
          type="number"
          min="1"
          label="Cantidad de contenedores"
          :disabled="isHeaderLocked"
          :error="form.submitted && Number(form.containerQuantity) <= 0 ? 'Debe ser mayor a cero.' : undefined"
        />
        <DhInput
          v-model="form.transitDays"
          :disabled="isHeaderLocked"
          type="number"
          min="0"
          label="Tiempo de tránsito (días)"
          :error="form.submitted && form.transitDays && Number(form.transitDays) < 0 ? 'No puede ser negativo.' : undefined"
        />
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <DhTextarea v-model="form.includes" label="Tarifa incluye" :rows="4" />
        <DhTextarea v-model="form.subjectTo" label="Sujeto a" :rows="4" />
        <DhTextarea v-model="form.excludes" label="No incluye" :rows="4" />
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-center gap-3">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >4</span
        >
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Construcción de la tarifa</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            Costo, venta y utilidad visibles por rubro.
          </p>
        </div>
        <DhButton
          label="Rubro manual"
          :icon="Plus"
          variant="secondary"
          size="sm"
          @click="addManualDetail()"
        />
      </div>

      <div class="mt-5 space-y-4">
        <section
          v-for="group in groups"
          :key="group.key"
          class="overflow-hidden rounded-[24px] border border-[var(--dh-border)]"
        >
          <header
            class="flex items-center justify-between bg-black/[0.035] px-4 py-3 dark:bg-white/[0.05]"
          >
            <div>
              <h4 class="text-sm font-black text-[var(--dh-text)]">{{ group.title }}</h4>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ group.hint }}</p>
            </div>
            <DhBadge :label="String(group.rows.length)" variant="neutral" />
          </header>
          <div v-if="group.rows.length" class="divide-y divide-[var(--dh-border)]">
            <article v-for="detail in group.rows" :key="detail.key" class="p-4">
              <div class="grid gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto] xl:items-start">
                <div>
                  <DhInput
                    v-model="detail.name"
                    label="Concepto"
                    placeholder="Nombre del rubro"
                    :disabled="detail.locked || Boolean(detail.costId) || detail.fixedDecisionCost"
                  />
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <DhBadge
                      :label="detail.costType"
                      :variant="
                        detail.locked
                          ? 'neutral'
                          : detail.costType === 'Optional'
                            ? 'primary'
                            : 'warning'
                      "
                    />
                    <DhBadge v-if="detail.locked" label="Automático" variant="neutral"
                      ><LockKeyhole class="mr-1 h-3 w-3" /> Automático</DhBadge
                    >
                    <DhBadge
                      v-if="detail.fixedDecisionCost"
                      label="Valor fijo del dashboard"
                      variant="primary"
                    />
                  </div>
                  <p
                    v-if="detail.notes.trim()"
                    class="mt-2 rounded-xl bg-black/[0.035] px-3 py-2 text-xs font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.05]"
                  >
                    <span class="font-black text-[var(--dh-text-soft)]">Nota operativa:</span>
                    <span class="whitespace-pre-line">{{ detail.notes }}</span>
                  </p>
                </div>
                <DhSelect
                  v-model="detail.costDetailType"
                  label="Rubro"
                  :options="detailTypeOptions"
                  :disabled="detail.locked || Boolean(detail.costId) || detail.fixedDecisionCost"
                />
                <DhInput
                  v-model="detail.costAmount"
                  type="number"
                  label="Costo"
                  placeholder="0.00"
                  :disabled="detail.importedFreight || detail.estimated || detail.fixedDecisionCost"
                />
                <DhInput
                  v-model="detail.saleAmount"
                  type="number"
                  label="Venta"
                  placeholder="0.00"
                  :disabled="detail.costDetailType === 'AgentCharge' || detail.estimated"
                />
                <button
                  v-if="!detail.locked && !detail.importedFreight && !detail.fixedDecisionCost"
                  type="button"
                  class="mt-6 rounded-2xl p-2.5 text-red-500 transition hover:bg-red-500/10"
                  title="Quitar rubro"
                  @click="removeDetail(detail)"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <div
                v-if="!detail.costId && !detail.locked && !detail.fixedDecisionCost"
                class="mt-3 grid gap-3 md:grid-cols-[180px_1fr]"
              >
                <DhSelect
                  v-model="detail.costType"
                  label="Aplicación"
                  :options="editableTypeOptions"
                />
                <DhTextarea v-model="detail.notes" label="Notas" :rows="2" />
              </div>
              <p v-if="detailError(detail)" class="mt-2 text-xs font-semibold text-red-500">
                {{ detailError(detail) }}
              </p>
            </article>
          </div>
          <p v-else class="px-4 py-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
            Sin rubros en esta sección.
          </p>
        </section>
      </div>

      <div class="mt-6 border-t border-[var(--dh-border)] pt-5">
        <PricingMultiSelect
          v-model="optionalCostIds"
          :options="optionalOptions"
          label="Costos opcionales"
          placeholder="Seleccione costos opcionales"
        />
      </div>
    </section>

    <section
      class="sticky bottom-0 z-20 rounded-[28px] border border-[var(--dh-border-strong)] bg-[var(--dh-shell-strong)] p-4 shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl"
    >
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Costo total
          </p>
          <p class="mt-1 text-lg font-black text-[var(--dh-text)]">
            {{ formatMoney(totalCost, currencyName) }}
          </p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Venta total
          </p>
          <p class="mt-1 text-lg font-black text-[var(--dh-text)]">
            {{ formatMoney(totalSale, currencyName) }}
          </p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Utilidad general
          </p>
          <p
            class="mt-1 text-lg font-black"
            :class="totalUtility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'"
          >
            {{ formatMoney(totalUtility, currencyName) }}
          </p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Margen actual / esperado
          </p>
          <p
            class="mt-1 text-lg font-black"
            :class="
              margin >= 12
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            "
          >
            {{ margin.toFixed(2) }}% / 12%
          </p>
        </div>
      </div>

      <div
        v-if="margin < 12 && totalSale > 0"
        class="mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200"
      >
        <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
        <span
          >La venta mínima sugerida para alcanzar 12% es
          {{ formatMoney(minimumSale(totalCost), currencyName) }}.
          {{
            canAutoApprove
              ? 'Su permiso aprobará automáticamente si decide guardar así.'
              : 'La tarifa quedará pendiente de aprobación.'
          }}</span
        >
      </div>

      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <DhButton
          label="Cancelar"
          variant="secondary"
          :disabled="form.saving"
          @click="drawerStore.close()"
        />
        <DhButton
          :label="isEditing ? 'Guardar cambios' : 'Crear tarifa'"
          :icon="isEditing ? Save : Ship"
          type="submit"
          :loading="form.saving"
        />
      </div>
    </section>
  </form>
</template>
