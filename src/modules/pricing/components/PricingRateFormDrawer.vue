<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  AlertTriangle,
  ChevronDown,
  Info,
  LockKeyhole,
  Plus,
  Save,
  Ship,
  Trash2,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import { isConnectionFailure, queueRateCreate, queueRateUpdate } from '@/core/offline/pricingOfflineQueue'
import type {
  ChargeBasis,
  CostDetailType,
  CostSelectDto,
  CostType,
  CreateRateContainerRequest,
  CreateRateDetailRequest,
  CreateRateRequest,
  ImportRateDto,
  RateCargoLineRequest,
  RateDetailDto,
  RateDto,
  ShipmentMode,
  RateType,
  RateTermItemDto,
  RateTermBlockDto,
  CarrierFreeDayRuleDto,
  UpdateRateRequest,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingMultiSelect, { type PricingMultiSelectOption } from './PricingMultiSelect.vue'
import PricingTermDragBoard, { type PricingTermBoardColumn } from './PricingTermDragBoard.vue'
import { createUuid } from '@/core/utils/id'
import {
  calculateMargin,
  formatMoney,
  minimumSale,
  rateDisplayName,
  toDateInput,
} from '@/modules/pricing/utils/pricingFormat'

interface EditableDetail {
  key: string
  id?: string | null
  costId?: string | null
  name: string
  costDetailType: CostDetailType
  costType: CostType
  chargeBasis: ChargeBasis
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: string
  saleAmount: string
  notes: string
  isAccountant: boolean
  locked: boolean
  importedFreight?: boolean
  estimated?: boolean
  fixedDecisionCost?: boolean
  insuranceGenerated?: boolean
  automaticFixed?: boolean
  exwGenerated?: boolean
  quantity?: number
  minimumCostAmount?: number | null
  minimumSaleAmount?: number | null
  kgPerCbm?: number | null
}

interface EditableContainerAllocation {
  key: string
  containerTypeId: string
  quantity: string
  freightCostAmount: string
  freightSaleAmount: string
  freightDetailId?: string | null
}

interface EditableCargoLine {
  key: string
  description: string
  packages: string
  pallets: string
  weightKg: string
  lengthCm: string
  widthCm: string
  heightCm: string
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
const editingDisplayName = computed(() =>
  props.rate ? rateDisplayName(catalogs.resolveRateLabels(props.rate)) : '',
)
const availableCosts = ref<CostSelectDto[]>([])
const rateTermItems = ref<RateTermItemDto[]>([])
const includesTermIds = ref<string[]>([])
const subjectToTermIds = ref<string[]>([])
const excludesTermIds = ref<string[]>([])
const resolvedTermBlocks = ref<RateTermBlockDto[]>([])
const autoTermIds = ref<string[]>([])
const carrierFreeDayRule = ref<CarrierFreeDayRuleDto | null>(null)
const loadingFreeDays = ref(false)
const details = ref<EditableDetail[]>([])
const containerAllocations = ref<EditableContainerAllocation[]>([])
const cargoLines = ref<EditableCargoLine[]>([])
const optionalCostIds = ref<string[]>([])
const removedDetailIds = ref<string[]>([])
const initialized = ref(false)
const canEditImportedAgent = ref(false)
const canEditImportedPoe = ref(false)
const canEditImportedPod = ref(false)
const collapsedStages = reactive<Record<1 | 2 | 3 | 4, boolean>>({
  1: false,
  2: false,
  3: false,
  4: false,
})

function toggleStage(stage: 1 | 2 | 3 | 4) {
  collapsedStages[stage] = !collapsedStages[stage]
}

const today = new Date()
const nextMonth = new Date(today)
nextMonth.setDate(nextMonth.getDate() + 30)
const dateValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const form = reactive({
  shipmentMode: (props.rate?.shipmentMode ?? 'Fcl') as ShipmentMode,
  rateType: (props.rate?.rateType ?? 'Tariff') as RateType,
  kgPerCbm: String(props.rate?.kgPerCbm ?? (props.rate?.shipmentMode === 'Ltl' ? 333 : 500)),
  agentId: props.rate?.agentId ?? '',
  carrierId: props.rate?.carrierId ?? '',
  polId: props.rate?.polId ?? '',
  poeId: props.rate?.poeId ?? '',
  podId: props.rate?.podId ?? '',
  containerTypeId: props.rate?.containerTypeId ?? '',
  incotermId: props.rate?.incotermId ?? '',
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
  transitTime:
    props.rate?.transitTime ??
    (props.sourceImport?.transitDays != null ? `${props.sourceImport.transitDays} días` : ''),
  cargoValue: '',
  insurancePercentage: '0.65',
  insuranceMinimumAmount: '95',
  insuranceAmount: '95',
  manualInsurancePercentage: false,
  manualInsuranceMinimum: false,
  manualInsuranceAmount: false,
  submitted: false,
  saving: false,
})


const draftStorageKey = computed(() =>
  props.rate?.id
    ? `dhole.pricing.rate-draft.${props.rate.id}`
    : props.sourceImport?.id
      ? `dhole.pricing.rate-draft.import.${props.sourceImport.id}`
      : 'dhole.pricing.rate-draft.new',
)
let draftTimer: number | null = null
let restoringDraft = false

function clearDraft() {
  localStorage.removeItem(draftStorageKey.value)
}

function persistDraft() {
  if (!initialized.value || restoringDraft) return
  const snapshot = {
    savedAt: new Date().toISOString(),
    form: { ...form, submitted: false, saving: false },
    details: details.value,
    containerAllocations: containerAllocations.value,
    cargoLines: cargoLines.value,
    optionalCostIds: optionalCostIds.value,
    removedDetailIds: removedDetailIds.value,
    includesTermIds: includesTermIds.value,
    subjectToTermIds: subjectToTermIds.value,
    excludesTermIds: excludesTermIds.value,
  }
  localStorage.setItem(draftStorageKey.value, JSON.stringify(snapshot))
}

function scheduleDraftSave() {
  if (!initialized.value || restoringDraft) return
  if (draftTimer !== null) window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(() => {
    draftTimer = null
    persistDraft()
  }, 500)
}

function restoreDraftIfAvailable() {
  const raw = localStorage.getItem(draftStorageKey.value)
  if (!raw) return false
  try {
    const draft = JSON.parse(raw) as Record<string, any>
    if (!draft?.savedAt || Date.now() - new Date(draft.savedAt).getTime() > 7 * 24 * 60 * 60 * 1000) {
      clearDraft()
      return false
    }
    restoringDraft = true
    if (draft.form) Object.assign(form, draft.form, { submitted: false, saving: false })
    if (Array.isArray(draft.details)) details.value = draft.details
    if (Array.isArray(draft.containerAllocations)) containerAllocations.value = draft.containerAllocations
    if (Array.isArray(draft.cargoLines)) cargoLines.value = draft.cargoLines
    if (Array.isArray(draft.optionalCostIds)) optionalCostIds.value = draft.optionalCostIds
    if (Array.isArray(draft.removedDetailIds)) removedDetailIds.value = draft.removedDetailIds
    if (Array.isArray(draft.includesTermIds)) includesTermIds.value = draft.includesTermIds
    if (Array.isArray(draft.subjectToTermIds)) subjectToTermIds.value = draft.subjectToTermIds
    if (Array.isArray(draft.excludesTermIds)) excludesTermIds.value = draft.excludesTermIds
    toastStore.info('Borrador recuperado', 'Se restauraron los cambios que estaban guardados en este navegador.')
    return true
  } catch {
    clearDraft()
    return false
  } finally {
    restoringDraft = false
  }
}

const isEditing = computed(() => Boolean(props.rate))
const isCreatingFromImport = computed(() => Boolean(props.sourceImport && !props.rate))
const isHeaderLocked = computed(() => isCreatingFromImport.value)
const isContainerMixLocked = computed(
  () => isCreatingFromImport.value || Boolean(props.rate?.sourceImportFclRateId),
)
const isFcl = computed(() => form.shipmentMode === 'Fcl')
const isLcl = computed(() => form.shipmentMode === 'Lcl')
const isFtl = computed(() => form.shipmentMode === 'Ftl')
const isLtl = computed(() => form.shipmentMode === 'Ltl')
const isConsolidated = computed(() => isLcl.value || isLtl.value)
const usesContainerFreight = computed(() => isFcl.value && !isContainerMixLocked.value)
const isAgentLocked = computed(() => isCreatingFromImport.value && !canEditImportedAgent.value)
const isPoeLocked = computed(() => isCreatingFromImport.value && !canEditImportedPoe.value)
const isPodLocked = computed(() => isCreatingFromImport.value && !canEditImportedPod.value)
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

const rateTermColumns: PricingTermBoardColumn[] = [
  {
    key: 'includes',
    label: 'Tarifa incluye',
    hint: 'Servicios y condiciones que sí forman parte de la tarifa.',
  },
  {
    key: 'subjectTo',
    label: 'Sujeto a',
    hint: 'Condiciones bajo las cuales aplica la tarifa.',
  },
  {
    key: 'excludes',
    label: 'Tarifa no incluye',
    hint: 'Conceptos expresamente excluidos de la cotización.',
  },
]

const rateTermBoardValue = computed<Record<string, string[]>>({
  get: () => ({
    includes: [...includesTermIds.value],
    subjectTo: [...subjectToTermIds.value],
    excludes: [...excludesTermIds.value],
  }),
  set: (value) => {
    const includes = [...new Set(value.includes ?? [])]
    const includeSet = new Set(includes)
    const subjectTo = [...new Set(value.subjectTo ?? [])].filter((id) => !includeSet.has(id))
    const subjectSet = new Set(subjectTo)
    const excludes = [...new Set(value.excludes ?? [])].filter(
      (id) => !includeSet.has(id) && !subjectSet.has(id),
    )

    includesTermIds.value = includes
    subjectToTermIds.value = subjectTo
    excludesTermIds.value = excludes
  },
})

const allocatedContainerQuantity = computed(() =>
  containerAllocations.value.reduce(
    (total, item) => total + Math.max(0, Number(item.quantity || 0)),
    0,
  ),
)

const requestedContainerQuantity = computed(() =>
  containerAllocations.value.length <= 1
    ? Math.max(0, Number(form.containerQuantity || 0))
    : allocatedContainerQuantity.value,
)

function distributeContainerQuantities(total: number, allocations = containerAllocations.value) {
  if (!allocations.length) return

  const normalizedTotal = Math.max(allocations.length, Math.trunc(Number(total) || 0))
  const base = Math.floor(normalizedTotal / allocations.length)
  const remainder = normalizedTotal % allocations.length

  allocations.forEach((allocation, index) => {
    allocation.quantity = String(base + (index < remainder ? 1 : 0))
  })

  form.containerQuantity = String(normalizedTotal)
}

function emptyCargoLine(): EditableCargoLine {
  return {
    key: createUuid(),
    description: '',
    packages: '1',
    pallets: '0',
    weightKg: '0',
    lengthCm: '0',
    widthCm: '0',
    heightCm: '0',
  }
}

function addCargoLine() {
  cargoLines.value.push(emptyCargoLine())
}

function removeCargoLine(key: string) {
  if (cargoLines.value.length <= 1) return
  cargoLines.value = cargoLines.value.filter((line) => line.key !== key)
}

function hydrateCargoLines() {
  if (props.rate?.cargoLines?.length) {
    cargoLines.value = props.rate.cargoLines.map((line) => ({
      key: createUuid(),
      description: line.description ?? '',
      packages: String(line.packages ?? 0),
      pallets: String(line.pallets ?? 0),
      weightKg: String(line.weightKg ?? 0),
      lengthCm: String(line.lengthCm ?? 0),
      widthCm: String(line.widthCm ?? 0),
      heightCm: String(line.heightCm ?? 0),
    }))
  } else if (isConsolidated.value) {
    cargoLines.value = [emptyCargoLine()]
  }
}

function cargoLineVolume(line: EditableCargoLine) {
  const packages = Math.max(1, Number(line.packages || 0))
  const length = Math.max(0, Number(line.lengthCm || 0))
  const width = Math.max(0, Number(line.widthCm || 0))
  const height = Math.max(0, Number(line.heightCm || 0))
  return (length * width * height * packages) / 1_000_000
}

const totalPackages = computed(() =>
  cargoLines.value.reduce((sum, line) => sum + Math.max(0, Number(line.packages || 0)), 0),
)
const totalPallets = computed(() =>
  cargoLines.value.reduce((sum, line) => sum + Math.max(0, Number(line.pallets || 0)), 0),
)
const totalWeightKg = computed(() =>
  cargoLines.value.reduce((sum, line) => sum + Math.max(0, Number(line.weightKg || 0)), 0),
)
const totalVolumeCbm = computed(() =>
  cargoLines.value.reduce((sum, line) => sum + cargoLineVolume(line), 0),
)
const effectiveKgPerCbm = computed(() => Math.max(0, Number(form.kgPerCbm || 0)))
const weightEquivalentCbm = computed(() =>
  effectiveKgPerCbm.value > 0 ? totalWeightKg.value / effectiveKgPerCbm.value : 0,
)
const chargeableCbm = computed(() => Math.max(totalVolumeCbm.value, weightEquivalentCbm.value))

function cargoLineRequests(): RateCargoLineRequest[] {
  if (!isConsolidated.value) return []
  return cargoLines.value.map((line) => ({
    description: line.description.trim() || null,
    packages: Math.max(0, Math.trunc(Number(line.packages || 0))),
    pallets: Math.max(0, Math.trunc(Number(line.pallets || 0))),
    weightKg: Math.max(0, Number(line.weightKg || 0)),
    lengthCm: Math.max(0, Number(line.lengthCm || 0)),
    widthCm: Math.max(0, Number(line.widthCm || 0)),
    heightCm: Math.max(0, Number(line.heightCm || 0)),
  }))
}

const containerAllocationError = computed(() => {
  if (!form.submitted || !isFcl.value) return undefined
  if (requestedContainerQuantity.value <= 0) return 'La cantidad total debe ser mayor a cero.'
  if (containerAllocations.value.length === 0) return 'Agregue al menos un tipo de contenedor.'
  if (containerAllocations.value.some((item) => !item.containerTypeId)) {
    return 'Seleccione el tipo de todos los contenedores.'
  }
  if (containerAllocations.value.some((item) => Number(item.quantity || 0) <= 0)) {
    return 'Cada tipo debe tener una cantidad mayor a cero.'
  }
  const ids = containerAllocations.value.map((item) => item.containerTypeId)
  if (new Set(ids).size !== ids.length) return 'No repita el mismo tipo de contenedor.'
  if (usesContainerFreight.value) {
    if (containerAllocations.value.some((item) => item.freightCostAmount.trim() === '')) {
      return 'Indique el costo de flete para cada tipo de contenedor.'
    }
    if (containerAllocations.value.some((item) => item.freightSaleAmount.trim() === '')) {
      return 'Indique la venta de flete para cada tipo de contenedor.'
    }
    if (
      containerAllocations.value.some(
        (item) => Number(item.freightCostAmount) < 0 || Number(item.freightSaleAmount) < 0,
      )
    ) {
      return 'Los montos de flete no pueden ser negativos.'
    }
  }
  return undefined
})

function containerOptionsFor(rowKey: string) {
  const selectedByOtherRows = new Set(
    containerAllocations.value
      .filter((item) => item.key !== rowKey)
      .map((item) => item.containerTypeId)
      .filter(Boolean),
  )
  return catalogs.containerOptions.value.filter((option) => !selectedByOtherRows.has(option.value))
}

function addContainerAllocation() {
  if (
    isContainerMixLocked.value ||
    containerAllocations.value.some((item) => !item.containerTypeId)
  )
    return

  const selected = new Set(
    containerAllocations.value.map((item) => item.containerTypeId).filter(Boolean),
  )
  const next = catalogs.containerOptions.value.find((option) => !selected.has(option.value))
  if (!next) return

  const totalBeforeAdding = Math.max(
    1,
    Number(form.containerQuantity || allocatedContainerQuantity.value || 1),
  )

  containerAllocations.value.push({
    key: createUuid(),
    containerTypeId: next.value,
    quantity: '1',
    freightCostAmount: '',
    freightSaleAmount: '',
    freightDetailId: null,
  })

  // Reparte automáticamente el total entre todos los tipos. Ej.:
  // 4 contenedores / 2 tipos => 2 + 2; 5 / 2 => 3 + 2.
  // Si el total es menor que la cantidad de tipos, se eleva al mínimo para
  // garantizar al menos una unidad por cada tipo seleccionado.
  distributeContainerQuantities(totalBeforeAdding)
}

function removeContainerAllocation(key: string) {
  if (isContainerMixLocked.value || containerAllocations.value.length <= 1) return
  const index = containerAllocations.value.findIndex((item) => item.key === key)
  if (index < 0) return

  const totalBeforeRemoving = Math.max(1, allocatedContainerQuantity.value)
  const freightDetailId = containerAllocations.value[index]?.freightDetailId
  if (freightDetailId) removedDetailIds.value.push(freightDetailId)
  containerAllocations.value.splice(index, 1)

  // Mantiene el total y vuelve a repartirlo entre los tipos restantes.
  distributeContainerQuantities(totalBeforeRemoving)
}

function resolveContainerRequests(): CreateRateContainerRequest[] | null {
  if (!isFcl.value) return []
  if (containerAllocations.value.length === 0) return null

  const result: CreateRateContainerRequest[] = []
  for (const allocation of containerAllocations.value) {
    const container = catalogs.findById(catalogs.containerTypes.value, allocation.containerTypeId)
    const quantity = Number(allocation.quantity || 0)
    if (!container || quantity <= 0) return null
    result.push({
      containerTypeId: container.id,
      containerTypeName: container.name,
      containerTypeCode: container.code,
      quantity,
    })
  }

  if (new Set(result.map((item) => item.containerTypeId)).size !== result.length) return null
  return result
}

function findFreightDetailForContainer(
  containerTypeName: string,
  containerTypeCode: string,
  index: number,
) {
  const freight = props.rate?.rateDetails.filter((item) => item.costDetailType === 'Freight') ?? []
  const name = normalizeKey(containerTypeName)
  const code = normalizeKey(containerTypeCode)
  const matched = freight.find((item) => {
    const detailName = normalizeKey(item.name)
    return (name && detailName.includes(name)) || (code && detailName.includes(code))
  })
  if (matched) return matched
  if (freight.length === 1 && (props.rate?.containers?.length ?? 1) === 1) return freight[0]
  return freight[index]
}

function hydrateContainerAllocations() {
  const existing = props.rate?.containers?.filter((item) => item.quantity > 0) ?? []
  if (existing.length > 0) {
    containerAllocations.value = existing.map((item, index) => {
      const freight = findFreightDetailForContainer(
        item.containerTypeName,
        item.containerTypeCode,
        index,
      )
      return {
        key: item.id || createUuid(),
        containerTypeId: item.containerTypeId,
        quantity: String(item.quantity),
        freightCostAmount: freight ? String(freight.costAmount) : '',
        freightSaleAmount: freight ? String(freight.saleAmount) : '',
        freightDetailId: freight?.id ?? null,
      }
    })
    form.containerQuantity = String(existing.reduce((sum, item) => sum + item.quantity, 0))
    form.containerTypeId = existing[0]?.containerTypeId ?? form.containerTypeId
    return
  }

  const fallbackFreight = props.rate?.rateDetails.find((item) => item.costDetailType === 'Freight')
  const importedFreightCost = props.sourceImport?.oceanFreight ?? props.sourceImport?.freight
  const importedFreightSale =
    props.sourceImport?.totalSale ?? props.sourceImport?.oceanFreight ?? props.sourceImport?.freight

  containerAllocations.value = [
    {
      key: createUuid(),
      containerTypeId: form.containerTypeId,
      quantity: String(Math.max(1, Number(form.containerQuantity || 1))),
      freightCostAmount: String(fallbackFreight?.costAmount ?? importedFreightCost ?? ''),
      freightSaleAmount: String(fallbackFreight?.saleAmount ?? importedFreightSale ?? ''),
      freightDetailId: fallbackFreight?.id ?? null,
    },
  ]
}

watch(
  () => form.containerQuantity,
  (value) => {
    const quantity = Math.max(1, Number(value || 1))
    if (containerAllocations.value.length === 1) {
      containerAllocations.value[0]!.quantity = String(quantity)
    }
  },
)

watch(
  containerAllocations,
  (value) => {
    form.containerTypeId = value[0]?.containerTypeId ?? ''
    if (value.length > 1) {
      form.containerQuantity = String(
        value.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
      )
    }
  },
  { deep: true },
)

const defaultInsurancePercentage = 0.65
const defaultInsuranceMinimumAmount = 95
const insuranceCostPercentage = 0.2
const insuranceCostMinimumAmount = 35

function selectedTermText(ids: string[]) {
  return ids
    .map((id) => rateTermItems.value.find((item) => item.id === id)?.text)
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join('\n')
}

function hydrateTermSelection(
  value: string,
  target: { value: string[] },
  alreadyAssigned: Set<string>,
) {
  let remainder = value ?? ''
  const selected: string[] = []
  for (const item of rateTermItems.value) {
    if (alreadyAssigned.has(item.id) || !item.text.trim()) continue
    if (!remainder.toLocaleLowerCase().includes(item.text.trim().toLocaleLowerCase())) continue
    selected.push(item.id)
    alreadyAssigned.add(item.id)
    remainder = remainder
      .replace(item.text, '')
      .replace(/\n{2,}/g, '\n')
      .trim()
  }
  target.value = selected
  return remainder
}

function removeAutomaticTermSelections() {
  if (!autoTermIds.value.length) return
  const previous = new Set(autoTermIds.value)
  includesTermIds.value = includesTermIds.value.filter((id) => !previous.has(id))
  subjectToTermIds.value = subjectToTermIds.value.filter((id) => !previous.has(id))
  excludesTermIds.value = excludesTermIds.value.filter((id) => !previous.has(id))
  autoTermIds.value = []
}

async function loadAutomaticTermBlocks(applySelections = true) {
  try {
    const blocks = await PricingService.resolveRateTermBlocks({
      rateType: form.rateType,
      shipmentMode: form.shipmentMode,
      poeId: form.poeId || undefined,
      incotermId: form.incotermId || undefined,
    })
    resolvedTermBlocks.value = blocks
    if (!applySelections) return

    removeAutomaticTermSelections()
    const assigned = new Set([
      ...includesTermIds.value,
      ...subjectToTermIds.value,
      ...excludesTermIds.value,
    ])
    const added: string[] = []

    for (const block of blocks) {
      for (const item of block.items) {
        if (
          item.category !== 'Includes' &&
          item.category !== 'SubjectTo' &&
          item.category !== 'Excludes'
        )
          continue
        if (assigned.has(item.rateTermItemId)) continue
        assigned.add(item.rateTermItemId)
        added.push(item.rateTermItemId)
        if (item.category === 'Includes') includesTermIds.value.push(item.rateTermItemId)
        else if (item.category === 'SubjectTo') subjectToTermIds.value.push(item.rateTermItemId)
        else excludesTermIds.value.push(item.rateTermItemId)
      }
    }
    autoTermIds.value = added
  } catch (error) {
    resolvedTermBlocks.value = []
    console.error('No se pudieron resolver los bloques tarifarios automáticos.', error)
  }
}

async function resolveCarrierFreeDays() {
  if (!form.carrierId) {
    carrierFreeDayRule.value = null
    if (!props.sourceImport) form.freeDays = '0'
    return
  }

  try {
    loadingFreeDays.value = true
    carrierFreeDayRule.value = await PricingService.resolveCarrierFreeDayRule(form.carrierId)
    if (carrierFreeDayRule.value) form.freeDays = String(carrierFreeDayRule.value.freeDays)
    else if (props.sourceImport?.freeDays != null)
      form.freeDays = String(props.sourceImport.freeDays)
    else form.freeDays = '0'
  } catch (error) {
    carrierFreeDayRule.value = null
    toastStore.backendError(error, 'No se pudieron resolver los días libres de la naviera.')
  } finally {
    loadingFreeDays.value = false
  }
}

const missingSelectableImportedFields = computed(() => {
  if (!isCreatingFromImport.value) return []

  return [
    canEditImportedAgent.value && !form.agentId ? 'Agente' : '',
    canEditImportedPoe.value && !form.poeId ? 'POE' : '',
    canEditImportedPod.value && !form.podId ? 'POD' : '',
  ].filter(Boolean)
})

const unresolvedLockedImportedFields = computed(() => {
  if (!isCreatingFromImport.value) return []

  return [
    !form.carrierId ? 'Naviera' : '',
    !form.polId ? 'POL' : '',
    !canEditImportedPoe.value && !form.poeId ? 'POE' : '',
    !form.containerTypeId ? 'Contenedor' : '',
    !form.currencyId ? 'Moneda' : '',
  ].filter(Boolean)
})

const shipmentModeOptions: Array<{ label: string; value: ShipmentMode }> = [
  { label: 'FCL · Contenedor completo', value: 'Fcl' },
  { label: 'LCL · Marítimo consolidado', value: 'Lcl' },
  { label: 'FTL · Camión completo', value: 'Ftl' },
  { label: 'LTL · Terrestre consolidado', value: 'Ltl' },
]

const chargeBasisOptions: Array<{ label: string; value: ChargeBasis }> = [
  { label: 'Por embarque', value: 'PerShipment' },
  { label: 'Por contenedor', value: 'PerContainer' },
  { label: 'Por camión', value: 'PerTruck' },
  { label: 'Por CBM', value: 'PerCbm' },
  { label: 'Por CBM cobrable', value: 'PerChargeableCbm' },
  { label: 'Por KG', value: 'PerKg' },
  { label: 'Por 100 KG', value: 'Per100Kg' },
  { label: 'Por tonelada', value: 'PerTon' },
  { label: 'Por pallet', value: 'PerPallet' },
  { label: 'Por bulto', value: 'PerPackage' },
  { label: 'Por BL / documento', value: 'PerDocument' },
]

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

const selectableDetailTypeOptions = computed(() =>
  usesContainerFreight.value
    ? detailTypeOptions.filter((option) => option.value !== 'Freight')
    : detailTypeOptions,
)

const editableTypeOptions = [
  { label: 'Variable', value: 'Variable' },
  { label: 'Opcional', value: 'Optional' },
]

function defaultChargeBasis(costDetailType: CostDetailType): ChargeBasis {
  if (costDetailType === 'Documentation') return 'PerDocument'
  if (costDetailType !== 'Freight' && costDetailType !== 'InlandTransport') return 'PerShipment'
  if (isFtl.value) return 'PerTruck'
  if (isConsolidated.value) return 'PerChargeableCbm'
  return 'PerContainer'
}

function isDetailPerContainer(detail: EditableDetail) {
  return detail.chargeBasis === 'PerContainer' || detail.chargeBasis === 'PerTruck'
}

function chargeBasisLabel(basis: ChargeBasis) {
  return chargeBasisOptions.find((item) => item.value === basis)?.label ?? basis
}

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

function cleanFreightNotes(value?: string | null) {
  const notes = value?.trim() ?? ''
  if (!notes) return ''

  if (notes.startsWith('{') || notes.startsWith('[')) {
    try {
      JSON.parse(notes)
      return ''
    } catch {
      // It is ordinary text that happens to start with a bracket.
    }
  }

  return notes
}

function isPendingImportedValue(value?: string | number | null) {
  const normalized = normalizeKey(String(value ?? ''))
  return !normalized || ['pending', 'porasignar', 'sinasignar', 'nodefinido'].includes(normalized)
}

function resolveImportedCatalogItem(
  items: typeof catalogs.carriers.value,
  id: string | null | undefined,
  primaryValues: Array<string | number | null | undefined>,
  rawValues: Array<string | number | null | undefined> = [],
) {
  const byId = catalogs.findById(items, id)
  if (byId) return byId

  // Los valores normalizados de la importación tienen prioridad sobre RawDataJson.
  // Así, por ejemplo, "China Base Ports" no termina reemplazado por "Ningbo"
  // solo porque el JSON original contiene ambos textos.
  const primary = primaryValues.filter((value) => !isPendingImportedValue(value))
  const primaryMatch = catalogs.findBestMatch(items, null, ...primary)
  if (primaryMatch) return primaryMatch

  const raw = rawValues.filter((value) => !isPendingImportedValue(value))
  return catalogs.findBestMatch(items, null, ...raw)
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
    chargeBasis: detail.chargeBasis ?? defaultChargeBasis(detail.costDetailType),
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    costAmount: String(detail.costAmount),
    saleAmount: String(detail.saleAmount),
    notes:
      detail.costDetailType === 'Freight'
        ? cleanFreightNotes(detail.notes)
        : detail.notes?.trim() || masterCost?.notes?.trim() || '',
    isAccountant: masterCost?.isAccountant ?? detail.quantity > 1,
    locked: detail.costType === 'Fixed' && Boolean(detail.costId),
    automaticFixed: detail.costType === 'Fixed' && Boolean(detail.costId),
    quantity: detail.quantity,
    minimumCostAmount: masterCost?.minimumCostAmount ?? null,
    minimumSaleAmount: masterCost?.minimumSaleAmount ?? null,
    kgPerCbm: masterCost?.kgPerCbm ?? null,
  }
}

function fromCost(cost: CostSelectDto): EditableDetail {
  const chargeBasis =
    cost.isAccountant && cost.chargeBasis === 'PerShipment'
      ? cost.shipmentMode === 'Ftl'
        ? 'PerTruck'
        : 'PerContainer'
      : (cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType))

  return {
    key: `cost-${cost.id}`,
    costId: cost.id,
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    chargeBasis,
    currencyId: cost.currencyId,
    currencyName: cost.currencyName,
    currencyCode: cost.currencyCode,
    costAmount: String(cost.costAmount),
    saleAmount: String(cost.agentId ? 0 : cost.saleAmount),
    notes: cost.notes ?? '',
    isAccountant: cost.isAccountant,
    locked: false,
    minimumCostAmount: cost.minimumCostAmount ?? null,
    minimumSaleAmount: cost.minimumSaleAmount ?? null,
    kgPerCbm: cost.kgPerCbm ?? null,
  }
}

function addManualDetail(type: CostDetailType = 'Other') {
  details.value.push({
    key: createUuid(),
    name: type === 'Freight' ? 'Flete internacional' : '',
    costDetailType: type,
    costType: 'Variable',
    chargeBasis: defaultChargeBasis(type),
    currencyId: form.currencyId,
    currencyName: selectedCurrency.value?.name ?? '',
    currencyCode: selectedCurrency.value?.code ?? '',
    costAmount: '',
    saleAmount: '',
    notes: '',
    isAccountant:
      defaultChargeBasis(type) === 'PerContainer' || defaultChargeBasis(type) === 'PerTruck',
    locked: false,
  })
}

const exwOriginConcepts = ['Recolecta', 'Cargos en Origen'] as const

function isExwSelected() {
  const incoterm = catalogs.findById(catalogs.incoterms.value, form.incotermId)
  const code = normalizeKey(incoterm?.code || '')
  if (code) return code === 'exw'

  const name = normalizeKey(incoterm?.name || '')
  return name === 'exw' || name.startsWith('exw') || name === 'exworks'
}

function createExwOriginDetail(name: (typeof exwOriginConcepts)[number]): EditableDetail {
  return {
    key: `exw-origin-${normalizeKey(name)}-${createUuid()}`,
    name,
    costDetailType: 'OriginCharge',
    costType: 'Variable',
    chargeBasis: 'PerShipment',
    currencyId: form.currencyId,
    currencyName: selectedCurrency.value?.name ?? '',
    currencyCode: selectedCurrency.value?.code ?? '',
    costAmount: '',
    saleAmount: '',
    notes: '',
    isAccountant: false,
    locked: false,
    exwGenerated: true,
  }
}

function syncExwOriginDetails() {
  if (!initialized.value) return

  if (!isExwSelected()) {
    const removed = details.value.filter((detail) => detail.exwGenerated)
    for (const detail of removed) {
      if (detail.id) removedDetailIds.value.push(detail.id)
    }
    details.value = details.value.filter((detail) => !detail.exwGenerated)
    return
  }

  for (const name of exwOriginConcepts) {
    const normalizedName = normalizeKey(name)
    const existing = details.value.find(
      (detail) =>
        !detail.costId &&
        !detail.fixedDecisionCost &&
        !detail.insuranceGenerated &&
        detail.costDetailType === 'OriginCharge' &&
        normalizeKey(detail.name) === normalizedName,
    )

    if (existing) {
      existing.exwGenerated = true
      existing.locked = false
      continue
    }

    details.value.push(createExwOriginDetail(name))
  }
}

function removeDetail(detail: EditableDetail) {
  if (detail.locked || detail.fixedDecisionCost) return
  if (detail.id) removedDetailIds.value.push(detail.id)
  if (detail.costId)
    optionalCostIds.value = optionalCostIds.value.filter((id) => id !== detail.costId)
  details.value = details.value.filter((item) => item.key !== detail.key)
}

const optionalCosts = computed(() =>
  availableCosts.value.filter(
    (cost) =>
      cost.costType === 'Optional' &&
      matchesCostScope(cost) &&
      !(usesContainerFreight.value && cost.costDetailType === 'Freight'),
  ),
)

const optionalOptions = computed<PricingMultiSelectOption[]>(() =>
  optionalCosts.value.map((cost) => ({
    value: cost.id,
    label: cost.name,
    description: `${cost.costDetailType} · ${formatMoney(cost.costAmount, cost.currencyName)} · ${chargeBasisLabel(cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType))}`,
    notes: cost.notes?.trim() || undefined,
  })),
)

function matchesCostScope(cost: CostSelectDto) {
  if (cost.shipmentMode && cost.shipmentMode !== form.shipmentMode) return false
  if (form.currencyId && cost.currencyId !== form.currencyId) return false
  if (cost.agentId && cost.agentId !== form.agentId) return false
  if (cost.carrierId && cost.carrierId !== form.carrierId) return false
  if (cost.incoterms?.length && !cost.incoterms.some((item) => item.id === form.incotermId))
    return false
  const hasStructuredRoute = Boolean(cost.polId || cost.poeId || cost.podId)
  if (hasStructuredRoute) {
    if (cost.polId && cost.polId !== form.polId) return false
    if (cost.poeId && cost.poeId !== form.poeId) return false
    if (cost.podId && cost.podId !== form.podId) return false
    return true
  }

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
  availableCosts.value.filter(
    (cost) =>
      cost.costType === 'Fixed' &&
      matchesCostScope(cost) &&
      !(usesContainerFreight.value && cost.costDetailType === 'Freight'),
  ),
)

async function loadOperationalCosts(): Promise<CostSelectDto[]> {
  const costs = await PricingService.selectCosts({ isActive: true })

  return costs.map((cost) => ({
    ...cost,
    notes: typeof cost.notes === 'string' ? cost.notes.trim() || null : null,
  }))
}

const containerSelectorsChanged = computed(() => {
  if (!props.rate) return false
  const current = containerAllocations.value
    .map((item) => `${item.containerTypeId}:${Number(item.quantity || 0)}`)
    .sort()
  const existing = (
    props.rate.containers?.length
      ? props.rate.containers.map((item) => `${item.containerTypeId}:${item.quantity}`)
      : [`${props.rate.containerTypeId}:${props.rate.containerQuantity}`]
  ).sort()
  return (
    current.length !== existing.length || current.some((value, index) => value !== existing[index])
  )
})

const selectorsChanged = computed(() =>
  Boolean(
    props.rate &&
    (props.rate.agentId !== form.agentId ||
      props.rate.carrierId !== form.carrierId ||
      props.rate.polId !== form.polId ||
      props.rate.poeId !== form.poeId ||
      props.rate.podId !== form.podId ||
      props.rate.shipmentMode !== form.shipmentMode ||
      (isFcl.value && containerSelectorsChanged.value) ||
      (props.rate.incotermId ?? '') !== form.incotermId ||
      props.rate.currencyId !== form.currencyId),
  ),
)

const visibleDetails = computed(() =>
  selectorsChanged.value
    ? details.value.filter(
        (detail) => !detail.locked || detail.automaticFixed || detail.insuranceGenerated,
      )
    : details.value,
)

const cargoInsuranceDetail = computed(() =>
  visibleDetails.value.find((detail) => detail.insuranceGenerated),
)

function synchronizeEditableFixedCosts() {
  if (!initialized.value) return

  const applicable = new Map(automaticFixedCosts.value.map((cost) => [cost.id, cost]))
  details.value = details.value.filter((detail) => {
    if (!detail.automaticFixed || !detail.costId) return true
    return applicable.has(detail.costId)
  })

  const existingIds = new Set(
    details.value
      .filter((detail) => detail.automaticFixed && detail.costId)
      .map((detail) => detail.costId!),
  )

  for (const cost of automaticFixedCosts.value) {
    if (existingIds.has(cost.id)) continue
    details.value.push({
      ...fromCost(cost),
      key: `fixed-${cost.id}`,
      locked: true,
      estimated: false,
      automaticFixed: true,
    })
  }
}

function detailQuantity(detail: EditableDetail) {
  switch (detail.chargeBasis) {
    case 'PerContainer':
    case 'PerTruck':
      return Math.max(1, requestedContainerQuantity.value)
    case 'PerCbm':
      return totalVolumeCbm.value
    case 'PerChargeableCbm': {
      const factor = Math.max(0, Number(detail.kgPerCbm || effectiveKgPerCbm.value))
      return factor > 0
        ? Math.max(totalVolumeCbm.value, totalWeightKg.value / factor)
        : chargeableCbm.value
    }
    case 'PerKg':
      return totalWeightKg.value
    case 'Per100Kg':
      return totalWeightKg.value / 100
    case 'PerTon':
      return totalWeightKg.value / 1000
    case 'PerPallet':
      return totalPallets.value
    case 'PerPackage':
      return totalPackages.value
    default:
      return Math.max(1, detail.quantity ?? 1)
  }
}

const containerFreightCostTotal = computed(() =>
  usesContainerFreight.value
    ? containerAllocations.value.reduce(
        (sum, item) =>
          sum + Number(item.freightCostAmount || 0) * Math.max(0, Number(item.quantity || 0)),
        0,
      )
    : 0,
)
const containerFreightSaleTotal = computed(() =>
  usesContainerFreight.value
    ? containerAllocations.value.reduce(
        (sum, item) =>
          sum + Number(item.freightSaleAmount || 0) * Math.max(0, Number(item.quantity || 0)),
        0,
      )
    : 0,
)
function detailCostTotal(detail: EditableDetail) {
  const calculated = Number(detail.costAmount || 0) * detailQuantity(detail)
  return Math.max(calculated, Number(detail.minimumCostAmount || 0))
}

function detailSaleTotal(detail: EditableDetail) {
  const calculated = Number(detail.saleAmount || 0) * detailQuantity(detail)
  return Math.max(calculated, Number(detail.minimumSaleAmount || 0))
}

const totalCost = computed(
  () =>
    containerFreightCostTotal.value +
    visibleDetails.value.reduce((sum, detail) => sum + detailCostTotal(detail), 0),
)
const totalSale = computed(
  () =>
    containerFreightSaleTotal.value +
    visibleDetails.value.reduce((sum, detail) => sum + detailSaleTotal(detail), 0),
)
const totalUtility = computed(() => totalSale.value - totalCost.value)
const margin = computed(() => calculateMargin(totalCost.value, totalSale.value))

const groups = computed(() => {
  const originRows = visibleDetails.value.filter((detail) => detail.costDetailType === 'OriginCharge')

  return [
    {
      key: 'agent',
      title: 'Costos de agente',
      hint: 'No generan venta.',
      rows: visibleDetails.value.filter((detail) => detail.costDetailType === 'AgentCharge'),
    },
    ...(usesContainerFreight.value
      ? []
      : [
          {
            key: 'freight',
            title: 'Flete internacional',
            hint: 'Costo y venta marítima.',
            rows: visibleDetails.value.filter((detail) => detail.costDetailType === 'Freight'),
          },
        ]),
    ...(originRows.length
      ? [
          {
            key: 'origin',
            title: 'Cargos en origen',
            hint: 'Recolecta, manejo y demás cargos aplicables en origen.',
            rows: originRows,
          },
        ]
      : []),
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
      hint: 'Documentación y cargos adicionales.',
      rows: visibleDetails.value.filter(
        (detail) =>
          !detail.insuranceGenerated &&
          !['AgentCharge', 'Freight', 'OriginCharge', 'DestinationCharge', 'InlandTransport'].includes(
            detail.costDetailType,
          ),
      ),
    },
  ]
})

watch(
  () => [
    form.agentId,
    form.carrierId,
    form.polId,
    form.poeId,
    form.podId,
    form.shipmentMode,
    form.incotermId,
    form.currencyId,
  ],
  synchronizeEditableFixedCosts,
)

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

function insuranceUsdCurrency() {
  return catalogs.findByCode(catalogs.currencies.value, 'USD') ?? selectedCurrency.value
}

function syncCargoInsurance() {
  if (!initialized.value) return
  const cargoValue = Number(form.cargoValue || 0)
  const existingIndex = details.value.findIndex((detail) => detail.insuranceGenerated)

  if (!(cargoValue > 0)) {
    if (existingIndex >= 0) details.value.splice(existingIndex, 1)
    return
  }

  if (!form.manualInsurancePercentage) {
    form.insurancePercentage = String(defaultInsurancePercentage)
  }
  const percentage = Math.max(0, Number(form.insurancePercentage || defaultInsurancePercentage))
  if (!form.manualInsuranceMinimum) {
    form.insuranceMinimumAmount = String(defaultInsuranceMinimumAmount)
  }
  const minimumAmount = Math.max(
    0,
    Number(form.insuranceMinimumAmount || defaultInsuranceMinimumAmount),
  )
  const calculated = Math.max(minimumAmount, cargoValue * (percentage / 100))
  const costAmount = Math.max(
    insuranceCostMinimumAmount,
    cargoValue * (insuranceCostPercentage / 100),
  )
  if (!form.manualInsuranceAmount) {
    form.insuranceAmount = calculated.toFixed(2)
  }
  const amount = Math.max(0, Number(form.insuranceAmount || calculated))
  const usd = insuranceUsdCurrency()
  if (!usd) return

  const notes = `Seguro de carga · valor carga USD ${cargoValue.toFixed(2)} · ${percentage.toFixed(4)}% · mínimo USD ${minimumAmount.toFixed(2)} · costo ${insuranceCostPercentage.toFixed(4)}% · mínimo costo USD ${insuranceCostMinimumAmount.toFixed(2)}${form.manualInsurancePercentage ? ' · porcentaje manual' : ''}${form.manualInsuranceMinimum ? ' · mínimo manual' : ''}${form.manualInsuranceAmount ? ' · tarifa manual' : ''}`
  const detail: EditableDetail = {
    key: existingIndex >= 0 ? details.value[existingIndex]!.key : `cargo-insurance-${createUuid()}`,
    id: existingIndex >= 0 ? details.value[existingIndex]!.id : null,
    name: 'Seguro de carga',
    costDetailType: 'Insurance',
    costType: 'Variable',
    chargeBasis: 'PerShipment',
    currencyId: usd.id,
    currencyName: usd.name,
    currencyCode: usd.code,
    costAmount: costAmount.toFixed(2),
    saleAmount: amount.toFixed(2),
    notes,
    isAccountant: false,
    locked: true,
    estimated: true,
    insuranceGenerated: true,
  }

  if (existingIndex >= 0) details.value.splice(existingIndex, 1, detail)
  else details.value.push(detail)
}

function hydrateCargoInsuranceFromDetails() {
  const detail = details.value.find(
    (item) =>
      item.costDetailType === 'Insurance' && /Seguro de carga · valor carga USD/i.test(item.notes),
  )
  if (!detail) return

  const cargoMatch = detail.notes.match(/valor carga USD\s+([0-9]+(?:\.[0-9]+)?)/i)
  const percentageMatch = detail.notes.match(/·\s*([0-9]+(?:\.[0-9]+)?)%/i)
  const minimumMatch = detail.notes.match(/mínimo USD\s+([0-9]+(?:\.[0-9]+)?)/i)
  if (cargoMatch?.[1]) form.cargoValue = cargoMatch[1]
  if (percentageMatch?.[1]) form.insurancePercentage = percentageMatch[1]
  if (minimumMatch?.[1]) form.insuranceMinimumAmount = minimumMatch[1]
  form.insuranceAmount = String(detail.saleAmount || form.insuranceMinimumAmount || 95)
  form.manualInsurancePercentage = /porcentaje manual/i.test(detail.notes)
  form.manualInsuranceMinimum = /mínimo manual/i.test(detail.notes)
  form.manualInsuranceAmount = /tarifa manual/i.test(detail.notes)
  detail.insuranceGenerated = true
  detail.locked = true
  detail.estimated = true
}

watch(
  () => [
    form.cargoValue,
    form.insurancePercentage,
    form.insuranceMinimumAmount,
    form.insuranceAmount,
    form.manualInsurancePercentage,
    form.manualInsuranceMinimum,
    form.manualInsuranceAmount,
  ],
  syncCargoInsurance,
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
  const notes =
    detail.costDetailType === 'Freight' ? cleanFreightNotes(detail.notes) : detail.notes.trim()

  return {
    costId: detail.costId ?? null,
    name: detail.name.trim(),
    costDetailType: detail.costDetailType,
    costType: detail.costType,
    chargeBasis: detail.chargeBasis,
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    costAmount: Number(detail.costAmount || 0),
    saleAmount: agentCost ? 0 : Number(detail.saleAmount || 0),
    notes: notes || null,
    quantity: detailQuantity(detail),
  }
}

function containerFreightDetails() {
  if (!usesContainerFreight.value) return []
  const currency = catalogs.findById(catalogs.currencies.value, form.currencyId)
  if (!currency) return []

  return containerAllocations.value.flatMap((allocation) => {
    const container = catalogs.findById(catalogs.containerTypes.value, allocation.containerTypeId)
    const quantity = Number(allocation.quantity || 0)
    if (!container || quantity <= 0) return []

    return [
      {
        id: allocation.freightDetailId ?? null,
        costId: null,
        name: `Flete internacional · ${container.name}`,
        costDetailType: 'Freight' as CostDetailType,
        costType: 'Variable' as CostType,
        chargeBasis: 'PerContainer' as ChargeBasis,
        currencyId: currency.id,
        currencyName: currency.name,
        currencyCode: currency.code,
        costAmount: Number(allocation.freightCostAmount || 0),
        saleAmount: Number(allocation.freightSaleAmount || 0),
        notes: null,
        quantity,
      },
    ]
  })
}

function buildHeader() {
  const agent = catalogs.findById(catalogs.agents.value, form.agentId)
  const carrier = catalogs.findById(catalogs.carriers.value, form.carrierId)
  const pol = catalogs.findById(catalogs.polPorts.value, form.polId)
  const poe = catalogs.findById(catalogs.poePorts.value, form.poeId)
  const pod = catalogs.findById(catalogs.podPorts.value, form.podId)
  const containers = resolveContainerRequests()
  const container = isFcl.value
    ? containers?.[0]
    : {
        containerTypeId: '00000000-0000-0000-0000-000000000000',
        containerTypeName: '',
        containerTypeCode: '',
        quantity: Math.max(1, requestedContainerQuantity.value),
      }
  const incoterm = catalogs.findById(catalogs.incoterms.value, form.incotermId)
  const currency = catalogs.findById(catalogs.currencies.value, form.currencyId)

  if (
    !agent ||
    !carrier ||
    !pol ||
    !poe ||
    !pod ||
    !container ||
    containers === null ||
    !incoterm ||
    !currency
  )
    return null

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
    containerTypeId: container.containerTypeId,
    containerTypeName: container.containerTypeName,
    containerTypeCode: container.containerTypeCode,
    incotermId: incoterm.id,
    incotermName: incoterm.name,
    incotermCode: incoterm.code,
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code,
    freeDays: Number(form.freeDays || 0),
    validFrom: form.validFrom,
    validTo: form.validTo,
    containerQuantity: isConsolidated.value
      ? 1
      : isFcl.value
        ? Math.max(1, allocatedContainerQuantity.value || requestedContainerQuantity.value)
        : Math.max(1, requestedContainerQuantity.value),
    containers: isFcl.value ? containers : [],
    clientName: form.clientName.trim() || null,
    idtraNumber: form.idtraNumber.trim() || null,
    quoNumber: form.quoNumber.trim() || null,
    includes: selectedTermText(includesTermIds.value) || null,
    subjectTo: selectedTermText(subjectToTermIds.value) || null,
    excludes: selectedTermText(excludesTermIds.value) || null,
    transitTime: form.transitTime.trim() || null,
    rateType: form.rateType,
    shipmentMode: form.shipmentMode,
    totalPackages: isConsolidated.value ? totalPackages.value : 0,
    totalPallets: isConsolidated.value ? totalPallets.value : 0,
    totalWeightKg: isConsolidated.value ? totalWeightKg.value : 0,
    totalVolumeCbm: isConsolidated.value ? totalVolumeCbm.value : 0,
    kgPerCbm: isConsolidated.value ? effectiveKgPerCbm.value : 500,
    cargoLines: cargoLineRequests(),
  }
}

function validate() {
  form.submitted = true
  if (!buildHeader()) return false
  if (
    Number(form.freeDays) < 0 ||
    ((isFcl.value || isFtl.value) && requestedContainerQuantity.value <= 0) ||
    Boolean(containerAllocationError.value) ||
    (isConsolidated.value &&
      (effectiveKgPerCbm.value <= 0 ||
        cargoLines.value.length === 0 ||
        chargeableCbm.value <= 0)) ||
    !form.validFrom ||
    !form.validTo ||
    form.validTo < form.validFrom
  )
    return false
  const applicable = details.value.filter(
    (detail) =>
      !selectorsChanged.value ||
      !detail.locked ||
      detail.automaticFixed ||
      detail.insuranceGenerated,
  )
  if (
    !usesContainerFreight.value &&
    !applicable.some((detail) => detail.costDetailType === 'Freight')
  )
    return false
  return applicable.every((detail) => !detailError(detail))
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
  } else if (result.status === 'AcceptedByClient') {
    toastStore.success(
      'Tarifa aceptada automáticamente',
      'Al tener IDTRA y QUO asignados, la tarifa pasó a aceptada por el cliente.',
    )
  } else {
    toastStore.success(
      isEditing.value ? 'Tarifa actualizada' : 'Tarifa creada',
      result.status === 'Open'
        ? 'El margen es igual o superior al 12% y la tarifa quedó abierta.'
        : 'Los totales y el margen se recalcularon correctamente.',
    )
  }
}

function notifyValidationProblems() {
  const missing: string[] = []
  if (!form.agentId) missing.push('agente')
  if (!form.carrierId) missing.push('naviera')
  if (!form.polId) missing.push('POL')
  if (!form.poeId) missing.push('POE')
  if (!form.podId) missing.push('POD')
  if (!form.containerTypeId && isFcl.value) missing.push('contenedor')
  if (!form.incotermId) missing.push('Incoterm')
  if (!form.currencyId) missing.push('moneda')
  if (!form.validFrom || !form.validTo) missing.push('vigencia')
  if (containerAllocationError.value) missing.push('distribución de contenedores')
  toastStore.warning(
    'Faltan datos para guardar',
    missing.length ? `Revise: ${missing.join(', ')}.` : 'Revise los rubros, cantidades y montos marcados antes de guardar.',
  )
}

async function submit() {
  if (!validate()) {
    notifyValidationProblems()
    return
  }
  const header = buildHeader()!

  let pendingUpdate: UpdateRateRequest | null = null
  let pendingCreate: CreateRateRequest | null = null

  try {
    form.saving = true
    let rateId = props.rate?.id

    if (props.rate) {
      const payload: UpdateRateRequest = {
        ...header,
        extraDetails: [
          ...containerFreightDetails(),
          ...details.value
            .filter(
              (detail) =>
                (!usesContainerFreight.value || detail.costDetailType !== 'Freight') &&
                !detail.importedFreight &&
                (detail.insuranceGenerated ||
                  detail.automaticFixed ||
                  !selectorsChanged.value ||
                  !detail.locked),
            )
            .map((detail) => ({ ...mapDetail(detail), id: detail.id ?? null })),
        ],
        removedExtraDetailIds: [...new Set(removedDetailIds.value)],
      }
      pendingUpdate = payload
      await PricingService.updateRate(props.rate.id, payload)
    } else {
      const payload: CreateRateRequest = {
        sourceImportFclRateId: props.sourceImport?.id ?? null,
        ...header,
        details: isCreatingFromImport.value
          ? details.value
              .filter(
                (detail) =>
                  detail.importedFreight ||
                  detail.insuranceGenerated ||
                  detail.fixedDecisionCost ||
                  detail.automaticFixed ||
                  !detail.locked,
              )
              .map(mapDetail)
          : [
              ...containerFreightDetails().map(({ id: _id, ...detail }) => detail),
              ...details.value
                .filter(
                  (detail) =>
                    (!usesContainerFreight.value || detail.costDetailType !== 'Freight') &&
                    (detail.insuranceGenerated ||
                      detail.automaticFixed ||
                      (!detail.locked && !detail.importedFreight)),
                )
                .map(mapDetail),
            ],
      }
      pendingCreate = payload
      rateId = await PricingService.createRate(payload)
    }

    if (rateId) await approveIfAllowed(rateId)
    clearDraft()
    drawerStore.close()
    await props.onSaved?.(rateId)
  } catch (error) {
    if (isConnectionFailure(error)) {
      if (props.rate && pendingUpdate) queueRateUpdate(props.rate.id, pendingUpdate)
      else if (!props.rate && pendingCreate) queueRateCreate(pendingCreate)
      persistDraft()
      toastStore.warning(
        'Cambio guardado sin conexión',
        'El cambio quedó almacenado en este navegador y se enviará automáticamente cuando vuelva la conexión.',
      )
      drawerStore.close()
      return
    }
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

  if (!form.currencyId) {
    form.currencyId = catalogs.findByCode(catalogs.currencies.value, 'USD')?.id ?? ''
  }

  if (!form.incotermId) {
    form.incotermId =
      catalogs.findByCode(catalogs.incoterms.value, 'FOB')?.id ??
      catalogs.incoterms.value[0]?.id ??
      ''
  }

  try {
    // Este endpoint usa pricing.cost.select, el mismo permiso necesario para
    // construir tarifas, y devuelve las notas operativas de costos fijos y opcionales.
    availableCosts.value = await loadOperationalCosts()
  } catch (error) {
    availableCosts.value = []
    toastStore.backendError(error, 'No se pudieron cargar los costos ni sus notas operativas.')
  }

  try {
    rateTermItems.value = await PricingService.selectRateTermItems()
    const assignedTermIds = new Set<string>()
    hydrateTermSelection(form.includes, includesTermIds, assignedTermIds)
    hydrateTermSelection(form.subjectTo, subjectToTermIds, assignedTermIds)
    hydrateTermSelection(form.excludes, excludesTermIds, assignedTermIds)
    // Ya no existe texto libre adicional: solo se persisten los ítems seleccionados.
    form.includes = ''
    form.subjectTo = ''
    form.excludes = ''
  } catch (error) {
    rateTermItems.value = []
    toastStore.backendError(
      error,
      'No se pudieron cargar las condiciones comerciales predefinidas.',
    )
  }

  await resolveCarrierFreeDays()
  if (rateTermItems.value.length) await loadAutomaticTermBlocks(!isEditing.value)

  let importForEdit = props.sourceImport
  if (!importForEdit && props.rate?.sourceImportFclRateId) {
    try {
      importForEdit = await PricingService.getImportRate(props.rate.sourceImportFclRateId)
    } catch {
      importForEdit = undefined
    }
  }

  let importedAgentMatch: ReturnType<typeof catalogs.findBestMatch>
  let importedCarrierMatch: ReturnType<typeof catalogs.findBestMatch>
  let importedPolMatch: ReturnType<typeof catalogs.findBestMatch>
  let importedPoeMatch: ReturnType<typeof catalogs.findBestMatch>
  let importedPodMatch: ReturnType<typeof catalogs.findBestMatch>
  let importedContainerMatch: ReturnType<typeof catalogs.findBestMatch>
  let importedCurrencyMatch: ReturnType<typeof catalogs.findBestMatch>

  if (importForEdit) {
    const raw = importForEdit.rawDataJson ?? ''
    importedAgentMatch = resolveImportedCatalogItem(
      catalogs.agents.value,
      importForEdit.agentId,
      [importForEdit.agent, importForEdit.agentCode, importForEdit.agentSlug],
      readRawValues(raw, [
        'agent',
        'agentName',
        'agente',
        'shippingAgent',
        'freightAgent',
        'forwarder',
        'agency',
      ]),
    )
    importedCarrierMatch = resolveImportedCatalogItem(
      catalogs.carriers.value,
      importForEdit.carrierId,
      [importForEdit.carrier, importForEdit.carrierCode, importForEdit.carrierSlug],
      readRawValues(raw, ['carrier', 'carrierName', 'naviera', 'shippingLine']),
    )
    importedPolMatch = resolveImportedCatalogItem(
      catalogs.polPorts.value,
      importForEdit.polId,
      [importForEdit.pol, importForEdit.polCode, importForEdit.polSlug],
      readRawValues(raw, ['pol', 'origin', 'originPort', 'portOfLoading', 'puertoOrigen']),
    )

    const poeHasImportedValue = ![
      importForEdit.poe,
      importForEdit.poeCode,
      importForEdit.poeSlug,
    ].every(isPendingImportedValue)
    const poeRawValues = readRawValues(raw, [
      'poe',
      'entryPort',
      'portOfEntry',
      'puertoEntrada',
      'transshipmentPort',
    ])
    importedPoeMatch = resolveImportedCatalogItem(
      catalogs.poePorts.value,
      importForEdit.poeId,
      [importForEdit.poe, importForEdit.poeCode, importForEdit.poeSlug],
      poeHasImportedValue
        ? poeRawValues
        : [...poeRawValues, importForEdit.pod, importForEdit.podCode, importForEdit.podSlug],
    )
    importedPodMatch = resolveImportedCatalogItem(
      catalogs.podPorts.value,
      importForEdit.podId,
      [importForEdit.pod, importForEdit.podCode, importForEdit.podSlug],
      readRawValues(raw, [
        'pod',
        'destination',
        'destinationPort',
        'portOfDischarge',
        'puertoDestino',
        'finalDestination',
      ]),
    )
    importedContainerMatch = resolveImportedCatalogItem(
      catalogs.containerTypes.value,
      importForEdit.containerTypeId,
      [
        importForEdit.containerType,
        importForEdit.containerTypeCode,
        importForEdit.containerTypeSlug,
      ],
      readRawValues(raw, ['container', 'containerType', 'equipment', 'equipmentType', 'tamano']),
    )
    importedCurrencyMatch = resolveImportedCatalogItem(
      catalogs.currencies.value,
      importForEdit.currencyId,
      [importForEdit.currency, importForEdit.currencyCode, importForEdit.currencySlug],
      readRawValues(raw, ['currency', 'currencyCode', 'moneda']),
    )

    if (isCreatingFromImport.value) {
      canEditImportedAgent.value = !importedAgentMatch
      canEditImportedPoe.value = !importedPoeMatch
      canEditImportedPod.value = !importedPodMatch
    }
  }

  if (props.rate) {
    if (importForEdit && !catalogs.findById(catalogs.agents.value, form.agentId)) {
      form.agentId = importedAgentMatch?.id ?? ''
    }

    if (importForEdit && !catalogs.findById(catalogs.carriers.value, form.carrierId)) {
      form.carrierId = importedCarrierMatch?.id ?? ''
    }

    if (importForEdit && !catalogs.findById(catalogs.polPorts.value, form.polId)) {
      form.polId = importedPolMatch?.id ?? ''
    }

    if (importForEdit && !catalogs.findById(catalogs.poePorts.value, form.poeId)) {
      form.poeId = importedPoeMatch?.id ?? ''
    }

    if (importForEdit && !catalogs.findById(catalogs.podPorts.value, form.podId)) {
      form.podId = importedPodMatch?.id ?? ''
    }

    if (importForEdit && !catalogs.findById(catalogs.containerTypes.value, form.containerTypeId)) {
      form.containerTypeId = importedContainerMatch?.id ?? ''
    }

    if (importForEdit && !catalogs.findById(catalogs.currencies.value, form.currencyId)) {
      form.currencyId =
        importedCurrencyMatch?.id ?? catalogs.findByCode(catalogs.currencies.value, 'USD')?.id ?? ''
    }

    details.value = props.rate.rateDetails
      .filter(
        (detail) =>
          props.rate?.sourceImportFclRateId ||
          props.rate?.shipmentMode !== 'Fcl' ||
          detail.costDetailType !== 'Freight',
      )
      .map(fromRateDetail)
    hydrateCargoInsuranceFromDetails()
    optionalCostIds.value = props.rate.rateDetails
      .filter((detail) => detail.costType === 'Optional' && detail.costId)
      .map((detail) => detail.costId!)
  } else if (props.sourceImport) {
    form.agentId = importedAgentMatch?.id ?? ''
    form.carrierId = importedCarrierMatch?.id ?? ''
    form.polId = importedPolMatch?.id ?? ''
    form.poeId = importedPoeMatch?.id ?? ''
    form.podId = importedPodMatch?.id ?? ''
    form.containerTypeId = importedContainerMatch?.id ?? ''
    form.currencyId =
      importedCurrencyMatch?.id ?? catalogs.findByCode(catalogs.currencies.value, 'USD')?.id ?? ''
    const importedDetails: EditableDetail[] = [
      {
        key: `import-freight-${props.sourceImport.id}`,
        name: 'Flete internacional',
        costDetailType: 'Freight',
        costType: 'Variable',
        chargeBasis: 'PerContainer',
        currencyId: form.currencyId,
        currencyName: selectedCurrency.value?.name ?? props.sourceImport.currency,
        currencyCode: selectedCurrency.value?.code ?? props.sourceImport.currencyCode,
        costAmount: String(props.sourceImport.oceanFreight ?? props.sourceImport.freight),
        saleAmount: String(
          props.sourceImport.totalSale ??
            props.sourceImport.oceanFreight ??
            props.sourceImport.freight,
        ),
        notes: '',
        isAccountant: true,
        locked: true,
        importedFreight: true,
      },
    ]

    details.value = importedDetails
  } else {
    form.agentId =
      catalogs.findByCode(catalogs.agents.value, 'WWL')?.id ??
      catalogs.findByCode(catalogs.agents.value, 'RS')?.id ??
      ''
  }

  hydrateCargoLines()
  hydrateContainerAllocations()
  if (!isFcl.value && !details.value.some((detail) => detail.costDetailType === 'Freight')) {
    addManualDetail('Freight')
  }
  if (form.rateType === 'Spot') {
    const todayValue = dateValue(new Date())
    form.validFrom = todayValue
    form.validTo = todayValue
  }
  initialized.value = true
  const draftRestored = restoreDraftIfAvailable()
  if (draftRestored && form.rateType === 'Spot') {
    const todayValue = dateValue(new Date())
    form.validFrom = todayValue
    form.validTo = todayValue
  }
  synchronizeEditableFixedCosts()
  syncExwOriginDetails()
  syncCargoInsurance()
}

watch(
  () => form.shipmentMode,
  (mode, previous) => {
    if (isCreatingFromImport.value && mode !== 'Fcl') {
      form.shipmentMode = 'Fcl'
      return
    }
    if (!initialized.value || mode === previous) return

    if (mode === 'Ltl' && (!form.kgPerCbm || Number(form.kgPerCbm) === 500)) form.kgPerCbm = '333'
    if (mode === 'Lcl' && (!form.kgPerCbm || Number(form.kgPerCbm) === 333)) form.kgPerCbm = '500'
    if (mode === 'Lcl' || mode === 'Ltl') {
      if (!cargoLines.value.length) cargoLines.value = [emptyCargoLine()]
    }

    for (const detail of details.value) {
      if (
        !detail.costId &&
        (detail.costDetailType === 'Freight' || detail.costDetailType === 'InlandTransport')
      ) {
        detail.chargeBasis = defaultChargeBasis(detail.costDetailType)
        detail.isAccountant =
          detail.chargeBasis === 'PerContainer' || detail.chargeBasis === 'PerTruck'
      }
    }
    if (mode !== 'Fcl' && !details.value.some((detail) => detail.costDetailType === 'Freight')) {
      addManualDetail('Freight')
    }
    synchronizeEditableFixedCosts()
  },
)

watch(
  () => form.carrierId,
  async (value, previous) => {
    if (!initialized.value || value === previous) return
    await resolveCarrierFreeDays()
  },
)

watch(
  () => form.incotermId,
  (value, previous) => {
    if (!initialized.value || value === previous) return
    syncExwOriginDetails()
  },
)

watch(
  () => [form.rateType, form.shipmentMode, form.poeId, form.incotermId] as const,
  async (value, previous) => {
    if (!initialized.value || value.every((item, index) => item === previous?.[index])) return
    await loadAutomaticTermBlocks(true)
  },
)

watch(
  () => form.rateType,
  (rateType) => {
    if (rateType !== 'Spot') return
    const todayValue = dateValue(new Date())
    form.validFrom = todayValue
    form.validTo = todayValue
  },
)

watch(
  [
    () => ({ ...form }),
    details,
    containerAllocations,
    cargoLines,
    optionalCostIds,
    removedDetailIds,
    includesTermIds,
    subjectToTermIds,
    excludesTermIds,
  ],
  scheduleDraftSave,
  { deep: true },
)

onBeforeUnmount(() => {
  if (draftTimer !== null) window.clearTimeout(draftTimer)
  if (initialized.value && !form.saving) persistDraft()
})

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
        {{ editingDisplayName }}
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
          {{
            catalogs.findById(catalogs.carriers.value, form.carrierId)?.name ||
            'Naviera sin coincidencia'
          }}
          ·
          {{
            catalogs.findById(catalogs.polPorts.value, form.polId)?.name || 'POL sin coincidencia'
          }}
          →
          {{
            catalogs.findById(catalogs.poePorts.value, form.poeId)?.name || 'POE sin coincidencia'
          }}
          →
          {{
            catalogs.findById(catalogs.podPorts.value, form.podId)?.name || 'POD sin coincidencia'
          }}
          ·
          {{
            catalogs.findById(catalogs.containerTypes.value, form.containerTypeId)?.name ||
            'Contenedor sin coincidencia'
          }}. Los datos importados están bloqueados y se copiarán desde los valores reales del
          catálogo.
          <span v-if="decisionInternationalLandFreight">
            La ruta POE Panamá → POD GAM aplicará automáticamente el flete internacional terrestre
            de
            {{ formatMoney(decisionInternationalLandFreight, 'USD') }} desde Pricing.
          </span>
        </p>
      </div>
    </section>

    <section
      v-if="missingSelectableImportedFields.length"
      class="flex items-start gap-3 rounded-[24px] border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200"
    >
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p class="font-black">Complete los datos ausentes de la importación</p>
        <p class="mt-1 text-sm font-semibold opacity-80">
          La tarifa importada no definió {{ missingSelectableImportedFields.join(' ni ') }}.
          Únicamente esos campos quedan habilitados para seleccionarlos antes de guardar.
        </p>
      </div>
    </section>

    <section
      v-if="unresolvedLockedImportedFields.length"
      class="flex items-start gap-3 rounded-[24px] border border-red-500/30 bg-red-500/10 p-4 text-red-800 dark:text-red-200"
    >
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p class="font-black">La importación no coincide completamente con Config</p>
        <p class="mt-1 text-sm font-semibold opacity-80">
          No se encontró una opción real para:
          {{ unresolvedLockedImportedFields.join(', ') }}. No se usarán valores inventados ni
          opciones temporales.
        </p>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div
        :class="[
          'flex cursor-pointer items-center gap-3 select-none',
          collapsedStages[1] ? 'mb-0' : 'mb-5',
        ]"
        @click="toggleStage(1)"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >1</span
        >
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Ruta y responsables</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            Todos los valores provienen de catálogos para evitar datos inconsistentes.
          </p>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-[var(--dh-border)] p-2 text-[var(--dh-text-muted)] transition hover:bg-black/5 hover:text-[var(--dh-text)] dark:hover:bg-white/10"
          :aria-label="collapsedStages[1] ? 'Expandir etapa 1' : 'Colapsar etapa 1'"
          :title="collapsedStages[1] ? 'Expandir etapa' : 'Colapsar etapa'"
          @click.stop="toggleStage(1)"
        >
          <ChevronDown
            class="h-5 w-5 transition-transform duration-200"
            :class="collapsedStages[1] ? '' : 'rotate-180'"
          />
        </button>
      </div>
      <div v-show="!collapsedStages[1]" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DhSelect
          v-model="form.shipmentMode"
          :disabled="isCreatingFromImport"
          label="Modalidad"
          :options="shipmentModeOptions"
        />
        <DhSelect
          v-model="form.agentId"
          :disabled="isAgentLocked"
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
          v-model="form.polId"
          :disabled="isHeaderLocked"
          label="POL · Origen"
          placeholder="Seleccione POL"
          :options="catalogs.polOptions.value"
          :error="fieldError(form.polId, 'el POL')"
        />
        <DhSelect
          v-model="form.poeId"
          :disabled="isPoeLocked"
          label="POE · Entrada"
          placeholder="Seleccione POE"
          :options="catalogs.poeOptions.value"
          :error="fieldError(form.poeId, 'el POE')"
        />
        <DhSelect
          v-model="form.podId"
          :disabled="isPodLocked"
          label="POD · Destino final"
          placeholder="Seleccione POD"
          :options="catalogs.podOptions.value"
          :error="fieldError(form.podId, 'el POD')"
        />
      </div>

      <div
        v-if="isFcl"
        v-show="!collapsedStages[1]"
        class="mt-5 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-bg)]/45 p-4"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">Distribución de contenedores</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              Con un solo tipo se indica únicamente el total. Al agregar más tipos, la cantidad se
              reparte automáticamente entre ellos y el total se mantiene sincronizado.
            </p>
          </div>
          <DhInput
            v-model="form.containerQuantity"
            class="w-full sm:w-52"
            type="number"
            min="1"
            :disabled="containerAllocations.length > 1"
            :label="
              containerAllocations.length > 1 ? 'Cantidad total (automática)' : 'Cantidad total'
            "
            :error="
              form.submitted && requestedContainerQuantity <= 0
                ? 'Debe ser mayor a cero.'
                : undefined
            "
          />
        </div>

        <div class="mt-4 space-y-3">
          <div
            v-for="allocation in containerAllocations"
            :key="allocation.key"
            :class="[
              'grid gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 xl:items-end',
              containerAllocations.length > 1
                ? 'xl:grid-cols-[minmax(0,1fr)_110px_150px_150px_auto]'
                : 'xl:grid-cols-[minmax(0,1fr)_150px_150px_auto]',
            ]"
          >
            <DhSelect
              v-model="allocation.containerTypeId"
              :disabled="isContainerMixLocked"
              label="Tipo de contenedor"
              placeholder="Seleccione contenedor"
              :options="containerOptionsFor(allocation.key)"
            />
            <DhInput
              v-if="containerAllocations.length > 1"
              v-model="allocation.quantity"
              type="number"
              min="1"
              label="Cantidad"
            />
            <DhInput
              v-if="usesContainerFreight"
              v-model="allocation.freightCostAmount"
              type="number"
              min="0"
              :label="`Costo flete (${currencyName})`"
              placeholder="0.00"
            />
            <DhInput
              v-if="usesContainerFreight"
              v-model="allocation.freightSaleAmount"
              type="number"
              min="0"
              :label="`Venta flete (${currencyName})`"
              placeholder="0.00"
            />
            <DhButton
              v-if="containerAllocations.length > 1 && !isContainerMixLocked"
              label="Quitar"
              :icon="Trash2"
              variant="ghost"
              size="sm"
              type="button"
              @click="removeContainerAllocation(allocation.key)"
            />
          </div>
        </div>

        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs font-black text-emerald-600 dark:text-emerald-400">
            Total de contenedores:
            {{
              containerAllocations.length > 1
                ? allocatedContainerQuantity
                : requestedContainerQuantity
            }}
          </p>
          <DhButton
            v-if="!isContainerMixLocked"
            label="Agregar tipo de contenedor"
            :icon="Plus"
            variant="secondary"
            size="sm"
            type="button"
            :disabled="
              containerAllocations.some((item) => !item.containerTypeId) ||
              containerAllocations.length >= catalogs.containerOptions.value.length
            "
            @click="addContainerAllocation()"
          />
        </div>
        <p v-if="containerAllocationError" class="mt-2 text-xs font-bold text-red-500">
          {{ containerAllocationError }}
        </p>
      </div>

      <div
        v-if="isFtl"
        v-show="!collapsedStages[1]"
        class="mt-5 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-bg)]/45 p-4"
      >
        <div class="grid gap-4 sm:grid-cols-[1fr_220px] sm:items-end">
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">Camión completo · FTL</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              El flete se puede cobrar por camión y los demás rubros conservan su propia base de
              cobro.
            </p>
          </div>
          <DhInput
            v-model="form.containerQuantity"
            type="number"
            min="1"
            label="Cantidad de camiones"
            :error="
              form.submitted && requestedContainerQuantity <= 0
                ? 'Debe ser mayor a cero.'
                : undefined
            "
          />
        </div>
      </div>

      <div
        v-if="isConsolidated"
        v-show="!collapsedStages[1]"
        class="mt-5 space-y-4 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-bg)]/45 p-4"
      >
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">
              Detalle de carga · {{ form.shipmentMode.toUpperCase() }}
            </p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              El sistema calcula CBM dimensional, equivalente por peso y la cantidad cobrable.
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
            <DhInput
              v-model="form.kgPerCbm"
              type="number"
              min="0.01"
              step="0.01"
              label="KG por CBM"
              class="sm:w-44"
            />
            <DhButton
              label="Agregar línea"
              :icon="Plus"
              variant="secondary"
              size="sm"
              type="button"
              @click="addCargoLine()"
            />
          </div>
        </div>

        <div class="space-y-3">
          <div
            v-for="(line, index) in cargoLines"
            :key="line.key"
            class="grid gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 md:grid-cols-2 xl:grid-cols-[1.2fr_90px_90px_120px_100px_100px_100px_100px_auto] xl:items-end"
          >
            <DhInput
              v-model="line.description"
              :label="`Descripción #${index + 1}`"
              placeholder="Mercancía"
            />
            <DhInput v-model="line.packages" type="number" min="0" label="Bultos" />
            <DhInput v-model="line.pallets" type="number" min="0" label="Pallets" />
            <DhInput v-model="line.weightKg" type="number" min="0" step="0.01" label="Peso KG" />
            <DhInput v-model="line.lengthCm" type="number" min="0" step="0.01" label="Largo CM" />
            <DhInput v-model="line.widthCm" type="number" min="0" step="0.01" label="Ancho CM" />
            <DhInput v-model="line.heightCm" type="number" min="0" step="0.01" label="Alto CM" />
            <div class="rounded-xl border border-[var(--dh-border)] px-3 py-2">
              <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">CBM</p>
              <p class="mt-1 text-sm font-black text-[var(--dh-text)]">
                {{ cargoLineVolume(line).toFixed(3) }}
              </p>
            </div>
            <DhButton
              v-if="cargoLines.length > 1"
              label="Quitar"
              :icon="Trash2"
              variant="ghost"
              size="sm"
              type="button"
              @click="removeCargoLine(line.key)"
            />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
            <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Peso</p>
            <p class="mt-1 font-black text-[var(--dh-text)]">{{ totalWeightKg.toFixed(2) }} KG</p>
          </div>
          <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
            <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">
              CBM dimensional
            </p>
            <p class="mt-1 font-black text-[var(--dh-text)]">{{ totalVolumeCbm.toFixed(3) }}</p>
          </div>
          <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
            <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">CBM por peso</p>
            <p class="mt-1 font-black text-[var(--dh-text)]">
              {{ weightEquivalentCbm.toFixed(3) }}
            </p>
          </div>
          <div
            class="rounded-2xl border border-[var(--dh-primary)]/30 bg-[var(--dh-primary)]/10 p-3"
          >
            <p class="text-[10px] font-black uppercase text-[var(--dh-primary)]">CBM cobrable</p>
            <p class="mt-1 font-black text-[var(--dh-text)]">{{ chargeableCbm.toFixed(3) }}</p>
          </div>
          <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
            <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">
              Pallets / bultos
            </p>
            <p class="mt-1 font-black text-[var(--dh-text)]">
              {{ totalPallets }} / {{ totalPackages }}
            </p>
          </div>
        </div>
        <p v-if="form.submitted && chargeableCbm <= 0" class="text-xs font-bold text-red-500">
          Ingrese peso o dimensiones válidas para calcular la carga cobrable.
        </p>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div
        :class="[
          'flex cursor-pointer items-center gap-3 select-none',
          collapsedStages[2] ? 'mb-0' : 'mb-5',
        ]"
        @click="toggleStage(2)"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >2</span
        >
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Vigencia y moneda</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            La vigencia se valida antes de enviar la tarifa.
          </p>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-[var(--dh-border)] p-2 text-[var(--dh-text-muted)] transition hover:bg-black/5 hover:text-[var(--dh-text)] dark:hover:bg-white/10"
          :aria-label="collapsedStages[2] ? 'Expandir etapa 2' : 'Colapsar etapa 2'"
          :title="collapsedStages[2] ? 'Expandir etapa' : 'Colapsar etapa'"
          @click.stop="toggleStage(2)"
        >
          <ChevronDown
            class="h-5 w-5 transition-transform duration-200"
            :class="collapsedStages[2] ? '' : 'rotate-180'"
          />
        </button>
      </div>
      <div v-show="!collapsedStages[2]" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DhSelect
          v-model="form.currencyId"
          :disabled="isHeaderLocked"
          label="Moneda"
          placeholder="Seleccione moneda"
          :options="catalogs.currencyOptions.value"
          :error="fieldError(form.currencyId, 'la moneda')"
        />
        <DhSelect
          v-model="form.incotermId"
          label="Incoterm"
          placeholder="Seleccione Incoterm"
          :options="catalogs.incotermOptions.value"
          :error="fieldError(form.incotermId, 'el Incoterm')"
        />
        <div>
          <DhInput v-model="form.freeDays" disabled type="number" label="Días libres" />
          <p
            class="mt-1 text-[11px] font-semibold"
            :class="
              carrierFreeDayRule
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-300'
            "
          >
            {{
              loadingFreeDays
                ? 'Consultando naviera…'
                : carrierFreeDayRule
                  ? `Automático · ${carrierFreeDayRule.carrierName}`
                  : 'Sin mapeo activo para esta naviera'
            }}
          </p>
        </div>
        <DhInput
          v-model="form.validFrom"
          :disabled="isHeaderLocked || form.rateType === 'Spot'"
          type="date"
          label="Válida desde"
          :error="form.submitted && !form.validFrom ? 'Indique la fecha.' : undefined"
        />
        <DhInput
          v-model="form.validTo"
          :disabled="isHeaderLocked || form.rateType === 'Spot'"
          type="date"
          label="Válida hasta"
          :error="
            form.submitted && (!form.validTo || form.validTo < form.validFrom)
              ? 'Revise el rango.'
              : undefined
          "
        />
        <p v-if="form.rateType === 'Spot'" class="sm:col-span-2 xl:col-span-5 text-xs font-bold text-amber-600 dark:text-amber-300">
          Las tarifas SPOT aplican únicamente para hoy; la vigencia se fija automáticamente de hoy para hoy.
        </p>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div
        :class="[
          'flex cursor-pointer items-center gap-3 select-none',
          collapsedStages[3] ? 'mb-0' : 'mb-5',
        ]"
        @click="toggleStage(3)"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >3</span
        >
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Datos y condiciones comerciales</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            Identificadores del cliente y condiciones que se mostrarán en la cotización.
          </p>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-[var(--dh-border)] p-2 text-[var(--dh-text-muted)] transition hover:bg-black/5 hover:text-[var(--dh-text)] dark:hover:bg-white/10"
          :aria-label="collapsedStages[3] ? 'Expandir etapa 3' : 'Colapsar etapa 3'"
          :title="collapsedStages[3] ? 'Expandir etapa' : 'Colapsar etapa'"
          @click.stop="toggleStage(3)"
        >
          <ChevronDown
            class="h-5 w-5 transition-transform duration-200"
            :class="collapsedStages[3] ? '' : 'rotate-180'"
          />
        </button>
      </div>
      <div v-show="!collapsedStages[3]" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DhInput v-model="form.clientName" label="Cliente" placeholder="Nombre del cliente" />
        <DhInput v-model="form.idtraNumber" label="Número IDTRA" placeholder="IDTRA-..." />
        <DhInput v-model="form.quoNumber" label="Número QUO" placeholder="QUO-..." />
        <DhSelect
          v-model="form.rateType"
          label="Tipo de tarifa"
          :options="[
            { label: 'SPOT', value: 'Spot' },
            { label: 'TARIFARIO', value: 'Tariff' },
          ]"
        />
        <DhInput
          v-model="form.transitTime"
          label="Tiempo de tránsito"
          placeholder="Ej.: 28-35 días / 4 semanas / Por confirmar"
        />
      </div>
      <div
        v-if="resolvedTermBlocks.length && !collapsedStages[3]"
        class="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
      >
        <p
          class="text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300"
        >
          Bloques automáticos aplicados
        </p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ resolvedTermBlocks.map((block) => block.name).join(' · ') }}. Los ítems siguen siendo
          editables: puede quitarlos, moverlos de categoría o agregar otros.
        </p>
      </div>
      <div v-show="!collapsedStages[3]" class="mt-4">
        <PricingTermDragBoard
          v-model="rateTermBoardValue"
          :items="rateTermItems"
          :columns="rateTermColumns"
          available-label="Disponibles"
          available-hint="Arrastre un ítem a cualquiera de las tres categorías para agregarlo a la cotización."
        />
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div
        :class="[
          'flex cursor-pointer items-center gap-3 select-none',
          collapsedStages[4] ? 'mb-0' : 'mb-5',
        ]"
        @click="toggleStage(4)"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >4</span
        >
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Construcción de la tarifa</h3>
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">
            Costo, venta y utilidad visibles por rubro. Cada concepto usa su base de cobro según la
            modalidad.
          </p>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-[var(--dh-border)] p-2 text-[var(--dh-text-muted)] transition hover:bg-black/5 hover:text-[var(--dh-text)] dark:hover:bg-white/10"
          :aria-label="collapsedStages[4] ? 'Expandir etapa 4' : 'Colapsar etapa 4'"
          :title="collapsedStages[4] ? 'Expandir etapa' : 'Colapsar etapa'"
          @click.stop="toggleStage(4)"
        >
          <ChevronDown
            class="h-5 w-5 transition-transform duration-200"
            :class="collapsedStages[4] ? '' : 'rotate-180'"
          />
        </button>
      </div>

      <div v-show="!collapsedStages[4]" class="mt-5 space-y-4">
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
                    :disabled="
                      detail.locked ||
                      detail.exwGenerated ||
                      Boolean(detail.costId) ||
                      detail.fixedDecisionCost
                    "
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
                      v-if="detail.exwGenerated"
                      label="EXW · Monto manual"
                      variant="primary"
                    />
                    <DhBadge
                      v-if="detail.fixedDecisionCost"
                      label="Valor fijo del dashboard"
                      variant="primary"
                    />
                    <DhBadge
                      :label="`${chargeBasisLabel(detail.chargeBasis)} × ${Number(detailQuantity(detail).toFixed(3))}`"
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
                  :options="selectableDetailTypeOptions"
                  :disabled="
                    detail.locked ||
                    detail.exwGenerated ||
                    Boolean(detail.costId) ||
                    detail.fixedDecisionCost
                  "
                />
                <DhInput
                  v-model="detail.costAmount"
                  type="number"
                  label="Costo"
                  placeholder="0.00"
                  :disabled="
                    detail.estimated ||
                    detail.fixedDecisionCost ||
                    detail.automaticFixed
                  "
                />
                <DhInput
                  v-model="detail.saleAmount"
                  type="number"
                  label="Venta"
                  placeholder="0.00"
                  :disabled="detail.costDetailType === 'AgentCharge' || detail.estimated"
                />
                <button
                  v-if="
                    !detail.locked &&
                    !detail.exwGenerated &&
                    !detail.importedFreight &&
                    !detail.fixedDecisionCost
                  "
                  type="button"
                  class="mt-6 rounded-2xl p-2.5 text-red-500 transition hover:bg-red-500/10"
                  title="Quitar rubro"
                  @click="removeDetail(detail)"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <div
                v-if="
                  !detail.costId &&
                  !detail.locked &&
                  !detail.fixedDecisionCost
                "
                class="mt-3 grid gap-3 md:grid-cols-[180px_220px_1fr]"
              >
                <DhSelect
                  v-model="detail.costType"
                  label="Aplicación"
                  :options="editableTypeOptions"
                />
                <DhSelect
                  v-model="detail.chargeBasis"
                  label="Base de cobro"
                  :options="chargeBasisOptions"
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

      <div
        v-show="!collapsedStages[4]"
        class="mt-5 flex justify-end border-t border-[var(--dh-border)] pt-5"
      >
        <DhButton
          label="Rubro manual"
          :icon="Plus"
          variant="secondary"
          size="sm"
          @click="addManualDetail()"
        />
      </div>

      <div v-show="!collapsedStages[4]" class="mt-6 border-t border-[var(--dh-border)] pt-5">
        <PricingMultiSelect
          v-model="optionalCostIds"
          :options="optionalOptions"
          label="Costos opcionales"
          placeholder="Seleccione costos opcionales"
        />
      </div>

      <div
        v-show="!collapsedStages[4]"
        class="mt-5 rounded-[22px] border border-sky-500/20 bg-sky-500/[0.07] p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h4 class="text-sm font-black text-[var(--dh-text)]">Seguro de carga</h4>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              Venta: 0.65% del valor de la carga, con mínimo de USD 95. Costo: 0.20%, con mínimo de
              USD 35. El porcentaje, el mínimo y la tarifa final de venta se mantienen editables.
            </p>
          </div>
          <DhBadge label="USD" variant="primary" />
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DhInput
            v-model="form.cargoValue"
            type="number"
            min="0"
            step="0.01"
            label="Valor de la carga (USD)"
            placeholder="0.00"
          />
          <div>
            <DhInput
              v-model="form.insurancePercentage"
              type="number"
              min="0"
              step="0.0001"
              label="Porcentaje de seguro"
              :disabled="!form.manualInsurancePercentage"
            />
            <label
              class="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"
            >
              <input
                v-model="form.manualInsurancePercentage"
                type="checkbox"
                class="h-4 w-4 accent-[var(--dh-primary)]"
              />
              Modificar porcentaje manualmente
            </label>
          </div>
          <div>
            <DhInput
              v-model="form.insuranceMinimumAmount"
              type="number"
              min="0"
              step="0.01"
              label="Tarifa mínima (USD)"
              :disabled="!form.manualInsuranceMinimum"
            />
            <label
              class="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"
            >
              <input
                v-model="form.manualInsuranceMinimum"
                type="checkbox"
                class="h-4 w-4 accent-[var(--dh-primary)]"
              />
              Modificar mínimo manualmente
            </label>
          </div>
          <div>
            <DhInput
              v-model="form.insuranceAmount"
              type="number"
              min="0"
              step="0.01"
              label="Tarifa de seguro (USD)"
              :disabled="!form.manualInsuranceAmount"
            />
            <label
              class="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"
            >
              <input
                v-model="form.manualInsuranceAmount"
                type="checkbox"
                class="h-4 w-4 accent-[var(--dh-primary)]"
              />
              Modificar tarifa manualmente
            </label>
          </div>
          <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3.5">
            <p
              class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
            >
              Costo / venta
            </p>
            <div v-if="Number(form.cargoValue || 0) > 0" class="mt-2 space-y-2">
              <div>
                <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Costo</p>
                <p class="text-base font-black text-[var(--dh-text)]">
                  {{ formatMoney(Number(cargoInsuranceDetail?.costAmount || 0), 'USD') }}
                </p>
                <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">
                  0.20% · mínimo USD 35
                </p>
              </div>
              <div class="border-t border-[var(--dh-border)] pt-2">
                <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Venta</p>
                <p class="text-base font-black text-[var(--dh-text)]">
                  {{ formatMoney(Number(cargoInsuranceDetail?.saleAmount || 0), 'USD') }}
                </p>
                <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">
                  Máximo entre valor × porcentaje y mínimo configurado.
                </p>
              </div>
            </div>
            <p v-else class="mt-2 text-sm font-black text-[var(--dh-text-muted)]">No aplicado</p>
          </div>
        </div>
        <p
          v-if="!(Number(form.cargoValue || 0) > 0)"
          class="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-800 dark:text-amber-300"
        >
          No se cuenta con valor real de la carga para poder aplicar seguro
        </p>
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
