<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  BadgeDollarSign,
  CheckCircle2,
  Copy,
  FileUp,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  UploadCloud,
  Trash2,
  X,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhDataTable, DhPagination, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhModal, DhPageHeader } from '@/shared/components/organisms'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { PricingService } from '@/core/services/pricingService'
import { useAuthStore } from '@/core/stores/authStore'
import { usePricingStore } from '@/core/stores/pricingStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type {
  BrowseCostsQuery,
  BrowseImportFclRatesQuery,
  BrowseRateHeadersQuery,
  CostDto,
  CreateCostRequest,
  CreateManualFclRateRequest,
  CreateRateCostDetailRequest,
  CreateRateFromImportFclRateRequest,
  ExtractImportFclRatesResultDto,
  FclRateDetailDto,
  ImportFclRateDto,
  RateCostDetailDto,
  RateHeaderDto,
} from '@/core/interfaces/pricing'

type SelectOption = { label: string; value: string | number; disabled?: boolean }
type CatalogBucket = 'ports' | 'pol' | 'poe' | 'pod' | 'containerTypes' | 'carriers' | 'currencies' | 'profiles' | 'agents' | 'incoterms'
type PricingTab = 'imports' | 'rates' | 'costs'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const pricingStore = usePricingStore()
const toastStore = useToastStore()
const {
  activeTab,
  importSearch,
  importStatus,
  importReadyDate,
  importQuoteDate,
  importAgent,
  importPol,
  importPoe,
  importPod,
  importContainerType,
  importCarrier,
  rateSearch,
  rateActive,
  rateReadyDate,
  rateQuoteDate,
  rateAgent,
  ratePol,
  ratePoe,
  ratePod,
  rateContainerType,
  rateCarrier,
  costSearch,
  uploadProfileCode,
} = storeToRefs(pricingStore)

const loading = ref(false)
const loadingCatalogs = ref(false)
const savingCost = ref(false)
const savingRate = ref(false)
const savingRateHeaderEdit = ref(false)
const deletingImports = ref(false)
const deletingRates = ref(false)
const duplicatingRate = ref(false)
const savingManualRate = ref(false)
const savingCostDetail = ref(false)
const savingFclRateEdit = ref(false)
const savingRateCostEdit = ref(false)
const deletingCost = ref(false)
const uploading = ref(false)
const dragActive = ref(false)
const uploadModalOpen = ref(false)
const costDrawerOpen = ref(false)
const importDrawerOpen = ref(false)
const rateDrawerOpen = ref(false)
const rejectModalOpen = ref(false)
const marginRejectModalOpen = ref(false)
const duplicateRateModalOpen = ref(false)
const manualRateModalOpen = ref(false)
const deleteCostModalOpen = ref(false)
const rateCostEditModalOpen = ref(false)
const fclRateEditModalOpen = ref(false)
const creatingCostFromRate = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importPage = ref(1)
const importPageSize = ref(10)
const ratePage = ref(1)
const ratePageSize = ref(10)
const selectedRatePort = ref('')
const variableCostPage = ref(1)
const variableCostPageSize = ref(10)


const selectedFile = ref<File | null>(null)
const extractionResult = ref<ExtractImportFclRatesResultDto | null>(null)
const selectedImport = ref<ImportFclRateDto | null>(null)
const selectedRate = ref<RateHeaderDto | null>(null)
const selectedImportIds = ref<string[]>([])
const selectedRateIds = ref<string[]>([])
const importToReject = ref<ImportFclRateDto | null>(null)
const marginApprovalToReject = ref<string | null>(null)
const editingCost = ref<CostDto | null>(null)
const costToDelete = ref<CostDto | null>(null)
const rateCostDetailToEdit = ref<Record<string, unknown> | null>(null)
const fclRateDetailToEdit = ref<Record<string, unknown> | null>(null)

const costs = ref<CostDto[]>([])
const imports = ref<ImportFclRateDto[]>([])
const rates = ref<RateHeaderDto[]>([])
const filterSeedImports = ref<ImportFclRateDto[]>([])
const ports = ref<CatalogItemSelectDto[]>([])
const polPorts = ref<CatalogItemSelectDto[]>([])
const poePorts = ref<CatalogItemSelectDto[]>([])
const podPorts = ref<CatalogItemSelectDto[]>([])
const containerTypes = ref<CatalogItemSelectDto[]>([])
const carriers = ref<CatalogItemSelectDto[]>([])
const currencies = ref<CatalogItemSelectDto[]>([])
const profiles = ref<CatalogItemSelectDto[]>([])
const agents = ref<CatalogItemSelectDto[]>([])
const incoterms = ref<CatalogItemSelectDto[]>([])

const SERVER_PAGE_SIZE = 200
const MAX_PAGED_REQUESTS = 100

type PricingPagedResult<T> = {
  items: T[]
  totalCount?: number
  pageNumber?: number
  pageSize?: number
}

async function fetchAllPaged<T, TQuery extends Record<string, unknown>>(
  loader: (query: TQuery) => Promise<PricingPagedResult<T>>,
  query: TQuery,
): Promise<T[]> {
  const allItems: T[] = []

  for (let pageNumber = 1; pageNumber <= MAX_PAGED_REQUESTS; pageNumber += 1) {
    const result = await loader({
      ...query,
      pageNumber,
      pageSize: SERVER_PAGE_SIZE,
    } as TQuery)

    const items = result.items ?? []
    allItems.push(...items)

    const totalCount = result.totalCount ?? allItems.length
    const effectivePageSize = result.pageSize || SERVER_PAGE_SIZE

    if (items.length === 0 || allItems.length >= totalCount || items.length < effectivePageSize) {
      break
    }
  }

  return allItems
}


const catalogSlugs = {
  ports: 'ports',
  pol: 'pol',
  poe: 'poe',
  pod: 'pod',
  containerTypes: 'containers-types',
  carriers: 'carriers',
  currencies: 'currencies',
  profiles: 'pricing-imports-profiles',
  agents: 'agents',
  incoterms: 'incoterms',
} as const

const costForm = reactive({
  name: '',
  rateType: 'Fcl',
  carrier: '',
  port: '',
  portRole: 'Pod',
  currency: '',
  amount: '',
  saleAmount: '',
  isFixed: true,
  requiresManualAmount: false,
  isOptional: false,
  costType: 'Other',
  notes: '',
})

const importRateForm = reactive({
  agentName: '',
  carrier: '',
  originPort: '',
  poePort: '',
  destinationPort: '',
  finalDestinationPort: '',
  containerType: '',
  currency: '',
  freeDays: '',
  validFrom: '',
  validTo: '',
  saleAmount: '',
  marginPercentage: '',
  notes: '',
})


const manualRateForm = reactive({
  agentName: '',
  carrier: '',
  originPort: '',
  poePort: '',
  destinationPort: '',
  finalDestinationPort: '',
  containerType: '',
  currency: '',
  amount: '',
  saleAmount: '',
  freeDays: '',
  validFrom: '',
  validTo: '',
  marginPercentage: '12',
  applyAutomaticFixedCosts: true,
  notes: '',
})

const fclRateEditForm = reactive({
  carrier: '',
  originPort: '',
  poePort: '',
  destinationPort: '',
  containerType: '',
  currency: '',
  amount: '',
  saleAmount: '',
  freeDays: '',
  validFrom: '',
  validTo: '',
  notes: '',
})

const rateCostForm = reactive({
  costId: '',
  optionalCostIds: [] as string[],
  name: '',
  costType: 'Other',
  currency: '',
  amount: '',
  saleAmount: '',
  isFixed: true,
  isManual: false,
  notes: '',
})

const rejectForm = reactive({ reason: '' })
const marginRejectForm = reactive({ reason: '' })
const duplicateRateForm = reactive({
  clientName: '',
  marginPercentage: '12',
  saleAmount: '',
})

const rateHeaderEditForm = reactive({
  clientName: '',
  validFrom: '',
  validTo: '',
})

const rateCostEditForm = reactive({
  costId: '',
  name: '',
  costType: 'Other',
  currency: '',
  amount: '',
  saleAmount: '',
  notes: '',
})

const canCreateCost = computed(() => authStore.hasScope(PRICING_SCOPES.costs.create))
const canUpdateCost = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update))
const canSetCostActive = computed(() => authStore.hasScope(PRICING_SCOPES.costs.setActive))
const canDeleteCost = computed(() => authStore.hasScope(PRICING_SCOPES.costs.delete))
const canCreateImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create))
const canApproveImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve))
const canRejectImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.reject))
const canCreateRateFromImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate))
const canDeleteImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.delete))
const canSetRateActive = computed(() => authStore.hasScope(PRICING_SCOPES.rates.setActive))
const canUpdateRate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDeleteRate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))
const canCreateRate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canCreateCostDetail = computed(() => authStore.hasScope(PRICING_SCOPES.rateCostDetails.create))
const canUpdateFclDetail = computed(() => authStore.hasScope(PRICING_SCOPES.fclRateDetails.update))
const canUpdateCostDetail = computed(() => authStore.hasScope(PRICING_SCOPES.rateCostDetails.update))
const canDeleteCostDetail = computed(() => authStore.hasScope(PRICING_SCOPES.rateCostDetails.delete))
const canApproveLowMargin = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin))
const canApproveFreight = computed(() => authStore.hasScope(PRICING_SCOPES.rates.approveFreight))
const canCreateDirectManualRate = computed(() => canCreateRate.value && (authStore.hasRole('Administrador') || authStore.hasRole('Administrator') || authStore.hasRole('Admin') || authStore.hasRole('SuperUsuario') || authStore.hasRole('SuperUser') || authStore.hasRole('SuperAdmin') || authStore.hasRole('superadmin')))
const showCostRowActions = computed(() => canUpdateCost.value || canSetCostActive.value || canDeleteCost.value)


const routeTabMap: Record<string, PricingTab> = {
  '/pricing': 'rates',
  '/pricing/imports': 'imports',
  '/pricing/rates': 'rates',
  '/pricing/costs': 'costs',
}

function resolveTabFromRoute(path: string): PricingTab {
  return routeTabMap[path] ?? 'rates'
}

function routeForTab(tab: PricingTab): string {
  if (tab === 'imports') return '/pricing/imports'
  if (tab === 'costs') return '/pricing/costs'
  return '/pricing'
}

function setPricingTab(tab: PricingTab) {
  activeTab.value = tab
}

const pricingSectionMeta = computed(() => {
  const tab = (activeTab.value as PricingTab) || 'rates'
  if (tab === 'imports') {
    return {
      title: t('pricing.imports.title'),
      accent: t('pricing.sectionOverview'),
    }
  }

  if (tab === 'costs') {
    return {
      title: t('pricing.costs.title'),
      accent: t('sidebar.costs'),
    }
  }

  return {
    title: t('pricing.rates.title'),
    accent: t('sidebar.pricingPanel'),
  }
})

const stats = computed(() => [
  { key: 'pending', label: t('pricing.kpis.pendingImports'), value: imports.value.filter((x) => x.status === 'PendingReview').length },
  { key: 'rates', label: t('pricing.kpis.activeRates'), value: rates.value.filter((x) => x.isActive).length },
  { key: 'costs', label: t('pricing.kpis.activeCosts'), value: costs.value.filter((x) => x.isActive).length },
])

const pricingTabs = computed(() => [
  { value: 'rates' as PricingTab, label: t('pricing.tabs.rates'), count: rates.value.length, visible: authStore.hasScope(PRICING_SCOPES.rates.view) },
  { value: 'imports' as PricingTab, label: t('pricing.tabs.imports'), count: imports.value.length, visible: authStore.hasScope(PRICING_SCOPES.importFclRates.view) },
  { value: 'costs' as PricingTab, label: t('pricing.tabs.costs'), count: costs.value.length, visible: authStore.hasScope(PRICING_SCOPES.costs.view) },
].filter((tab) => tab.visible))

const costColumns = computed<DhTableColumn<CostDto>[]>(() => {
  const columns: DhTableColumn<CostDto>[] = [
    { key: 'name', label: t('pricing.costs.columns.name') },
    { key: 'rateType', label: t('pricing.common.rateType') },
    { key: 'carrierNameSnapshot', label: t('pricing.common.carrier') },
    { key: 'portNameSnapshot', label: t('pricing.common.port') },
    { key: 'portRole', label: t('pricing.common.portRole') },
    { key: 'requiresManualAmount', label: t('pricing.common.manualAmount'), align: 'center' },
    { key: 'amount', label: 'Costo', align: 'right' },
    { key: 'saleAmount', label: 'Venta', align: 'right' },
    { key: 'isActive', label: t('common.status'), align: 'center' },
  ]

  if (showCostRowActions.value) {
    columns.push({ key: '__actions', label: '', width: '132px', align: 'right' })
  }

  return columns
})

const importColumns = computed<DhTableColumn<ImportFclRateDto>[]>(() => [
  { key: '__select', label: '', width: '48px', align: 'center' },
  { key: 'carrier', label: t('pricing.common.carrier') },
  { key: 'pol', label: t('pricing.common.pol') },
  { key: 'poe', label: 'POE' },
  { key: 'pod', label: t('pricing.common.pod') },
  { key: 'containerType', label: t('pricing.common.container') },
  { key: 'amount', label: 'Costo', align: 'right' },
  { key: 'freeDays', label: 'Días libres', align: 'center' },
  { key: 'usedAsRateCount', label: 'Usos', align: 'center' },
  { key: 'validFrom', label: t('pricing.common.validFrom') },
  { key: 'validTo', label: t('pricing.common.validTo') },
  { key: 'status', label: t('common.status'), align: 'center' },
  { key: '__actions', label: '', width: '88px', align: 'right' },
])

const rateColumns = computed<DhTableColumn<RateHeaderDto>[]>(() => [
  { key: '__select', label: '', width: '48px', align: 'center' },
  { key: 'clientNameSnapshot', label: 'Agente' },
  { key: 'mainRoute', label: t('pricing.common.route') },
  { key: 'carrier', label: t('pricing.common.carrier') },
  { key: 'totalCostAmount', label: t('pricing.rates.totalCost'), align: 'right' },
  { key: 'saleAmount', label: t('pricing.rates.sale'), align: 'right' },
  { key: 'marginPercentage', label: 'Margen actual', align: 'right' },
  { key: 'status', label: t('common.status'), align: 'center' },
  { key: '__actions', label: '', width: '88px', align: 'right' },
])

const fclDetailColumns = computed<DhTableColumn<Record<string, unknown>>[]>(() => [
  { key: 'carrierNameSnapshot', label: t('pricing.common.carrier') },
  { key: 'route', label: t('pricing.common.route') },
  { key: 'containerTypeNameSnapshot', label: t('pricing.common.container') },
  { key: 'amount', label: 'Costo', align: 'right' },
  { key: '__actions', label: '', width: '80px', align: 'right' },
])

const costDetailColumns = computed<DhTableColumn<Record<string, unknown>>[]>(() => [
  { key: 'name', label: t('pricing.costs.columns.name') },
  { key: 'costType', label: t('pricing.common.costType') },
  { key: 'isFixed', label: t('pricing.common.fixed'), align: 'center' },
  { key: 'isManual', label: t('pricing.common.manual'), align: 'center' },
  { key: 'amount', label: 'Costo', align: 'right' },
  { key: 'saleAmount', label: 'Venta', align: 'right' },
  { key: 'profit', label: 'Utilidad', align: 'right' },
  { key: '__actions', label: '', width: '80px', align: 'right' },
])

const catalogOptions = computed<Record<CatalogBucket, SelectOption[]>>(() => ({
  ports: toOptions(ports.value),
  pol: toOptions(polPorts.value),
  poe: toOptions(poePorts.value),
  pod: toOptions(podPorts.value),
  containerTypes: toOptions(containerTypes.value),
  carriers: toOptions(carriers.value),
  currencies: toOptions(currencies.value),
  profiles: toOptions(profiles.value),
  agents: agentOptions.value,
  incoterms: toOptions(incoterms.value),
}))

const portFilterOptions = computed<SelectOption[]>(() => withAllFilterOption(toCatalogFilterOptions([...polPorts.value, ...poePorts.value, ...podPorts.value, ...ports.value])))
const carrierFilterOptions = computed<SelectOption[]>(() => withAllFilterOption(toCatalogFilterOptions(carriers.value)))
const containerTypeFilterOptions = computed<SelectOption[]>(() => withAllFilterOption(toCatalogFilterOptions(containerTypes.value)))
const agentOptions = computed<SelectOption[]>(() => uniqueFilterOptions([
  ...agents.value.map((item) => ({ label: item.label, value: item.label })),
  { label: 'WWL', value: 'WWL' },
  { label: 'RS', value: 'RS' },
]))
const agentFilterOptions = computed<SelectOption[]>(() => withAllFilterOption(uniqueFilterOptions([...agentOptions.value, ...toRawFilterOptions('agent')])))
const poeFilterOptions = computed<SelectOption[]>(() =>
  withAllFilterOption(uniqueFilterOptions([
    ...toCatalogFilterOptions(poePorts.value.length ? poePorts.value : ports.value),
    ...toRawFilterOptions('poe'),
  ])),
)

const statusOptions = computed<SelectOption[]>(() => [
  { label: t('common.all'), value: '' },
  { label: t('pricing.status.PendingReview'), value: 'PendingReview' },
  { label: t('pricing.status.Approved'), value: 'Approved' },
  { label: t('pricing.status.Rejected'), value: 'Rejected' },
  { label: t('pricing.status.ImportedOnly'), value: 'ImportedOnly' },
])

const activeOptions = computed<SelectOption[]>(() => [
  { label: t('common.all'), value: '' },
  { label: t('common.active'), value: 'true' },
  { label: t('common.inactive'), value: 'false' },
])

const rateTypeOptions = computed<SelectOption[]>(() => [
  { label: 'FCL', value: 'Fcl' },
  { label: 'LCL', value: 'Lcl' },
  { label: 'FTL', value: 'Ftl' },
  { label: 'LTL', value: 'Ltl' },
])

const portRoleOptions = computed<SelectOption[]>(() => [
  { label: t('pricing.portRoles.Any'), value: 'Any' },
  { label: t('pricing.portRoles.Pol'), value: 'Pol' },
  { label: t('pricing.portRoles.Pod'), value: 'Pod' },
])

const costTypeOptions = computed<SelectOption[]>(() => [
  { label: t('pricing.costTypes.Freight'), value: 'Freight' },
  { label: t('pricing.costTypes.OriginCharge'), value: 'OriginCharge' },
  { label: t('pricing.costTypes.DestinationCharge'), value: 'DestinationCharge' },
  { label: t('pricing.costTypes.PortCharge'), value: 'PortCharge' },
  { label: t('pricing.costTypes.CustomsCharge'), value: 'CustomsCharge' },
  { label: t('pricing.costTypes.InlandTransport'), value: 'InlandTransport' },
  { label: 'Costo agente', value: 'AgentCharge' },
  { label: t('pricing.costTypes.Documentation'), value: 'Documentation' },
  { label: t('pricing.costTypes.Insurance'), value: 'Insurance' },
  { label: t('pricing.costTypes.Other'), value: 'Other' },
])

const costTemplateOptions = computed<SelectOption[]>(() =>
  costs.value.map((x) => ({
    label: [
      x.name,
      String(x.rateType).toUpperCase(),
      x.isOptional ? 'Opcional' : x.isFixed && !x.requiresManualAmount
        ? `${x.carrierNameSnapshot || t('pricing.common.notLinked')} · ${x.portNameSnapshot || t('pricing.portRoles.Any')}`
        : t('pricing.costs.variableTemplate'),
      money(x.amount, x.currencyCodeSnapshot),
      `${t('pricing.rates.saleAmount')}: ${money(x.saleAmount ?? minimumSaleAmount(Number(x.amount ?? 0)), x.currencyCodeSnapshot)}`,
    ].join(' · '),
    value: x.id,
  })),
)

function toCostTemplateOptions(rows: CostDto[]): SelectOption[] {
  return rows.map((x) => ({
    label: [
      x.name,
      String(x.rateType).toUpperCase(),
      x.isOptional ? 'Opcional' : (x.carrierNameSnapshot || t('pricing.common.notLinked')),
      money(x.amount, x.currencyCodeSnapshot),
      `Venta: ${money(x.saleAmount ?? 0, x.currencyCodeSnapshot)}`,
    ].join(' · '),
    value: x.id,
  }))
}

const automaticFixedCosts = computed(() => costs.value.filter((x) => x.isFixed && !x.requiresManualAmount && !x.isOptional))
const optionalCostTemplates = computed(() => costs.value.filter((x) => x.isOptional))
const variableCostTemplates = computed(() => costs.value.filter((x) => x.isOptional || !x.isFixed || x.requiresManualAmount))
const isAutomaticFixedCost = computed(() => costForm.isFixed && !costForm.requiresManualAmount && !costForm.isOptional)
const fixedCostTemplateOptions = computed<SelectOption[]>(() => toCostTemplateOptions(automaticFixedCosts.value))
const costPortOptions = computed<SelectOption[]>(() => {
  if (costForm.portRole === 'Pol') return catalogOptions.value.pol
  if (costForm.portRole === 'Pod') return catalogOptions.value.pod

  return catalogOptions.value.ports
})
const optionalCostTemplateOptions = computed<SelectOption[]>(() => {
  const detail = selectedRateMainDetail.value
  const selectedCarrierId = detail?.carrierId
  const destinationIds = new Set<string>([
    String(detail?.destinationPortId ?? ''),
    ...selectedRateCostRows.value.map((row) => String(row.portId ?? '')).filter(Boolean),
  ].filter(Boolean))

  return toCostTemplateOptions(optionalCostTemplates.value.filter((cost) => {
    const matchesCarrier = !cost.carrierId || !selectedCarrierId || cost.carrierId === selectedCarrierId
    const matchesPort = !cost.portId || destinationIds.size === 0 || destinationIds.has(cost.portId)
    return matchesCarrier && matchesPort
  }))
})

function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, (page - 1) * pageSize)
  return rows.slice(start, start + pageSize)
}

const pagedImports = computed(() => paginateRows(imports.value, importPage.value, importPageSize.value))
const filteredMatrixRates = computed(() => {
  if (!selectedRatePort.value) return rates.value
  return rates.value.filter((rate) => ratePortKey(rate) === selectedRatePort.value)
})
const pagedRates = computed(() => paginateRows(filteredMatrixRates.value, ratePage.value, ratePageSize.value))
const pagedVariableCostTemplates = computed(() => paginateRows(variableCostTemplates.value, variableCostPage.value, variableCostPageSize.value))

const selectedRateMainDetail = computed(() => selectedRate.value?.fclRateDetails?.[0] ?? null)
const selectedRateFclRows = computed<Record<string, unknown>[]>(() => (selectedRate.value?.fclRateDetails ?? []) as unknown as Record<string, unknown>[])
const selectedRateCostRows = computed<Record<string, unknown>[]>(() => (selectedRate.value?.costDetails ?? []) as unknown as Record<string, unknown>[])
const selectedRateAgentCostRows = computed<Record<string, unknown>[]>(() =>
  selectedRateCostRows.value.filter((row) => String(row.costType) === 'AgentCharge' || normalizeLookup(String(row.name ?? '')).includes('agente') || normalizeLookup(String(row.name ?? '')).includes('agent')),
)
const selectedRateDestinationCostRows = computed<Record<string, unknown>[]>(() =>
  selectedRateCostRows.value.filter((row) => String(row.costType) === 'DestinationCharge' || String(row.costType) === 'InlandTransport'),
)
const selectedRateOtherCostRows = computed<Record<string, unknown>[]>(() =>
  selectedRateCostRows.value.filter((row) => !selectedRateAgentCostRows.value.includes(row) && !selectedRateDestinationCostRows.value.includes(row)),
)
const selectedRateBaseSaleAmount = computed(() => (selectedRate.value ? rateFreightSaleTotal(selectedRate.value) : 0))
const clientVisibleCostRows = computed<Record<string, unknown>[]>(() =>
  selectedRateCostRows.value.filter((row) => costSaleAmount(row) > 0),
)
const selectedRateProfit = computed(() => (selectedRate.value ? rateProfit(selectedRate.value) : 0))
const canPrintSelectedRate = computed(() => Boolean(selectedRate.value?.isActive))
const quoteDateLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'es-CR').format(new Date()),
)

const matrixPortOptions = computed(() => {
  const seen = new Map<string, { label: string; value: string; count: number }>()

  for (const rate of rates.value) {
    const key = ratePortKey(rate)
    const label = ratePortLabel(rate)
    const current = seen.get(key)

    if (current) {
      current.count += 1
    } else {
      seen.set(key, { label, value: key, count: 1 })
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
})

const automaticCostPortGroups = computed(() => {
  const groups = new Map<string, { key: string; label: string; rows: CostDto[]; totalCost: number; totalSale: number }>()

  for (const cost of automaticFixedCosts.value) {
    const label = cost.portNameSnapshot || cost.portCodeSnapshot || t('pricing.common.notLinked')
    const key = normalizeLookup(label) || 'not-linked'
    const group = groups.get(key) ?? { key, label, rows: [], totalCost: 0, totalSale: 0 }
    const amount = Number(cost.amount ?? 0)
    const sale = Number(cost.saleAmount ?? minimumSaleAmount(amount))

    group.rows.push(cost)
    group.totalCost += Number.isFinite(amount) ? amount : 0
    group.totalSale += Number.isFinite(sale) ? sale : 0
    groups.set(key, group)
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort((a, b) => `${a.carrierNameSnapshot || ''}${a.name}`.localeCompare(`${b.carrierNameSnapshot || ''}${b.name}`)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

watch([
  importSearch,
  importStatus,
  importReadyDate,
  importQuoteDate,
  importAgent,
  importPol,
  importPoe,
  importPod,
  importContainerType,
  importCarrier,
], () => {
  importPage.value = 1
})

watch([
  rateSearch,
  rateActive,
  rateReadyDate,
  rateQuoteDate,
  rateAgent,
  ratePol,
  ratePoe,
  ratePod,
  rateContainerType,
  rateCarrier,
  selectedRatePort,
], () => {
  ratePage.value = 1
})

watch(matrixPortOptions, (options) => {
  if (selectedRatePort.value && !options.some((option) => option.value === selectedRatePort.value)) {
    selectedRatePort.value = ''
  }
})

watch(costSearch, () => {
  variableCostPage.value = 1
})

watch(() => route.path, (path) => {
  const nextTab = resolveTabFromRoute(path)
  if (activeTab.value !== nextTab) {
    activeTab.value = nextTab
  }
}, { immediate: true })

watch([
  activeTab,
  importSearch,
  importStatus,
  importReadyDate,
  importQuoteDate,
  importAgent,
  importPol,
  importPoe,
  importPod,
  importContainerType,
  importCarrier,
  rateSearch,
  rateActive,
  rateReadyDate,
  rateQuoteDate,
  rateAgent,
  ratePol,
  ratePoe,
  ratePod,
  rateContainerType,
  rateCarrier,
  costSearch,
  uploadProfileCode,
], () => {
  pricingStore.persist()
  const target = routeForTab((activeTab.value as PricingTab) || 'rates')
  if (route.path !== target) {
    router.replace(target)
  }
})

watch(isAutomaticFixedCost, () => {
  if (!costForm.portRole || costForm.portRole === 'Any') {
    costForm.portRole = 'Pod'
  }
})

function toOptions(items: CatalogItemSelectDto[]): SelectOption[] {
  return items.map((x) => ({ label: x.label, value: x.value }))
}

function defaultAgentName(): string {
  const wwl = agentOptions.value.find((option) => normalizeLookup(String(option.value)) === 'wwl')?.value
  const rs = agentOptions.value.find((option) => normalizeLookup(String(option.value)) === 'rs')?.value

  return String(wwl || rs || 'WWL')
}

function catalogSearchValue(item: CatalogItemSelectDto): string {
  return String(item.label || item.code || item.slug || item.value || item.id || '').trim()
}

function toCatalogFilterOptions(items: CatalogItemSelectDto[]): SelectOption[] {
  return uniqueFilterOptions(
    items
      .map((item) => ({ label: item.label, value: catalogSearchValue(item) }))
      .filter((option) => String(option.value).trim()),
  )
}

function withAllFilterOption(options: SelectOption[]): SelectOption[] {
  return [{ label: t('common.all'), value: '' }, ...options]
}

function uniqueFilterOptions(options: SelectOption[]): SelectOption[] {
  const seen = new Set<string>()
  const result: SelectOption[] = []

  for (const option of options) {
    const key = normalizeLookup(String(option.value))
    if (!key || seen.has(key)) continue

    seen.add(key)
    result.push(option)
  }

  return result.sort((a, b) => String(a.label).localeCompare(String(b.label)))
}

type RawFilterField = 'agent' | 'poe'

function toRawFilterOptions(field: RawFilterField): SelectOption[] {
  const values = new Map<string, string>()

  for (const row of filterSeedImports.value) {
    const value = readRawFilterValue(row.rawDataJson, field)
    if (!value) continue

    const key = normalizeLookup(value)
    if (!key || values.has(key)) continue
    values.set(key, value)
  }

  return Array.from(values.values()).map((value) => ({ label: value, value }))
}

function readRawFilterValue(rawDataJson: string | null | undefined, field: RawFilterField): string | null {
  if (!rawDataJson?.trim()) return null

  const aliases = field === 'agent'
    ? ['agent', 'agente', 'forwarder', 'agentName', 'salesAgent', 'customerAgent']
    : ['poe', 'portOfExit', 'port of exit', 'puertoSalida', 'puerto de salida', 'portExit']

  try {
    return findValueByAliases(JSON.parse(rawDataJson), aliases)
  } catch {
    return findRawTextValue(rawDataJson, aliases)
  }
}

function importPoeLabel(row: ImportFclRateDto): string {
  return readRawFilterValue(row.rawDataJson, 'poe') || '—'
}

function findValueByAliases(value: unknown, aliases: string[]): string | null {
  const normalizedAliases = aliases.map(normalizeLookup)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByAliases(item, aliases)
      if (found) return found
    }

    return null
  }

  if (!value || typeof value !== 'object') return null

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (normalizedAliases.includes(normalizeLookup(key)) && raw != null && typeof raw !== 'object') {
      const text = String(raw).trim()
      if (text) return text
    }
  }

  for (const raw of Object.values(value as Record<string, unknown>)) {
    const found = findValueByAliases(raw, aliases)
    if (found) return found
  }

  return null
}

function readPoeFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const match = notes.match(/POE\s*:\s*([^\n]+)/i)
  return match?.[1]?.trim() || null
}

function mergePoeIntoNotes(notes: string | null, poeLabel: string | null): string | null {
  const base = (notes ?? '').replace(/^POE\s*:\s*.*$/gim, '').trim()
  const poe = poeLabel?.trim()
  return [base, poe ? `POE: ${poe}` : null].filter(Boolean).join('\n') || null
}

function findRawTextValue(raw: string, aliases: string[]): string | null {
  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`"?${escapedAlias}"?\\s*[:=]\\s*"?([^",;}{\\n]+)`, 'i')
    const match = raw.match(pattern)
    const text = match?.[1]?.trim()
    if (text) return text
  }

  return null
}

function selectedItem(bucket: CatalogBucket, value: string): CatalogItemSelectDto | null {
  const map = { ports, pol: polPorts, poe: poePorts, pod: podPorts, containerTypes, carriers, currencies, profiles, agents, incoterms }
  return map[bucket].value.find((x) => x.value === value || x.slug === value || x.id === value || x.code === value) ?? null
}

function normalizeLookup(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

function lookupAliases(bucket: CatalogBucket, value: string | null | undefined): string[] {
  const normalized = normalizeLookup(value)
  const aliases: Record<CatalogBucket, Record<string, string[]>> = {
    carriers: {
      msk: ['maersk', 'maerskline'],
      maersk: ['msk', 'maerskline'],
      pil: ['pacificinternationallines'],
      oocl: ['orientoverseascontainerline'],
    },
    ports: {
      chinabaseports: ['ningbo', 'shanghai', 'qingdao'],
      ningboshanghaiqingdao: ['ningbo', 'shanghai', 'qingdao'],
      colonmanzanillo: ['colon', 'manzanillo'],
    },
    containerTypes: {
      '20': ['20dv', '20gp', '20dc', '20ft'],
      '20gp': ['20dv', '20dc', '20ft'],
      '40': ['40hc', '40hq', '40gp', '40dv', '40dc', '40ft'],
      '4040hc': ['40hc', '40hq', '40gp'],
      '40hc': ['40hq', '4040hc'],
      '40hq': ['40hc', '4040hc'],
    },
    currencies: {
      usd: ['dolar', 'dolares', 'usdolars', 'usdcurrency'],
      crc: ['colon', 'colones'],
    },
    profiles: {},
    pol: {},
    poe: {},
    pod: {},
    agents: {},
    incoterms: {},
  }

  return [normalized, ...(aliases[bucket][normalized] ?? [])].filter(Boolean)
}

function candidateValues(item: CatalogItemSelectDto): string[] {
  return [item.value, item.label, item.code, item.slug, item.id]
    .map((x) => normalizeLookup(String(x ?? '')))
    .filter(Boolean)
}

function findItemByText(bucket: CatalogBucket, value: string | null | undefined): CatalogItemSelectDto | null {
  const map = { ports, pol: polPorts, poe: poePorts, pod: podPorts, containerTypes, carriers, currencies, profiles, agents, incoterms }
  const items = map[bucket].value
  const needles = lookupAliases(bucket, value)

  if (needles.length === 0) return null

  return (
    items.find((item) => candidateValues(item).some((candidate) => needles.includes(candidate)))
    ?? items.find((item) => candidateValues(item).some((candidate) => needles.some((needle) => candidate.startsWith(needle) || needle.startsWith(candidate))))
    ?? items.find((item) => candidateValues(item).some((candidate) => needles.some((needle) => candidate.includes(needle) || needle.includes(candidate))))
    ?? null
  )
}

function catalogFormValue(bucket: CatalogBucket, ...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (!value) continue

    const exact = selectedItem(bucket, String(value))
    if (exact) return exact.value

    const byText = findItemByText(bucket, String(value))
    if (byText) return byText.value
  }

  return ''
}

function money(value: unknown, currency = 'USD') {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  return new Intl.NumberFormat(locale.value === 'en' ? 'en-US' : 'es-CR', { style: 'currency', currency }).format(amount)
}

function percent(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return `${number.toFixed(2)}%`
}

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

function nullableDate(value: string): string | null {
  return value ? value : null
}

function eventChecked(event: Event): boolean {
  return (event.target as HTMLInputElement | null)?.checked ?? false
}

function minimumSaleAmount(totalCost: number, margin = 12): number {
  if (!Number.isFinite(totalCost) || totalCost <= 0 || margin >= 100) return 0
  return Number((totalCost / (1 - margin / 100)).toFixed(2))
}

function statusVariant(status: string | boolean | undefined): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === true || status === 'Active' || status === 'Approved' || status === 'CreatedAsRate' || status === 'online') return 'success'
  if (status === 'PendingReview' || status === 'Pending' || status === 'Draft' || status === 'ImportedOnly' || status === 'PendingApproval' || status === 'unknown') return 'warning'
  if (status === false || status === 'Inactive' || status === 'Rejected' || status === 'ApprovalRejected' || status === 'Deleted' || status === 'offline') return 'danger'
  return 'neutral'
}

function statusLabel(status: string | boolean | undefined) {
  if (status === true) return t('common.active')
  if (status === false) return t('common.inactive')
  if (!status) return '—'
  const key = `pricing.status.${status}`
  const translated = t(key)
  return translated === key ? String(status) : translated
}

function costTypeLabel(type: string | undefined) {
  if (!type) return '—'
  const key = `pricing.costTypes.${type}`
  const translated = t(key)
  return translated === key ? type : translated
}

function routeLabel(rate: RateHeaderDto): string {
  const detail = rate.fclRateDetails?.[0]
  if (!detail) return '—'
  return [
    detail.originPortNameSnapshot || detail.originPortCodeSnapshot,
    readPoeFromNotes(String(detail.notes ?? '')),
    detail.destinationPortNameSnapshot || detail.destinationPortCodeSnapshot,
  ].filter(Boolean).join(' → ')
}

function carrierLabel(rate: RateHeaderDto): string {
  return rate.fclRateDetails?.[0]?.carrierNameSnapshot ?? '—'
}

function ratePortLabel(rate: RateHeaderDto): string {
  const detail = rate.fclRateDetails?.[0]
  return detail?.destinationPortNameSnapshot || detail?.destinationPortCodeSnapshot || t('pricing.common.destination')
}

function ratePortKey(rate: RateHeaderDto): string {
  return normalizeLookup(ratePortLabel(rate)) || 'unknown'
}

function originLabel(rate: RateHeaderDto): string {
  const detail = rate.fclRateDetails?.[0]
  return detail?.originPortNameSnapshot || detail?.originPortCodeSnapshot || '—'
}

function containerLabel(rate: RateHeaderDto): string {
  const detail = rate.fclRateDetails?.[0]
  return detail?.containerTypeNameSnapshot || detail?.containerTypeCodeSnapshot || String(rate.rateType || 'FCL').toUpperCase()
}

function rowAmount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function rateProfit(rate: RateHeaderDto): number {
  return rowAmount(rate.saleAmount) - rowAmount(rate.totalCostAmount)
}

function rateFreightCostTotal(rate: RateHeaderDto): number {
  return (rate.fclRateDetails ?? []).reduce((total, detail) => total + rowAmount(detail.amount), 0)
}

function rateCostSaleTotal(rate: RateHeaderDto): number {
  return (rate.costDetails ?? []).reduce((total, detail) => total + rateCostDetailSaleAmount(detail), 0)
}

function rateFreightSaleTotal(rate: RateHeaderDto): number {
  return Math.max(0, rowAmount(rate.saleAmount) - rateCostSaleTotal(rate))
}


function fclDetailSaleAmount(rate: RateHeaderDto, detail: FclRateDetailDto): number {
  const explicitSale = rowAmount(detail.saleAmount)
  if (detail.saleAmount !== null && detail.saleAmount !== undefined && explicitSale > 0) return explicitSale

  const freightSale = rateFreightSaleTotal(rate)
  const freightCost = rateFreightCostTotal(rate)
  const fclCount = Math.max(1, rate.fclRateDetails?.length ?? 1)

  if (freightCost <= 0) return Number((freightSale / fclCount).toFixed(2))

  return Number(((freightSale * rowAmount(detail.amount)) / freightCost).toFixed(2))
}

function rateCostDetailSaleAmount(detail: RateCostDetailDto | Record<string, unknown>): number {
  return rowAmount(detail.saleAmount)
}

function costProfit(cost: CostDto): number {
  return rowAmount(cost.saleAmount ?? minimumSaleAmount(rowAmount(cost.amount))) - rowAmount(cost.amount)
}

function rateMatrixRows(rate: RateHeaderDto) {
  const fclRows = (rate.fclRateDetails ?? []).map((detail, index) => {
    const cost = rowAmount(detail.amount)
    const sale = fclDetailSaleAmount(rate, detail)

    return {
      key: `fcl-${detail.id || index}`,
      name: t('pricing.matrix.oceanFreight'),
      meta: [
        detail.originPortNameSnapshot || detail.originPortCodeSnapshot,
        readPoeFromNotes(String(detail.notes ?? '')),
        detail.destinationPortNameSnapshot || detail.destinationPortCodeSnapshot,
      ].filter(Boolean).join(' → '),
      type: detail.containerTypeNameSnapshot || detail.containerTypeCodeSnapshot || String(rate.rateType).toUpperCase(),
      cost,
      sale,
      currency: detail.currencyCodeSnapshot || rate.currencyCodeSnapshot || 'USD',
      editable: true,
    }
  })

  const costRows = (rate.costDetails ?? []).map((detail, index) => ({
    key: `cost-${detail.id || index}`,
    name: detail.name,
    meta: costTypeLabel(detail.costType),
    type: detail.isManual ? t('pricing.common.manual') : t('pricing.common.automatic'),
    cost: rowAmount(detail.amount),
    sale: rateCostDetailSaleAmount(detail),
    currency: detail.currencyCodeSnapshot || rate.currencyCodeSnapshot || 'USD',
    editable: true,
  }))

  return [...fclRows, ...costRows]
}

function snapshot(bucket: CatalogBucket, value: string, fieldLabel: string) {
  const item = selectedItem(bucket, value)
  if (!item) throw new Error(t('pricing.validation.selectRequired', { field: fieldLabel }))
  return item
}

function resetCostForm(cost?: CostDto) {
  editingCost.value = cost ?? null
  costForm.name = cost?.name ?? ''
  costForm.rateType = cost?.rateType ?? 'Fcl'
  costForm.carrier = catalogFormValue('carriers', cost?.carrierId, cost?.carrierCodeSnapshot, cost?.carrierNameSnapshot)
  costForm.port = catalogFormValue('ports', cost?.portId, cost?.portCodeSnapshot, cost?.portNameSnapshot)
  costForm.portRole = cost?.portRole ?? 'Pod'
  costForm.currency = catalogFormValue('currencies', cost?.currencyId, cost?.currencyCodeSnapshot, cost?.currencyNameSnapshot)
  costForm.amount = cost ? String(cost.amount) : ''
  costForm.saleAmount = cost ? String(cost.saleAmount ?? minimumSaleAmount(Number(cost.amount ?? 0))) : ''
  costForm.isFixed = cost?.isFixed ?? true
  costForm.requiresManualAmount = cost?.requiresManualAmount ?? false
  costForm.isOptional = cost?.isOptional ?? false
  costForm.costType = 'Other'
  costForm.notes = cost?.notes ?? ''
}

function resetRateCostForm() {
  rateCostForm.costId = ''
  rateCostForm.optionalCostIds = []
  rateCostForm.name = ''
  rateCostForm.costType = 'Other'
  rateCostForm.currency = findItemByText('currencies', selectedRate.value?.currencyCodeSnapshot)?.value ?? ''
  rateCostForm.amount = ''
  rateCostForm.saleAmount = ''
  rateCostForm.isFixed = true
  rateCostForm.isManual = false
  rateCostForm.notes = ''
}

function resetDuplicateRateForm() {
  duplicateRateForm.clientName = selectedRate.value?.clientNameSnapshot ?? ''
  duplicateRateForm.marginPercentage = selectedRate.value?.marginPercentage ? String(selectedRate.value.marginPercentage) : '12'
  duplicateRateForm.saleAmount = ''
}


function resetManualRateForm() {
  manualRateForm.agentName = defaultAgentName()
  manualRateForm.carrier = ''
  manualRateForm.originPort = ''
  manualRateForm.poePort = ''
  manualRateForm.destinationPort = ''
  manualRateForm.finalDestinationPort = ''
  manualRateForm.containerType = ''
  manualRateForm.currency = findItemByText('currencies', 'USD')?.value ?? ''
  manualRateForm.amount = ''
  manualRateForm.freeDays = ''
  manualRateForm.validFrom = ''
  manualRateForm.validTo = ''
  manualRateForm.saleAmount = ''
  manualRateForm.marginPercentage = '12'
  manualRateForm.applyAutomaticFixedCosts = true
  manualRateForm.notes = ''
}

function resetFclRateEditForm(row?: Record<string, unknown> | null) {
  const validFrom = row?.validFrom
  const validTo = row?.validTo

  fclRateEditForm.carrier = catalogFormValue('carriers', String(row?.carrierId ?? ''), String(row?.carrierCodeSnapshot ?? ''), String(row?.carrierNameSnapshot ?? ''))
  fclRateEditForm.originPort = catalogFormValue('pol', String(row?.originPortId ?? ''), String(row?.originPortCodeSnapshot ?? ''), String(row?.originPortNameSnapshot ?? ''))
  fclRateEditForm.poePort = catalogFormValue('poe', readPoeFromNotes(String(row?.notes ?? '')))
  fclRateEditForm.destinationPort = catalogFormValue('pod', String(row?.destinationPortId ?? ''), String(row?.destinationPortCodeSnapshot ?? ''), String(row?.destinationPortNameSnapshot ?? ''))
  fclRateEditForm.containerType = catalogFormValue('containerTypes', String(row?.containerTypeId ?? ''), String(row?.containerTypeCodeSnapshot ?? ''), String(row?.containerTypeNameSnapshot ?? ''))
  fclRateEditForm.currency = catalogFormValue('currencies', String(row?.currencyId ?? ''), String(row?.currencyCodeSnapshot ?? selectedRate.value?.currencyCodeSnapshot ?? 'USD'), String(row?.currencyNameSnapshot ?? ''))
  fclRateEditForm.amount = String(row?.amount ?? '')
  fclRateEditForm.saleAmount = selectedRate.value ? String(rateFreightSaleTotal(selectedRate.value)) : ''
  fclRateEditForm.freeDays = row?.freeDays == null ? '' : String(row.freeDays)
  fclRateEditForm.validFrom = typeof validFrom === 'string' ? validFrom.slice(0, 10) : ''
  fclRateEditForm.validTo = typeof validTo === 'string' ? validTo.slice(0, 10) : ''
  fclRateEditForm.notes = String(row?.notes ?? '')
}

function resetRateHeaderEditForm() {
  rateHeaderEditForm.clientName = selectedRate.value?.clientNameSnapshot ?? ''
  rateHeaderEditForm.validFrom = selectedRate.value?.validFrom?.slice(0, 10) ?? ''
  rateHeaderEditForm.validTo = selectedRate.value?.validTo?.slice(0, 10) ?? ''
}


async function loadCatalogSelects() {
  loadingCatalogs.value = true
  try {
    const [portItems, polItems, poeItems, podItems, containerItems, carrierItems, currencyItems, profileItems, agentItems, incotermItems] = await Promise.all([
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.ports }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.pol }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.poe }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.pod }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.containerTypes }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.carriers }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.currencies }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.profiles }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.agents }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.incoterms }),
    ])

    ports.value = portItems
    polPorts.value = polItems.length ? polItems : portItems
    poePorts.value = poeItems.length ? poeItems : portItems
    podPorts.value = podItems.length ? podItems : portItems
    containerTypes.value = containerItems
    carriers.value = carrierItems
    currencies.value = currencyItems
    profiles.value = profileItems
    agents.value = agentItems
    incoterms.value = incotermItems
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.catalogsLoadError'))
  } finally {
    loadingCatalogs.value = false
  }
}

async function loadCosts() {
  const query: BrowseCostsQuery = { search: nullableText(costSearch.value) }
  costs.value = await fetchAllPaged<CostDto, BrowseCostsQuery>(PricingService.browseCosts, query)
}

async function loadFilterSeeds() {
  filterSeedImports.value = await fetchAllPaged<ImportFclRateDto, BrowseImportFclRatesQuery>(
    PricingService.browseImportFclRates,
    {},
  )
}

function clearImportFilters() {
  importReadyDate.value = ''
  importQuoteDate.value = ''
  importAgent.value = ''
  importPol.value = ''
  importPoe.value = ''
  importPod.value = ''
  importContainerType.value = ''
  importCarrier.value = ''
  void loadImports()
}

function clearRateFilters() {
  rateReadyDate.value = ''
  rateQuoteDate.value = ''
  rateAgent.value = ''
  ratePol.value = ''
  ratePoe.value = ''
  ratePod.value = ''
  rateContainerType.value = ''
  rateCarrier.value = ''
  selectedRatePort.value = ''
  void loadRates()
}

async function loadImports() {
  const query: BrowseImportFclRatesQuery = {
    search: nullableText(importSearch.value),
    status: nullableText(importStatus.value),
    readyDate: nullableDate(importReadyDate.value),
    quoteDate: nullableDate(importQuoteDate.value),
    agent: nullableText(importAgent.value),
    pol: nullableText(importPol.value),
    poe: nullableText(importPoe.value),
    pod: nullableText(importPod.value),
    containerType: nullableText(importContainerType.value),
    carrier: nullableText(importCarrier.value),
  }
  imports.value = await fetchAllPaged<ImportFclRateDto, BrowseImportFclRatesQuery>(
    PricingService.browseImportFclRates,
    query,
  )
  selectedImportIds.value = selectedImportIds.value.filter((id) => imports.value.some((x) => x.id === id))
}

async function loadRates() {
  const query: BrowseRateHeadersQuery = {
    search: nullableText(rateSearch.value),
    isActive: rateActive.value === '' ? null : rateActive.value === 'true',
    readyDate: nullableDate(rateReadyDate.value),
    quoteDate: nullableDate(rateQuoteDate.value),
    agent: nullableText(rateAgent.value),
    pol: nullableText(ratePol.value),
    poe: nullableText(ratePoe.value),
    pod: nullableText(ratePod.value),
    containerType: nullableText(rateContainerType.value),
    carrier: nullableText(rateCarrier.value),
  }
  rates.value = await fetchAllPaged<RateHeaderDto, BrowseRateHeadersQuery>(
    PricingService.browseRateHeaders,
    query,
  )
  selectedRateIds.value = selectedRateIds.value.filter((id) => rates.value.some((x) => x.id === id))
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadCatalogSelects(), loadFilterSeeds(), loadCosts(), loadImports(), loadRates()])
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.loadError'))
  } finally {
    loading.value = false
  }
}

function openUploadModal() {
  selectedFile.value = null
  extractionResult.value = null
  uploadModalOpen.value = true
}

function setSelectedFile(file: File | null) {
  selectedFile.value = file
}

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  setSelectedFile((event.target as HTMLInputElement).files?.[0] ?? null)
}

function handleFileDrop(event: DragEvent) {
  dragActive.value = false
  setSelectedFile(event.dataTransfer?.files?.[0] ?? null)
}

async function extractFile() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    extractionResult.value = await PricingService.extractImportFclRates(selectedFile.value, uploadProfileCode.value)
    toastStore.success(t('pricing.messages.extractionSuccess'))
    await loadImports()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.extractionError'))
  } finally {
    uploading.value = false
  }
}

function openCostDrawer(fromRate = false) {
  if (!canCreateCost.value) return
  resetCostForm()
  creatingCostFromRate.value = fromRate

  const detail = selectedRateMainDetail.value
  if (fromRate && selectedRate.value && detail) {
    costForm.carrier = findItemByText('carriers', detail.carrierCodeSnapshot)?.value ?? ''
    costForm.port = findItemByText('pod', detail.destinationPortCodeSnapshot)?.value ?? ''
    costForm.portRole = 'Pod'
    costForm.currency = findItemByText('currencies', selectedRate.value.currencyCodeSnapshot)?.value ?? ''
  }

  costDrawerOpen.value = true
}

function openEditCostDrawer(cost: CostDto) {
  if (!canUpdateCost.value) return
  resetCostForm(cost)
  creatingCostFromRate.value = false
  costDrawerOpen.value = true
}

async function saveCost() {
  savingCost.value = true
  try {
    const portBucket: CatalogBucket = costForm.portRole === 'Pol' ? 'pol' : costForm.portRole === 'Pod' ? 'pod' : 'ports'
    const carrier = snapshot('carriers', costForm.carrier, t('pricing.common.carrier'))
    const port = snapshot(portBucket, costForm.port, t('pricing.common.port'))
    const currency = snapshot('currencies', costForm.currency, t('pricing.common.currency'))
    const amount = toNumber(costForm.amount)
    const saleAmount = costForm.saleAmount.trim() ? toNumber(costForm.saleAmount) : minimumSaleAmount(amount)

    const payload: CreateCostRequest = {
      name: costForm.name,
      rateType: costForm.rateType,
      carrierId: carrier?.id ?? null,
      carrierNameSnapshot: carrier?.label ?? null,
      carrierCodeSnapshot: carrier?.code ?? null,
      portId: port?.id ?? null,
      portNameSnapshot: port?.label ?? null,
      portCodeSnapshot: port?.code ?? null,
      portRole: costForm.portRole,
      currencyId: currency.id,
      currencyNameSnapshot: currency.label,
      currencyCodeSnapshot: currency.code,
      amount,
      saleAmount,
      isFixed: costForm.isFixed,
      requiresManualAmount: costForm.requiresManualAmount,
      isOptional: costForm.isOptional,
      notes: nullableText(costForm.notes),
    }

    if (editingCost.value) {
      await PricingService.updateCost(editingCost.value.id, payload)
      toastStore.success(t('pricing.messages.costUpdated'))
    } else {
      const costId = await PricingService.createCost(payload)

      if (creatingCostFromRate.value && selectedRate.value) {
        await PricingService.addRateCostDetail(selectedRate.value.id, {
          costId,
          name: costForm.name,
          costType: costForm.costType,
          currencyId: currency.id,
          currencyNameSnapshot: currency.label,
          currencyCodeSnapshot: currency.code,
          amount,
          saleAmount,
          isFixed: costForm.isFixed,
          isManual: costForm.requiresManualAmount,
          notes: nullableText(costForm.notes),
        })
        await openRateDrawer(selectedRate.value)
      }

      toastStore.success(t('pricing.messages.costCreated'))
    }

    costDrawerOpen.value = false
    editingCost.value = null
    await Promise.all([loadCosts(), loadRates()])
  } catch (error) {
    toastStore.backendError(error, editingCost.value ? t('pricing.messages.costUpdateError') : t('pricing.messages.costCreateError'))
  } finally {
    savingCost.value = false
  }
}

async function toggleCost(cost: CostDto) {
  if (!canSetCostActive.value) return
  try {
    await PricingService.setCostActive(cost.id, { isActive: !cost.isActive })
    await loadCosts()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.costStatusError'))
  }
}

function confirmDeleteCost(cost: CostDto) {
  if (!canDeleteCost.value) return
  costToDelete.value = cost
  deleteCostModalOpen.value = true
}

async function deleteCost() {
  if (!costToDelete.value) return
  deletingCost.value = true
  try {
    await PricingService.deleteCost(costToDelete.value.id)
    toastStore.success(t('pricing.messages.costDeleted'))
    if (editingCost.value?.id === costToDelete.value.id) {
      costDrawerOpen.value = false
      editingCost.value = null
    }
    deleteCostModalOpen.value = false
    costToDelete.value = null
    await Promise.all([loadCosts(), loadRates()])
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.costDeleteError'))
  } finally {
    deletingCost.value = false
  }
}

function prepareImportRate(row: ImportFclRateDto) {
  selectedImport.value = row
  importRateForm.agentName = readRawFilterValue(row.rawDataJson, 'agent') || defaultAgentName()
  importRateForm.carrier = findItemByText('carriers', row.carrier)?.value ?? ''
  importRateForm.originPort = findItemByText('pol', row.pol)?.value ?? findItemByText('ports', row.pol)?.value ?? ''
  importRateForm.poePort = findItemByText('poe', readRawFilterValue(row.rawDataJson, 'poe'))?.value ?? ''
  importRateForm.destinationPort = findItemByText('pod', row.pod)?.value ?? findItemByText('ports', row.pod)?.value ?? ''
  importRateForm.finalDestinationPort = importRateForm.destinationPort
  importRateForm.containerType = findItemByText('containerTypes', row.containerType)?.value ?? ''
  importRateForm.currency = findItemByText('currencies', row.currency)?.value ?? ''
  importRateForm.freeDays = row.freeDays == null ? '' : String(row.freeDays)
  importRateForm.validFrom = row.validFrom?.slice(0, 10) ?? ''
  importRateForm.validTo = row.validTo?.slice(0, 10) ?? ''
  importRateForm.saleAmount = ''
  importRateForm.marginPercentage = ''
  importRateForm.notes = ''
  importDrawerOpen.value = true
}

async function approveImport(row: ImportFclRateDto) {
  try {
    await PricingService.approveImportFclRate(row.id)
    toastStore.success(t('pricing.messages.importApproved'))
    await loadImports()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.importApproveError'))
  }
}

function openRejectModal(row: ImportFclRateDto) {
  if (!canRejectImport.value) return
  importToReject.value = row
  rejectForm.reason = ''
  rejectModalOpen.value = true
}

async function rejectImport() {
  const row = importToReject.value
  if (!row) return
  try {
    await PricingService.rejectImportFclRate(row.id, { errorMessage: nullableText(rejectForm.reason) ?? t('pricing.reject.defaultReason') })
    toastStore.success(t('pricing.messages.importRejected'))
    rejectModalOpen.value = false
    if (selectedImport.value?.id === row.id) importDrawerOpen.value = false
    await loadImports()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.importRejectError'))
  }
}


function openManualRateModal() {
  if (!canCreateDirectManualRate.value) return
  resetManualRateForm()
  manualRateModalOpen.value = true
}

async function createManualRate() {
  if (!canCreateDirectManualRate.value) return

  savingManualRate.value = true
  try {
    const carrier = snapshot('carriers', manualRateForm.carrier, t('pricing.common.carrier'))
    const origin = snapshot('pol', manualRateForm.originPort, t('pricing.common.origin'))
    const destination = snapshot('pod', manualRateForm.destinationPort, t('pricing.common.destination'))
    const poe = manualRateForm.poePort ? snapshot('poe', manualRateForm.poePort, 'POE') : null
    const finalDestination = manualRateForm.finalDestinationPort ? snapshot('pod', manualRateForm.finalDestinationPort, 'Destino final') : null
    const container = snapshot('containerTypes', manualRateForm.containerType, t('pricing.common.container'))
    const currency = snapshot('currencies', manualRateForm.currency, t('pricing.common.currency'))
    const saleAmount = manualRateForm.saleAmount.trim() ? toNumber(manualRateForm.saleAmount) : null
    const marginPercentage = null

    const payload: CreateManualFclRateRequest = {
      clientId: null,
      clientNameSnapshot: nullableText(manualRateForm.agentName),
      carrierId: carrier.id,
      carrierNameSnapshot: carrier.label,
      carrierCodeSnapshot: carrier.code,
      originPortId: origin.id,
      originPortNameSnapshot: origin.label,
      originPortCodeSnapshot: origin.code,
      destinationPortId: destination.id,
      destinationPortNameSnapshot: destination.label,
      destinationPortCodeSnapshot: destination.code,
      finalDestinationPortId: finalDestination?.id ?? null,
      finalDestinationPortNameSnapshot: finalDestination?.label ?? null,
      finalDestinationPortCodeSnapshot: finalDestination?.code ?? null,
      containerTypeId: container.id,
      containerTypeNameSnapshot: container.label,
      containerTypeCodeSnapshot: container.code,
      currencyId: currency.id,
      currencyNameSnapshot: currency.label,
      currencyCodeSnapshot: currency.code,
      amount: toNumber(manualRateForm.amount),
      freeDays: manualRateForm.freeDays.trim() ? Number.parseInt(manualRateForm.freeDays, 10) : null,
      validFrom: nullableDate(manualRateForm.validFrom),
      validTo: nullableDate(manualRateForm.validTo),
      notes: mergePoeIntoNotes(nullableText(manualRateForm.notes), poe?.label ?? null),
      saleAmount,
      marginPercentage,
      applyAutomaticFixedCosts: manualRateForm.applyAutomaticFixedCosts,
    }

    const rateHeaderId = await PricingService.createManualFclRate(payload)
    toastStore.success(t('pricing.messages.manualRateCreated'))
    manualRateModalOpen.value = false
    await loadRates()
    await openRateDrawer({ id: rateHeaderId } as RateHeaderDto)
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.manualRateError'))
  } finally {
    savingManualRate.value = false
  }
}

function openEditFclRateDetail(row: Record<string, unknown>) {
  if (!canUpdateFclDetail.value) return
  fclRateDetailToEdit.value = row
  resetFclRateEditForm(row)
  fclRateEditModalOpen.value = true
}

async function saveFclRateDetailEdit() {
  if (!selectedRate.value || !fclRateDetailToEdit.value || !canUpdateFclDetail.value) return

  savingFclRateEdit.value = true
  try {
    const carrier = snapshot('carriers', fclRateEditForm.carrier, t('pricing.common.carrier'))
    const origin = snapshot('pol', fclRateEditForm.originPort, 'POL')
    const poe = fclRateEditForm.poePort ? snapshot('poe', fclRateEditForm.poePort, 'POE') : null
    const destination = snapshot('pod', fclRateEditForm.destinationPort, 'POD')
    const container = snapshot('containerTypes', fclRateEditForm.containerType, t('pricing.common.container'))
    const currency = snapshot('currencies', fclRateEditForm.currency, t('pricing.common.currency'))

    await PricingService.updateFclRateDetail(selectedRate.value.id, String(fclRateDetailToEdit.value.id), {
      sourceImportFclRateId: String(fclRateDetailToEdit.value.sourceImportFclRateId ?? '') || null,
      carrierId: carrier.id,
      carrierNameSnapshot: carrier.label,
      carrierCodeSnapshot: carrier.code,
      originPortId: origin.id,
      originPortNameSnapshot: origin.label,
      originPortCodeSnapshot: origin.code,
      destinationPortId: destination.id,
      destinationPortNameSnapshot: destination.label,
      destinationPortCodeSnapshot: destination.code,
      containerTypeId: container.id,
      containerTypeNameSnapshot: container.label,
      containerTypeCodeSnapshot: container.code,
      currencyId: currency.id,
      currencyNameSnapshot: currency.label,
      currencyCodeSnapshot: currency.code,
      amount: toNumber(fclRateEditForm.amount),
      freeDays: fclRateEditForm.freeDays.trim() ? Number.parseInt(fclRateEditForm.freeDays, 10) : null,
      validFrom: nullableDate(fclRateEditForm.validFrom),
      validTo: nullableDate(fclRateEditForm.validTo),
      notes: mergePoeIntoNotes(nullableText(fclRateEditForm.notes), poe?.label ?? null),
    })

    if (fclRateEditForm.saleAmount.trim() && canApproveFreight.value) {
      const nextFreightCost = toNumber(fclRateEditForm.amount)
      const previousFreightCost = selectedRate.value.fclRateDetails.reduce((total, detail) => total + rowAmount(detail.amount), 0)
      const currentCostTotal = rowAmount(selectedRate.value.totalCostAmount)
      const nextTotalCost = Math.max(0, currentCostTotal - previousFreightCost + nextFreightCost)
      const nextSaleAmount = toNumber(fclRateEditForm.saleAmount) + rateCostSaleTotal(selectedRate.value)
      await PricingService.setRateHeaderAmounts(selectedRate.value.id, { totalCostAmount: nextTotalCost, saleAmount: nextSaleAmount })
    }

    toastStore.success(t('pricing.messages.fclDetailUpdated'))
    fclRateEditModalOpen.value = false
    fclRateDetailToEdit.value = null
    await loadRates()
    await openRateDrawer(selectedRate.value)
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.fclDetailUpdateError'))
  } finally {
    savingFclRateEdit.value = false
  }
}

async function createRateFromImport() {
  if (!selectedImport.value) return
  savingRate.value = true
  try {
    const carrier = snapshot('carriers', importRateForm.carrier, t('pricing.common.carrier'))
    const origin = snapshot('pol', importRateForm.originPort, t('pricing.common.origin'))
    const destination = snapshot('pod', importRateForm.destinationPort, t('pricing.common.destination'))
    const finalDestination = importRateForm.finalDestinationPort ? snapshot('pod', importRateForm.finalDestinationPort, 'Destino final') : null
    const poe = importRateForm.poePort ? snapshot('poe', importRateForm.poePort, 'POE') : null
    const container = snapshot('containerTypes', importRateForm.containerType, t('pricing.common.container'))
    const currency = snapshot('currencies', importRateForm.currency, t('pricing.common.currency'))
    const saleAmount = importRateForm.saleAmount.trim() ? toNumber(importRateForm.saleAmount) : null
    const notes = [nullableText(importRateForm.notes), poe ? `POE: ${poe.label}` : null].filter(Boolean).join('\n') || null
    const marginPercentage = null

    const payload: CreateRateFromImportFclRateRequest = {
      clientId: null,
      clientNameSnapshot: nullableText(importRateForm.agentName),
      carrierId: carrier.id,
      carrierNameSnapshot: carrier.label,
      carrierCodeSnapshot: carrier.code,
      originPortId: origin.id,
      originPortNameSnapshot: origin.label,
      originPortCodeSnapshot: origin.code,
      destinationPortId: destination.id,
      destinationPortNameSnapshot: destination.label,
      destinationPortCodeSnapshot: destination.code,
      finalDestinationPortId: finalDestination?.id ?? null,
      finalDestinationPortNameSnapshot: finalDestination?.label ?? null,
      finalDestinationPortCodeSnapshot: finalDestination?.code ?? null,
      containerTypeId: container.id,
      containerTypeNameSnapshot: container.label,
      containerTypeCodeSnapshot: container.code,
      currencyId: currency.id,
      currencyNameSnapshot: currency.label,
      currencyCodeSnapshot: currency.code,
      validFrom: nullableDate(importRateForm.validFrom),
      validTo: nullableDate(importRateForm.validTo),
      freeDays: importRateForm.freeDays.trim() ? Number.parseInt(importRateForm.freeDays, 10) : null,
      notes,
      saleAmount,
      marginPercentage,
    }

    await PricingService.createRateFromImportFclRate(selectedImport.value.id, payload)
    toastStore.success(t('pricing.messages.rateFromImportCreated'))
    importDrawerOpen.value = false
    selectedImport.value = null
    await Promise.all([loadImports(), loadRates()])
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateFromImportError'))
  } finally {
    savingRate.value = false
  }
}

async function openRateDrawer(row: RateHeaderDto) {
  try {
    selectedRate.value = await PricingService.getRateHeader(row.id)
    resetRateCostForm()
    resetRateHeaderEditForm()
    rateDrawerOpen.value = true
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateLoadError'))
  }
}

async function toggleRate(row: RateHeaderDto) {
  if (!canSetRateActive.value) return
  try {
    await PricingService.setRateHeaderActive(row.id, { isActive: !row.isActive })
    await loadRates()
    await openRateDrawer(row)
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateStatusError'))
  }
}

function openDuplicateRateModal() {
  if (!selectedRate.value || !canCreateDirectManualRate.value) return
  resetDuplicateRateForm()
  duplicateRateModalOpen.value = true
}

async function duplicateRate() {
  if (!selectedRate.value || !canCreateDirectManualRate.value) return

  duplicatingRate.value = true
  try {
    const saleAmount = duplicateRateForm.saleAmount.trim() ? toNumber(duplicateRateForm.saleAmount) : null
    const marginPercentage = null

    const duplicatedRateId = await PricingService.duplicateRateHeader(selectedRate.value.id, {
      clientId: null,
      clientNameSnapshot: nullableText(duplicateRateForm.clientName),
      marginPercentage,
      saleAmount,
    })

    toastStore.success(t('pricing.messages.rateDuplicated'))
    duplicateRateModalOpen.value = false
    await loadRates()
    await openRateDrawer({ id: duplicatedRateId } as RateHeaderDto)
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateDuplicateError'))
  } finally {
    duplicatingRate.value = false
  }
}

function applyCostTemplate(value: string | number) {
  const cost = costs.value.find((x) => x.id === String(value))
  if (!cost) return

  rateCostForm.costId = cost.id
  rateCostForm.name = cost.name
  rateCostForm.currency = catalogFormValue('currencies', cost.currencyId, cost.currencyCodeSnapshot, cost.currencyNameSnapshot)
  rateCostForm.amount = String(cost.amount)
  rateCostForm.saleAmount = String(cost.saleAmount ?? 0)
  rateCostForm.isFixed = cost.isFixed
  rateCostForm.isManual = cost.requiresManualAmount || cost.isOptional
  rateCostForm.notes = cost.notes ?? ''
}

async function addCostTemplateToRate(cost: CostDto) {
  if (!selectedRate.value) return
  const currencyValue = catalogFormValue('currencies', cost.currencyId, cost.currencyCodeSnapshot, cost.currencyNameSnapshot)
  const currency = snapshot('currencies', currencyValue, t('pricing.common.currency'))
  const payload: CreateRateCostDetailRequest = {
    costId: cost.id,
    name: cost.name,
    costType: resolveRateCostTypeFromTemplate(cost),
    currencyId: currency.id,
    currencyNameSnapshot: currency.label,
    currencyCodeSnapshot: currency.code,
    amount: rowAmount(cost.amount),
    saleAmount: rowAmount(cost.saleAmount),
    isFixed: cost.isFixed,
    isManual: cost.requiresManualAmount || cost.isOptional,
    notes: cost.notes ?? null,
  }

  await PricingService.addRateCostDetail(selectedRate.value.id, payload)
}

function resolveRateCostTypeFromTemplate(cost: CostDto): string {
  if (cost.portRole === 'Pol') return 'OriginCharge'
  if (cost.portRole === 'Pod') return 'DestinationCharge'
  return cost.isOptional ? 'Other' : rateCostForm.costType
}

async function saveRateCostDetail() {
  if (!selectedRate.value) return
  savingCostDetail.value = true
  try {
    for (const id of rateCostForm.optionalCostIds) {
      const template = costs.value.find((x) => x.id === id)
      if (template) await addCostTemplateToRate(template)
    }

    if (rateCostForm.name.trim()) {
      const currency = snapshot('currencies', rateCostForm.currency, t('pricing.common.currency'))
      const payload: CreateRateCostDetailRequest = {
        costId: nullableText(rateCostForm.costId),
        name: rateCostForm.name,
        costType: rateCostForm.costType,
        currencyId: currency.id,
        currencyNameSnapshot: currency.label,
        currencyCodeSnapshot: currency.code,
        amount: toNumber(rateCostForm.amount),
        saleAmount: rateCostForm.saleAmount.trim() ? toNumber(rateCostForm.saleAmount) : toNumber(rateCostForm.amount),
        isFixed: false,
        isManual: true,
        notes: nullableText(rateCostForm.notes),
      }

      await PricingService.addRateCostDetail(selectedRate.value.id, payload)
    }

    toastStore.success(t('pricing.messages.costDetailAdded'))
    resetRateCostForm()
    await openRateDrawer(selectedRate.value)
    await loadRates()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.costDetailError'))
  } finally {
    savingCostDetail.value = false
  }
}


function canChangeRateCostDetail(_row: Record<string, unknown>): boolean {
  return true
}

function costSaleAmount(row: Record<string, unknown>): number {
  return rateCostDetailSaleAmount(row)
}
function openEditRateCostDetail(row: Record<string, unknown>) {
  if (!canUpdateCostDetail.value || !canChangeRateCostDetail(row)) return
  rateCostDetailToEdit.value = row
  rateCostEditForm.costId = String(row.costId ?? '')
  rateCostEditForm.name = String(row.name ?? '')
  rateCostEditForm.costType = String(row.costType ?? 'Other')
  rateCostEditForm.currency = catalogFormValue('currencies', String(row.currencyId ?? ''), String(row.currencyCodeSnapshot ?? selectedRate.value?.currencyCodeSnapshot ?? ''), String(row.currencyNameSnapshot ?? ''))
  rateCostEditForm.amount = String(row.amount ?? '')
  rateCostEditForm.saleAmount = String(row.saleAmount ?? row.amount ?? '')
  rateCostEditForm.notes = String(row.notes ?? '')
  rateCostEditModalOpen.value = true
}

async function saveRateCostDetailEdit() {
  if (!selectedRate.value || !rateCostDetailToEdit.value) return
  savingRateCostEdit.value = true
  try {
    const currency = snapshot('currencies', rateCostEditForm.currency, t('pricing.common.currency'))
    await PricingService.updateRateCostDetail(selectedRate.value.id, String(rateCostDetailToEdit.value.id), {
      costId: nullableText(rateCostEditForm.costId),
      name: rateCostEditForm.name,
      costType: rateCostEditForm.costType,
      currencyId: currency.id,
      currencyNameSnapshot: currency.label,
      currencyCodeSnapshot: currency.code,
      amount: toNumber(rateCostEditForm.amount),
      saleAmount: rateCostEditForm.saleAmount.trim() ? toNumber(rateCostEditForm.saleAmount) : toNumber(rateCostEditForm.amount),
      isFixed: Boolean(rateCostDetailToEdit.value.isFixed),
      isManual: Boolean(rateCostDetailToEdit.value.isManual),
      notes: nullableText(rateCostEditForm.notes),
    })
    toastStore.success(t('pricing.messages.costDetailUpdated'))
    rateCostEditModalOpen.value = false
    rateCostDetailToEdit.value = null
    await openRateDrawer(selectedRate.value)
    await loadRates()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.costDetailUpdateError'))
  } finally {
    savingRateCostEdit.value = false
  }
}


function printClientQuote() {
  if (!canPrintSelectedRate.value) {
    toastStore.warning(t('pricing.messages.inactiveRateCannotPrint'))
    return
  }

  window.print()
}

async function removeRateCostDetail(row: Record<string, unknown>) {
  if (!selectedRate.value || !canDeleteCostDetail.value || !canChangeRateCostDetail(row)) return

  savingCostDetail.value = true
  try {
    await PricingService.removeRateCostDetail(selectedRate.value.id, String(row.id))
    toastStore.success(t('pricing.messages.costDetailRemoved'))
    await loadRates()
    await openRateDrawer(selectedRate.value)
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.costDetailDeleteError'))
  } finally {
    savingCostDetail.value = false
  }
}

function toggleImportSelection(id: string, checked: boolean) {
  selectedImportIds.value = checked
    ? Array.from(new Set([...selectedImportIds.value, id]))
    : selectedImportIds.value.filter((item) => item !== id)
}

function toggleRateSelection(id: string, checked: boolean) {
  selectedRateIds.value = checked
    ? Array.from(new Set([...selectedRateIds.value, id]))
    : selectedRateIds.value.filter((item) => item !== id)
}

async function deleteImport(row: ImportFclRateDto) {
  if (!canDeleteImport.value) return
  deletingImports.value = true
  try {
    await PricingService.deleteImportFclRate(row.id)
    toastStore.success(t('pricing.messages.importDeleted'))
    if (selectedImport.value?.id === row.id) importDrawerOpen.value = false
    await loadImports()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.importDeleteError'))
  } finally {
    deletingImports.value = false
  }
}

async function deleteSelectedImports() {
  if (!canDeleteImport.value || selectedImportIds.value.length === 0) return
  deletingImports.value = true
  try {
    await PricingService.deleteImportFclRatesBatch(selectedImportIds.value)
    toastStore.success(t('pricing.messages.importsDeleted'))
    selectedImportIds.value = []
    await loadImports()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.importDeleteError'))
  } finally {
    deletingImports.value = false
  }
}

async function deleteRate(row: RateHeaderDto) {
  if (!canDeleteRate.value) return
  deletingRates.value = true
  try {
    await PricingService.deleteRateHeader(row.id)
    toastStore.success(t('pricing.messages.rateDeleted'))
    if (selectedRate.value?.id === row.id) rateDrawerOpen.value = false
    await loadRates()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateDeleteError'))
  } finally {
    deletingRates.value = false
  }
}

async function deleteSelectedRates() {
  if (!canDeleteRate.value || selectedRateIds.value.length === 0) return
  deletingRates.value = true
  try {
    await PricingService.deleteRateHeadersBatch(selectedRateIds.value)
    toastStore.success(t('pricing.messages.ratesDeleted'))
    selectedRateIds.value = []
    await loadRates()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateDeleteError'))
  } finally {
    deletingRates.value = false
  }
}

async function saveRateHeaderEdit() {
  if (!selectedRate.value || !canUpdateRate.value) return
  savingRateHeaderEdit.value = true
  try {
    const currency = selectedItem('currencies', selectedRate.value.currencyId) ?? findItemByText('currencies', selectedRate.value.currencyCodeSnapshot)
    if (!currency) throw new Error(t('pricing.validation.selectRequired', { field: t('pricing.common.currency') }))

    await PricingService.updateRateHeader(selectedRate.value.id, {
      clientId: selectedRate.value.clientId ?? null,
      clientNameSnapshot: nullableText(rateHeaderEditForm.clientName),
      currencyId: currency.id,
      currencyNameSnapshot: currency.label,
      currencyCodeSnapshot: currency.code,
      validFrom: nullableDate(rateHeaderEditForm.validFrom),
      validTo: nullableDate(rateHeaderEditForm.validTo),
    })

    toastStore.success(t('pricing.messages.rateUpdated'))
    await loadRates()
    await openRateDrawer(selectedRate.value)
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.rateUpdateError'))
  } finally {
    savingRateHeaderEdit.value = false
  }
}

async function approveMargin(approvalId: string) {
  if (!selectedRate.value || !canApproveLowMargin.value) return
  try {
    await PricingService.approveMarginApproval(selectedRate.value.id, approvalId, {
      reason: t('pricing.marginApprovals.approvedFromWeb'),
    })
    toastStore.success(t('pricing.messages.marginApproved'))
    await openRateDrawer(selectedRate.value)
    await loadRates()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.marginApproveError'))
  }
}

function rejectMargin(approvalId: string) {
  if (!selectedRate.value || !canApproveLowMargin.value) return
  marginApprovalToReject.value = approvalId
  marginRejectForm.reason = ''
  marginRejectModalOpen.value = true
}

async function submitMarginReject() {
  if (!selectedRate.value || !marginApprovalToReject.value || !canApproveLowMargin.value) return
  const reason = marginRejectForm.reason.trim()
  if (!reason) return

  try {
    await PricingService.rejectMarginApproval(selectedRate.value.id, marginApprovalToReject.value, { reason })
    toastStore.success(t('pricing.messages.marginRejected'))
    marginRejectModalOpen.value = false
    marginApprovalToReject.value = null
    await openRateDrawer(selectedRate.value)
    await loadRates()
  } catch (error) {
    toastStore.backendError(error, t('pricing.messages.marginRejectError'))
  }
}

useViewShortcuts({
  create: () => {
    if (activeTab.value === 'imports') {
      openUploadModal()
      return
    }

    if (activeTab.value === 'costs') {
      openCostDrawer(false)
      return
    }

    openManualRateModal()
  },
  save: refreshAll,
  refresh: refreshAll,
})

onMounted(refreshAll)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('pricing.title')" :subtitle="t('pricing.subtitle')" :icon="BadgeDollarSign">
      <template #actions>
        <DhButton :icon="Plus" :label="t('pricing.actions.manualRate')" :disabled="!canCreateDirectManualRate" @click="openManualRateModal" />
        <DhButton :icon="UploadCloud" :label="t('pricing.actions.importRates')" :disabled="!canCreateImport" @click="openUploadModal" />
        <DhButton :icon="RefreshCcw" variant="secondary" :label="t('common.refresh')" :loading="loading" @click="refreshAll" />
      </template>
    </DhPageHeader>

    <section>
      <article class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)]">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">{{ pricingSectionMeta.accent }}</p>
            <h2 class="mt-2 text-2xl font-black tracking-tight text-[var(--dh-text)] md:text-3xl">{{ pricingSectionMeta.title }}</h2>
          </div>

          <div class="grid w-full gap-3 sm:grid-cols-3 xl:w-[420px] xl:grid-cols-3">
            <article v-for="item in stats" :key="item.key" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
              <p class="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ item.label }}</p>
              <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ item.value }}</p>
            </article>
          </div>
        </div>
      </article>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-sm)]">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in pricingTabs"
          :key="tab.value"
          type="button"
          class="flex items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-black transition"
          :class="activeTab === tab.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white shadow-[0_18px_38px_rgba(252,40,0,0.20)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
          @click="setPricingTab(tab.value)"
        >
          <span>{{ tab.label }}</span>
          <span class="rounded-full bg-black/10 px-2 py-0.5 text-xs">{{ tab.count }}</span>
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'imports'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.imports.title') }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <DhSearchInput v-model="importSearch" class="w-full md:w-80" :placeholder="t('pricing.imports.search')" @search="loadImports" @clear="loadImports" />
          <DhSelect v-model="importStatus" class="w-48" :options="statusOptions" placeholder="" @update:model-value="loadImports" />
          <DhButton v-if="selectedImportIds.length" variant="danger" :icon="Trash2" :label="t('pricing.actions.deleteSelected')" :loading="deletingImports" :disabled="!canDeleteImport" @click="deleteSelectedImports" />
          <DhButton :icon="UploadCloud" :label="t('pricing.actions.importRates')" :disabled="!canCreateImport" @click="openUploadModal" />
        </div>
      </div>

      <div class="mt-4 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">{{ t('pricing.filters.title') }}</p>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.filters.help') }}</p>
          </div>
          <div class="flex gap-2">
            <DhButton size="sm" variant="secondary" :label="t('pricing.filters.clear')" @click="clearImportFilters" />
            <DhButton size="sm" :icon="RefreshCcw" :label="t('pricing.filters.apply')" @click="loadImports" />
          </div>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DhInput v-model="importReadyDate" type="date" :label="t('pricing.filters.readyDate')" />
          <DhInput v-model="importQuoteDate" type="date" :label="t('pricing.filters.quoteDate')" />
          <DhSelect v-model="importAgent" :label="t('pricing.filters.agent')" :options="agentFilterOptions" placeholder="" />
          <DhSelect v-model="importCarrier" :label="t('pricing.common.carrier')" :options="carrierFilterOptions" placeholder="" />
          <DhSelect v-model="importPol" :label="t('pricing.common.pol')" :options="portFilterOptions" placeholder="" />
          <DhSelect v-model="importPoe" :label="t('pricing.filters.poe')" :options="poeFilterOptions" placeholder="" />
          <DhSelect v-model="importPod" :label="t('pricing.common.pod')" :options="portFilterOptions" placeholder="" />
          <DhSelect v-model="importContainerType" :label="t('pricing.common.container')" :options="containerTypeFilterOptions" placeholder="" />
        </div>
      </div>

      <div class="mt-5">
        <DhDataTable :columns="importColumns" :rows="pagedImports" :loading="loading" :empty-text="t('pricing.imports.empty')" @row-click="prepareImportRate">
          <template #cell-__select="{ row }">
            <input type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]" :checked="selectedImportIds.includes(row.id)" :disabled="!canDeleteImport" @click.stop @change="toggleImportSelection(row.id, eventChecked($event))" />
          </template>
          <template #cell-poe="{ row }">{{ importPoeLabel(row) }}</template>
          <template #cell-amount="{ row }">{{ money(row.amount, row.currency) }}</template>
          <template #cell-validFrom="{ value }">{{ typeof value === 'string' && value ? value.slice(0, 10) : '—' }}</template>
          <template #cell-validTo="{ value }">{{ typeof value === 'string' && value ? value.slice(0, 10) : '—' }}</template>
          <template #cell-status="{ value }"><DhBadge :variant="statusVariant(String(value))" :label="statusLabel(String(value))" /></template>
          <template #cell-__actions="{ row }">
            <div class="flex justify-end gap-1">
              <button class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40" type="button" :disabled="!canDeleteImport || deletingImports" @click.stop="deleteImport(row)"><Trash2 class="h-4 w-4" /></button>
            </div>
          </template>
        </DhDataTable>
        <DhPagination
          v-model:page="importPage"
          v-model:page-size="importPageSize"
          class="mt-4"
          :total="imports.length"
        />
      </div>
    </section>

    <section v-else-if="activeTab === 'rates'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.matrix.title') }}</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.matrix.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <DhSearchInput v-model="rateSearch" class="w-full md:w-80" :placeholder="t('pricing.rates.search')" @search="loadRates" @clear="loadRates" />
          <DhSelect v-model="rateActive" class="w-44" :options="activeOptions" placeholder="" @update:model-value="loadRates" />
          <DhButton :icon="Plus" :label="t('pricing.actions.manualRate')" :disabled="!canCreateDirectManualRate" @click="openManualRateModal" />
          <DhButton v-if="selectedRateIds.length" variant="danger" :icon="Trash2" :label="t('pricing.actions.deleteSelected')" :loading="deletingRates" :disabled="!canDeleteRate" @click="deleteSelectedRates" />
        </div>
      </div>

      <div class="mt-4 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-sm font-black text-[var(--dh-text)]">{{ t('pricing.filters.title') }}</p>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.filters.help') }}</p>
          </div>
          <div class="flex gap-2">
            <DhButton size="sm" variant="secondary" :label="t('pricing.filters.clear')" @click="clearRateFilters" />
            <DhButton size="sm" :icon="RefreshCcw" :label="t('pricing.filters.apply')" @click="loadRates" />
          </div>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DhInput v-model="rateReadyDate" type="date" :label="t('pricing.filters.readyDate')" />
          <DhInput v-model="rateQuoteDate" type="date" :label="t('pricing.filters.quoteDate')" />
          <DhSelect v-model="rateAgent" :label="t('pricing.filters.agent')" :options="agentFilterOptions" placeholder="" />
          <DhSelect v-model="rateCarrier" :label="t('pricing.common.carrier')" :options="carrierFilterOptions" placeholder="" />
          <DhSelect v-model="ratePol" :label="t('pricing.common.pol')" :options="portFilterOptions" placeholder="" />
          <DhSelect v-model="ratePoe" :label="t('pricing.filters.poe')" :options="poeFilterOptions" placeholder="" />
          <DhSelect v-model="ratePod" :label="t('pricing.common.pod')" :options="portFilterOptions" placeholder="" />
          <DhSelect v-model="rateContainerType" :label="t('pricing.common.container')" :options="containerTypeFilterOptions" placeholder="" />
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition"
          :class="selectedRatePort === '' ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white' : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
          @click="selectedRatePort = ''"
        >
          {{ t('pricing.matrix.allPorts') }}
          <span class="ml-2 rounded-full bg-black/10 px-2 py-0.5">{{ rates.length }}</span>
        </button>
        <button
          v-for="port in matrixPortOptions"
          :key="port.value"
          type="button"
          class="rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition"
          :class="selectedRatePort === port.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white' : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
          @click="selectedRatePort = port.value"
        >
          {{ port.label }}
          <span class="ml-2 rounded-full bg-black/10 px-2 py-0.5">{{ port.count }}</span>
        </button>
      </div>

      <div v-if="filteredMatrixRates.length" class="mt-5 grid gap-4 xl:grid-cols-2">
        <article
          v-for="rate in pagedRates"
          :key="rate.id"
          class="overflow-hidden rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]"
        >
          <button type="button" class="block w-full p-0 text-left" @click="openRateDrawer(rate)">
            <header class="border-b border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <DhBadge :variant="statusVariant(rate.status)" :label="statusLabel(rate.status)" />
                    <DhBadge :variant="rate.isActive ? 'success' : 'neutral'" :label="statusLabel(rate.isActive)" />
                  </div>
                  <h3 class="mt-2 text-lg font-black text-[var(--dh-text)]">{{ originLabel(rate) }} → {{ ratePortLabel(rate) }}</h3>
                  <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                    {{ carrierLabel(rate) }} · {{ containerLabel(rate) }} · {{ rate.clientNameSnapshot || 'Sin agente' }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ t('pricing.rates.sale') }}</p>
                  <p class="text-2xl font-black text-[var(--dh-text)]">{{ money(rate.saleAmount, rate.currencyCodeSnapshot) }}</p>
                </div>
              </div>
            </header>

            <div class="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.rates.totalCost') }}</p>
                <p class="mt-1 font-black text-[var(--dh-text)]">{{ money(rate.totalCostAmount, rate.currencyCodeSnapshot) }}</p>
              </div>
              <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.matrix.profit') }}</p>
                <p class="mt-1 font-black" :class="rateProfit(rate) < 0 ? 'text-red-500' : 'text-emerald-500'">{{ money(rateProfit(rate), rate.currencyCodeSnapshot) }}</p>
              </div>
              <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Margen actual</p>
                <p class="mt-1 font-black" :class="rate.requiresApproval ? 'text-red-500' : 'text-[var(--dh-text)]'">{{ percent(rate.marginPercentage) }}</p>
              </div>
              <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.rates.validity') }}</p>
                <p class="mt-1 font-black text-[var(--dh-text)]">{{ rate.validFrom?.slice(0, 10) || '—' }} / {{ rate.validTo?.slice(0, 10) || '—' }}</p>
              </div>
            </div>

            <div class="px-4 pb-4">
              <div class="overflow-hidden rounded-[20px] border border-[var(--dh-border)]">
                <div class="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] bg-[#111] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white">
                  <span>{{ t('pricing.matrix.item') }}</span>
                  <span class="text-right">{{ t('pricing.matrix.cost') }}</span>
                  <span class="text-right">{{ t('pricing.matrix.sale') }}</span>
                  <span class="text-right">{{ t('pricing.matrix.profit') }}</span>
                </div>
                <div
                  v-for="item in rateMatrixRows(rate)"
                  :key="item.key"
                  class="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] items-center border-t border-[var(--dh-border)] px-4 py-3 text-sm"
                >
                  <div class="min-w-0">
                    <p class="truncate font-black text-[var(--dh-text)]">{{ item.name }}</p>
                    <p class="truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ item.meta }} · {{ item.type }}</p>
                  </div>
                  <p class="text-right font-bold text-[var(--dh-text)]">{{ money(item.cost, item.currency) }}</p>
                  <p class="text-right font-bold text-[var(--dh-text)]">{{ money(item.sale, item.currency) }}</p>
                  <p class="text-right font-black" :class="item.sale - item.cost < 0 ? 'text-red-500' : 'text-emerald-500'">{{ money(item.sale - item.cost, item.currency) }}</p>
                </div>
              </div>
            </div>
          </button>

          <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
            <label class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              <input type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]" :checked="selectedRateIds.includes(rate.id)" :disabled="!canDeleteRate" @click.stop @change="toggleRateSelection(rate.id, eventChecked($event))" />
              {{ t('common.select') }}
            </label>
            <div class="flex gap-2">
              <DhButton size="sm" variant="secondary" :label="t('common.open')" @click.stop="openRateDrawer(rate)" />
              <DhButton size="sm" variant="danger" :icon="Trash2" :disabled="!canDeleteRate || deletingRates" @click.stop="deleteRate(rate)" />
            </div>
          </footer>
        </article>
      </div>

      <div v-else class="mt-5 rounded-[24px] border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] p-8 text-center">
        <p class="font-black text-[var(--dh-text)]">{{ t('pricing.rates.empty') }}</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.matrix.emptyHelp') }}</p>
      </div>

      <DhPagination
        v-model:page="ratePage"
        v-model:page-size="ratePageSize"
        class="mt-4"
        :total="filteredMatrixRates.length"
      />
    </section>

    <section v-else class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.costs.title') }}</h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.costs.automaticMatrixHelp') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <DhSearchInput v-model="costSearch" class="w-full md:w-80" :placeholder="t('pricing.costs.search')" @search="loadCosts" @clear="loadCosts" />
            <DhButton :icon="Plus" :label="t('pricing.actions.newCost')" :disabled="!canCreateCost" @click="openCostDrawer(false)" />
          </div>
        </div>
      </div>

      <div class="mt-5 space-y-4">
        <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-black text-[var(--dh-text)]">{{ t('pricing.costs.automaticMatrixTitle') }}</h3>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.costs.fixedHelp') }}</p>
            </div>
            <DhBadge variant="primary" :label="String(automaticFixedCosts.length)" />
          </div>

          <div v-if="automaticCostPortGroups.length" class="grid gap-4 xl:grid-cols-2">
            <section
              v-for="group in automaticCostPortGroups"
              :key="group.key"
              class="overflow-hidden rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-surface)]"
            >
              <header class="border-b border-[var(--dh-border)] p-4">
                <div>
                  <p class="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">{{ t('pricing.common.port') }}</p>
                  <h4 class="text-lg font-black text-[var(--dh-text)]">{{ group.label }}</h4>
                </div>
              </header>

              <div class="overflow-x-auto">
                <table class="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr class="bg-[#111] text-left text-[11px] font-black uppercase tracking-[0.12em] text-white">
                      <th class="px-4 py-3">{{ t('pricing.matrix.item') }}</th>
                      <th class="px-4 py-3">{{ t('pricing.common.carrier') }}</th>
                      <th class="px-4 py-3 text-right">{{ t('pricing.matrix.cost') }}</th>
                      <th class="px-4 py-3 text-right">{{ t('pricing.matrix.sale') }}</th>
                      <th class="px-4 py-3 text-right">{{ t('pricing.matrix.profit') }}</th>
                      <th class="px-4 py-3 text-center">{{ t('common.status') }}</th>
                      <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="cost in group.rows"
                      :key="cost.id"
                      class="cursor-pointer border-t border-[var(--dh-border)] hover:bg-[var(--dh-card)]"
                      @click="openEditCostDrawer(cost)"
                    >
                      <td class="px-4 py-3">
                        <p class="font-black text-[var(--dh-text)]">{{ cost.name }}</p>
                        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ String(cost.rateType).toUpperCase() }} · {{ t(`pricing.portRoles.${String(cost.portRole)}`) }}</p>
                      </td>
                      <td class="px-4 py-3 font-semibold text-[var(--dh-text)]">{{ cost.carrierNameSnapshot || t('pricing.common.notLinked') }}</td>
                      <td class="px-4 py-3 text-right font-bold text-[var(--dh-text)]">{{ money(cost.amount, cost.currencyCodeSnapshot) }}</td>
                      <td class="px-4 py-3 text-right font-bold text-[var(--dh-text)]">{{ money(cost.saleAmount ?? minimumSaleAmount(Number(cost.amount ?? 0)), cost.currencyCodeSnapshot) }}</td>
                      <td class="px-4 py-3 text-right font-black" :class="costProfit(cost) < 0 ? 'text-red-500' : 'text-emerald-500'">{{ money(costProfit(cost), cost.currencyCodeSnapshot) }}</td>
                      <td class="px-4 py-3 text-center">
                        <button type="button" :disabled="!canSetCostActive" @click.stop="toggleCost(cost)">
                          <DhBadge :variant="statusVariant(cost.isActive)" :label="statusLabel(cost.isActive)" />
                        </button>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex justify-end gap-2">
                          <DhButton size="sm" variant="secondary" :icon="Pencil" :disabled="!canUpdateCost" @click.stop="openEditCostDrawer(cost)" />
                          <DhButton size="sm" variant="danger" :icon="Trash2" :disabled="!canDeleteCost" @click.stop="confirmDeleteCost(cost)" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div v-else class="rounded-[20px] border border-dashed border-[var(--dh-border)] bg-[var(--dh-input)] p-6 text-center">
            <p class="font-black text-[var(--dh-text)]">{{ t('pricing.costs.emptyFixed') }}</p>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.costs.noAutomaticMatrix') }}</p>
          </div>
        </article>

        <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <h3 class="mb-4 text-base font-black text-[var(--dh-text)]">{{ t('pricing.costs.variableTitle') }}</h3>
          <DhDataTable :columns="costColumns" :rows="pagedVariableCostTemplates" :loading="loading" :empty-text="t('pricing.costs.emptyVariable')" @row-click="openEditCostDrawer">
            <template #cell-rateType="{ value }">{{ String(value).toUpperCase() }}</template>
            <template #cell-carrierNameSnapshot="{ value }">{{ value || t('pricing.common.notLinked') }}</template>
            <template #cell-portNameSnapshot="{ value }">{{ value || t('pricing.common.notLinked') }}</template>
            <template #cell-portRole="{ value }">{{ t(`pricing.portRoles.${String(value)}`) }}</template>
            <template #cell-requiresManualAmount="{ value }"><DhBadge :variant="value ? 'warning' : 'success'" :label="value ? t('common.yes') : t('common.no')" /></template>
            <template #cell-amount="{ row }">{{ money(row.amount, row.currencyCodeSnapshot) }}</template>
            <template #cell-saleAmount="{ row }">{{ money(row.saleAmount ?? minimumSaleAmount(Number(row.amount ?? 0)), row.currencyCodeSnapshot) }}</template>
            <template #cell-isActive="{ row }">
              <button type="button" :disabled="!canSetCostActive" @click.stop="toggleCost(row)">
                <DhBadge :variant="statusVariant(row.isActive)" :label="statusLabel(row.isActive)" />
              </button>
            </template>
            <template #cell-__actions="{ row }">
              <div class="flex justify-end gap-2">
                <DhButton size="sm" variant="secondary" :icon="Pencil" :disabled="!canUpdateCost" @click.stop="openEditCostDrawer(row)" />
                <DhButton size="sm" variant="danger" :icon="Trash2" :disabled="!canDeleteCost" @click.stop="confirmDeleteCost(row)" />
              </div>
            </template>
          </DhDataTable>
          <DhPagination
            v-model:page="variableCostPage"
            v-model:page-size="variableCostPageSize"
            class="mt-4"
            :total="variableCostTemplates.length"
          />
        </article>
      </div>
    </section>

    <DhModal :open="uploadModalOpen" :title="t('pricing.upload.title')" size="lg" @close="uploadModalOpen = false">
      <div class="space-y-4">
        <input ref="fileInput" class="hidden" type="file" accept=".pdf,.xlsx,.xlsm,.xls,.csv,.eml,.msg,.html,.htm,.mht,.mhtml,.txt" @change="handleFileChange" />

        <button
          type="button"
          class="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed p-6 text-center transition"
          :class="dragActive ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)] bg-[var(--dh-input)]'"
          @click="openFilePicker"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop.prevent="handleFileDrop"
        >
          <FileUp class="h-10 w-10 text-[var(--dh-primary)]" />
          <div>
            <p class="font-black text-[var(--dh-text)]">{{ selectedFile?.name || t('pricing.upload.dropTitle') }}</p>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.upload.dropSubtitle') }}</p>
          </div>
        </button>

        <DhSelect v-model="uploadProfileCode" :label="t('pricing.upload.profile')" :placeholder="t('pricing.upload.profilePlaceholder')" :options="catalogOptions.profiles" :disabled="loadingCatalogs" />

        <div v-if="extractionResult" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="font-black text-[var(--dh-text)]">{{ t('pricing.upload.result') }}</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ t('pricing.upload.resultSummary', { created: extractionResult.createdRows, skipped: extractionResult.skippedRows, total: extractionResult.totalRows }) }}
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="uploadModalOpen = false" />
          <DhButton :icon="UploadCloud" :label="t('pricing.actions.extract')" :loading="uploading" :disabled="!selectedFile" @click="extractFile" />
        </div>
      </div>
    </DhModal>

    <DhDrawer :open="importDrawerOpen" :title="t('pricing.imports.convertTitle')" size="xl" @close="importDrawerOpen = false">
      <div v-if="selectedImport" class="space-y-5">
        <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-black text-[var(--dh-text)]">{{ selectedImport.carrier }} · {{ selectedImport.containerType }}</p>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ selectedImport.pol }} → {{ importPoeLabel(selectedImport) }} → {{ selectedImport.pod }} · Días libres: {{ selectedImport.freeDays ?? '—' }} · Usos: {{ selectedImport.usedAsRateCount ?? 0 }}</p>
            </div>
            <div class="flex items-center gap-2">
              <DhBadge :variant="statusVariant(selectedImport.status)" :label="statusLabel(selectedImport.status)" />
              <p class="text-xl font-black text-[var(--dh-text)]">{{ money(selectedImport.amount, selectedImport.currency) }}</p>
            </div>
          </div>
        </section>

        <section class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="importRateForm.agentName" label="Agente" :options="agentOptions" />
          <DhSelect v-model="importRateForm.carrier" :label="t('pricing.common.carrier')" :options="catalogOptions.carriers" :disabled="loadingCatalogs" />
          <DhSelect v-model="importRateForm.containerType" :label="t('pricing.common.container')" :options="catalogOptions.containerTypes" :disabled="loadingCatalogs" />
          <DhSelect v-model="importRateForm.originPort" label="POL" :options="catalogOptions.pol" :disabled="loadingCatalogs" />
          <DhSelect v-model="importRateForm.poePort" label="POE" :options="catalogOptions.poe" :disabled="loadingCatalogs" />
          <DhSelect v-model="importRateForm.destinationPort" label="POD" :options="catalogOptions.pod" :disabled="loadingCatalogs" />
          <DhSelect v-model="importRateForm.finalDestinationPort" label="Destino final" :options="catalogOptions.pod" :disabled="loadingCatalogs" />
          <DhSelect v-model="importRateForm.currency" :label="t('pricing.common.currency')" :options="catalogOptions.currencies" :disabled="loadingCatalogs" />
          <DhInput v-model="importRateForm.freeDays" label="Días libres" type="number" step="1" />
          <DhInput v-model="importRateForm.validFrom" :label="t('pricing.common.validFrom')" type="date" />
          <DhInput v-model="importRateForm.validTo" :label="t('pricing.common.validTo')" type="date" />
          <DhInput v-model="importRateForm.saleAmount" label="Venta manual del flete" type="number" step="0.01" :disabled="!canApproveFreight" />
          <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text-muted)]">Margen esperado: <strong>12%</strong>. El margen actual se calcula con agente, flete y destino.</div>
        </section>

        <div class="flex flex-wrap justify-end gap-2">
          <DhButton variant="secondary" :label="t('pricing.actions.approve')" :disabled="!canApproveImport" @click="approveImport(selectedImport)" />
          <DhButton variant="danger" :label="t('pricing.actions.reject')" :disabled="!canRejectImport" @click="openRejectModal(selectedImport)" />
          <DhButton variant="danger" :icon="Trash2" :label="t('common.delete')" :loading="deletingImports" :disabled="!canDeleteImport" @click="deleteImport(selectedImport)" />
          <DhButton :icon="CheckCircle2" :label="t('pricing.actions.createOfficialRate')" :loading="savingRate" :disabled="!canCreateRateFromImport || selectedImport.status !== 'Approved'" @click="createRateFromImport" />
        </div>
      </div>
    </DhDrawer>

    <DhDrawer :open="rateDrawerOpen" :title="t('pricing.rates.drawerTitle')" size="full" @close="rateDrawerOpen = false">
      <div v-if="selectedRate" class="space-y-5">
        <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <DhBadge :variant="statusVariant(selectedRate.status)" :label="statusLabel(selectedRate.status)" />
                <DhBadge :variant="selectedRate.isActive ? 'success' : 'neutral'" :label="selectedRate.isActive ? t('common.active') : t('common.inactive')" />
                <DhBadge v-if="selectedRate.requiresApproval" variant="danger" :label="t('pricing.rates.requiresApproval')" />
              </div>
              <h2 class="mt-3 text-2xl font-black text-[var(--dh-text)]">{{ routeLabel(selectedRate) }}</h2>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                {{ selectedRate.clientNameSnapshot || 'Sin agente' }} · {{ carrierLabel(selectedRate) }} · {{ selectedRate.currencyCodeSnapshot }}
              </p>
            </div>

            <div class="flex flex-wrap justify-end gap-2">
              <DhButton variant="secondary" :icon="Printer" :label="t('pricing.actions.quickPrint')" :disabled="!canPrintSelectedRate" @click="printClientQuote" />
              <DhButton variant="secondary" :icon="Copy" :label="t('pricing.actions.duplicate')" :disabled="!canCreateDirectManualRate" @click="openDuplicateRateModal" />
              <DhButton variant="secondary" :label="selectedRate.isActive ? t('common.inactivate') : t('common.activate')" :disabled="!canSetRateActive" @click="toggleRate(selectedRate)" />
              <DhButton variant="danger" :icon="Trash2" :label="t('common.delete')" :loading="deletingRates" :disabled="!canDeleteRate" @click="deleteRate(selectedRate)" />
            </div>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.rates.totalCost') }}</p>
              <p class="mt-1 font-black text-[var(--dh-text)]">{{ money(selectedRate.totalCostAmount, selectedRate.currencyCodeSnapshot) }}</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.rates.sale') }}</p>
              <p class="mt-1 font-black text-[var(--dh-text)]">{{ money(selectedRate.saleAmount, selectedRate.currencyCodeSnapshot) }}</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.matrix.profit') }}</p>
              <p class="mt-1 font-black" :class="selectedRateProfit < 0 ? 'text-red-500' : 'text-emerald-500'">{{ money(selectedRateProfit, selectedRate.currencyCodeSnapshot) }}</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Margen esperado</p>
              <p class="mt-1 font-black text-[var(--dh-text)]">12.00%</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Margen actual</p>
              <p class="mt-1 font-black" :class="selectedRate.requiresApproval ? 'text-red-500' : 'text-[var(--dh-text)]'">{{ percent(selectedRate.marginPercentage) }}</p>
            </div>
            <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('pricing.rates.validity') }}</p>
              <p class="mt-1 font-black text-[var(--dh-text)]">{{ selectedRate.validFrom?.slice(0, 10) || '—' }} / {{ selectedRate.validTo?.slice(0, 10) || '—' }}</p>
            </div>
          </div>
        </section>

        <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.rates.editHeaderTitle') }}</h3>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.rates.editHeaderHelp') }}</p>
            </div>
            <DhButton :label="t('common.save')" :loading="savingRateHeaderEdit" :disabled="!canUpdateRate" @click="saveRateHeaderEdit" />
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <DhInput v-model="rateHeaderEditForm.clientName" label="Agente" />
            <DhInput v-model="rateHeaderEditForm.validFrom" :label="t('pricing.common.validFrom')" type="date" />
            <DhInput v-model="rateHeaderEditForm.validTo" :label="t('pricing.common.validTo')" type="date" />
          </div>
        </section>

        <section class="grid gap-4 xl:grid-cols-3">
          <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Costos de Agente</p>
            <div v-if="selectedRateAgentCostRows.length" class="mt-3 space-y-2">
              <div v-for="row in selectedRateAgentCostRows" :key="String(row.id)" class="flex justify-between gap-3 text-sm font-semibold">
                <span class="text-[var(--dh-text)]">{{ row.name }}</span>
                <span class="font-black text-[var(--dh-text)]">{{ money(row.amount, String(row.currencyCodeSnapshot || selectedRate.currencyCodeSnapshot || 'USD')) }}</span>
              </div>
            </div>
            <p v-else class="mt-3 text-sm font-semibold text-[var(--dh-text-muted)]">Sin costos de agente.</p>
            <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">La venta de estos costos queda en 0 y no se muestra al cliente.</p>
          </article>

          <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Flete internacional / marítimo</p>
            <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p class="text-[11px] font-black uppercase text-[var(--dh-text-muted)]">Costo</p>
                <p class="font-black text-[var(--dh-text)]">{{ money(rateFreightCostTotal(selectedRate), selectedRate.currencyCodeSnapshot) }}</p>
              </div>
              <div>
                <p class="text-[11px] font-black uppercase text-[var(--dh-text-muted)]">Venta</p>
                <p class="font-black text-[var(--dh-text)]">{{ money(rateFreightSaleTotal(selectedRate), selectedRate.currencyCodeSnapshot) }}</p>
              </div>
              <div>
                <p class="text-[11px] font-black uppercase text-[var(--dh-text-muted)]">Utilidad</p>
                <p class="font-black" :class="rateFreightSaleTotal(selectedRate) - rateFreightCostTotal(selectedRate) < 0 ? 'text-red-500' : 'text-emerald-500'">{{ money(rateFreightSaleTotal(selectedRate) - rateFreightCostTotal(selectedRate), selectedRate.currencyCodeSnapshot) }}</p>
              </div>
            </div>
            <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">La venta se modifica desde el lápiz del flete.</p>
          </article>

          <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Costos de destino</p>
            <div v-if="selectedRateDestinationCostRows.length" class="mt-3 space-y-2">
              <div v-for="row in selectedRateDestinationCostRows" :key="String(row.id)" class="grid grid-cols-[1fr_auto_auto] gap-2 text-sm font-semibold">
                <span class="truncate text-[var(--dh-text)]">{{ row.name }}</span>
                <span>{{ money(row.amount, String(row.currencyCodeSnapshot || selectedRate.currencyCodeSnapshot || 'USD')) }}</span>
                <span>{{ money(costSaleAmount(row), String(row.currencyCodeSnapshot || selectedRate.currencyCodeSnapshot || 'USD')) }}</span>
              </div>
            </div>
            <p v-else class="mt-3 text-sm font-semibold text-[var(--dh-text-muted)]">Sin costos de destino.</p>
          </article>
        </section>

        <section class="grid gap-5 xl:grid-cols-2">
          <article class="space-y-3">
            <h3 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.rates.fclDetails') }}</h3>
            <DhDataTable :columns="fclDetailColumns" :rows="selectedRateFclRows" :empty-text="t('pricing.rates.noFclDetails')">
              <template #cell-route="{ row }">{{ row.originPortNameSnapshot || row.originPortCodeSnapshot }} → {{ readPoeFromNotes(String(row.notes ?? '')) || '—' }} → {{ row.destinationPortNameSnapshot || row.destinationPortCodeSnapshot }}</template>
              <template #cell-amount="{ row }">{{ money(row.amount, String(row.currencyCodeSnapshot || selectedRate?.currencyCodeSnapshot || 'USD')) }}</template>
              <template #cell-__actions="{ row }">
                <div class="flex justify-end gap-2">
                  <DhButton size="sm" variant="secondary" :icon="Pencil" :disabled="!canUpdateFclDetail" @click.stop="openEditFclRateDetail(row)" />
                </div>
              </template>
            </DhDataTable>
          </article>

          <article class="space-y-3">
            <h3 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.rates.costDetails') }}</h3>
            <DhDataTable :columns="costDetailColumns" :rows="selectedRateCostRows" :empty-text="t('pricing.rates.noCostDetails')">
              <template #cell-costType="{ value }">{{ costTypeLabel(String(value)) }}</template>
              <template #cell-isFixed="{ value }"><DhBadge :variant="value ? 'success' : 'neutral'" :label="value ? t('pricing.common.fixed') : t('pricing.common.variable')" /></template>
              <template #cell-isManual="{ value }"><DhBadge :variant="value ? 'warning' : 'success'" :label="value ? t('pricing.common.manual') : t('pricing.common.automatic')" /></template>
              <template #cell-amount="{ row }">{{ money(row.amount, String(row.currencyCodeSnapshot || selectedRate?.currencyCodeSnapshot || 'USD')) }}</template>
              <template #cell-saleAmount="{ row }">{{ money(costSaleAmount(row), String(row.currencyCodeSnapshot || selectedRate?.currencyCodeSnapshot || 'USD')) }}</template>
              <template #cell-profit="{ row }">{{ money(costSaleAmount(row) - rowAmount(row.amount), String(row.currencyCodeSnapshot || selectedRate?.currencyCodeSnapshot || 'USD')) }}</template>
              <template #cell-__actions="{ row }">
                <div class="flex justify-end gap-2">
                  <DhButton
                    size="sm"
                    variant="secondary"
                    :icon="Pencil"
                    :disabled="!canUpdateCostDetail"
                    @click.stop="openEditRateCostDetail(row)"
                  />
                  <DhButton
                    size="sm"
                    variant="danger"
                    :icon="Trash2"
                    :label="t('common.delete')"
                    :loading="savingCostDetail"
                    :disabled="!canDeleteCostDetail"
                    @click.stop="removeRateCostDetail(row)"
                  />
                </div>
              </template>
            </DhDataTable>
          </article>
        </section>

        <section v-if="selectedRate.marginApprovals?.length" class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <h3 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.marginApprovals.title') }}</h3>
          <div class="mt-3 space-y-3">
            <article v-for="approval in selectedRate.marginApprovals" :key="approval.id" class="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <DhBadge :variant="statusVariant(approval.status)" :label="statusLabel(approval.status)" />
                  <span class="text-sm font-black text-[var(--dh-text)]">{{ percent(approval.requestedMargin) }} / {{ percent(approval.minimumMargin) }}</span>
                </div>
                <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ approval.reason || '—' }}</p>
              </div>
              <div v-if="approval.status === 'Pending'" class="flex gap-2">
                <DhButton size="sm" variant="secondary" :label="t('pricing.actions.approve')" :disabled="!canApproveLowMargin" @click="approveMargin(approval.id)" />
                <DhButton size="sm" variant="danger" :label="t('pricing.actions.reject')" :disabled="!canApproveLowMargin" @click="rejectMargin(approval.id)" />
              </div>
            </article>
          </div>
        </section>

        <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricing.rates.addCostTitle') }}</h3>
            <DhButton variant="secondary" :icon="Plus" :label="t('pricing.actions.newCostAndApply')" :disabled="!canCreateCost" @click="openCostDrawer(true)" />
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <label class="md:col-span-3 block">
              <span class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Costos opcionales</span>
              <select v-model="rateCostForm.optionalCostIds" multiple class="min-h-28 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none backdrop-blur-xl transition dh-focus-primary">
                <option v-for="option in optionalCostTemplateOptions" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
              </select>
              <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">Puede seleccionar varios opcionales asociados a la naviera y al POD/destino.</span>
            </label>
            <DhInput v-model="rateCostForm.name" label="Costo manual" />
            <DhSelect v-model="rateCostForm.costType" :label="t('pricing.common.costType')" :options="costTypeOptions" />
            <DhSelect v-model="rateCostForm.currency" :label="t('pricing.common.currency')" :options="catalogOptions.currencies" :disabled="loadingCatalogs" />
            <DhInput v-model="rateCostForm.amount" label="Costo" type="number" step="0.01" />
            <DhInput v-model="rateCostForm.saleAmount" label="Venta" type="number" step="0.01" :placeholder="rateCostForm.amount" />
            <DhTextarea v-model="rateCostForm.notes" class="md:col-span-3" :label="t('pricing.common.notes')" :rows="2" />
            <p class="md:col-span-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text-muted)]">
              {{ t('pricing.rates.costSaleHelper') }}
            </p>
          </div>

          <div class="mt-4 flex justify-end">
            <DhButton :icon="Plus" :label="t('pricing.actions.addCost')" :loading="savingCostDetail" :disabled="!canCreateCostDetail" @click="saveRateCostDetail" />
          </div>
        </section>
      </div>
    </DhDrawer>

    <DhDrawer :open="costDrawerOpen" :title="editingCost ? t('pricing.costs.drawerTitleEdit') : creatingCostFromRate ? t('pricing.costs.drawerTitleFromRate') : t('pricing.costs.drawerTitle')" size="lg" @close="costDrawerOpen = false">
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="costForm.name" :label="t('pricing.common.name')" :placeholder="t('pricing.costs.namePlaceholder')" />
          <DhSelect v-model="costForm.rateType" :label="t('pricing.common.rateType')" :options="rateTypeOptions" />
          <DhSelect v-model="costForm.costType" :label="t('pricing.common.costType')" :options="costTypeOptions" />
          <DhSelect v-model="costForm.carrier" :label="t('pricing.common.carrier')" :options="catalogOptions.carriers" :disabled="loadingCatalogs" />
          <DhSelect v-model="costForm.port" :label="t('pricing.common.port')" :options="costPortOptions" :disabled="loadingCatalogs" />
          <DhSelect v-model="costForm.portRole" :label="t('pricing.common.portRole')" :options="portRoleOptions" :disabled="false" />
          <DhSelect v-model="costForm.currency" :label="t('pricing.common.currency')" :options="catalogOptions.currencies" :disabled="loadingCatalogs" />
          <DhInput v-model="costForm.amount" label="Costo" type="number" step="0.01" />
          <DhInput v-model="costForm.saleAmount" label="Venta" type="number" step="0.01" :placeholder="costForm.amount ? String(minimumSaleAmount(toNumber(costForm.amount))) : ''" />
          <DhCheckbox v-model="costForm.isFixed" :label="t('pricing.common.fixedCost')" />
          <DhCheckbox v-model="costForm.requiresManualAmount" :label="t('pricing.common.manualAmount')" />
          <DhCheckbox v-model="costForm.isOptional" label="Costo opcional" />
          <p class="md:col-span-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ isAutomaticFixedCost ? t('pricing.costs.automaticFixedHelp') : t('pricing.costs.variableFormHelp') }}
          </p>
          <DhTextarea v-model="costForm.notes" class="md:col-span-2" :label="t('pricing.common.notes')" :rows="3" />
        </div>

        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="costDrawerOpen = false" />
          <DhButton :icon="editingCost ? Pencil : Plus" :label="editingCost ? t('common.save') : creatingCostFromRate ? t('pricing.actions.createAndApply') : t('pricing.actions.createCost')" :loading="savingCost" @click="saveCost" />
        </div>
      </div>
    </DhDrawer>

    <DhModal :open="deleteCostModalOpen" :title="t('pricing.costs.deleteTitle')" size="md" @close="deleteCostModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.costs.deleteMessage', { name: costToDelete?.name || '' }) }}</p>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="deleteCostModalOpen = false" />
          <DhButton variant="danger" :icon="Trash2" :label="t('common.delete')" :loading="deletingCost" @click="deleteCost" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="manualRateModalOpen" :title="t('pricing.manualRate.title')" size="xl" @close="manualRateModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.manualRate.description') }}</p>
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="manualRateForm.agentName" label="Agente" :options="agentOptions" />
          <DhSelect v-model="manualRateForm.carrier" :label="t('pricing.common.carrier')" :options="catalogOptions.carriers" :disabled="loadingCatalogs" />
          <DhSelect v-model="manualRateForm.originPort" label="POL" :options="catalogOptions.pol" :disabled="loadingCatalogs" />
          <DhSelect v-model="manualRateForm.poePort" label="POE" :options="catalogOptions.poe" :disabled="loadingCatalogs" />
          <DhSelect v-model="manualRateForm.destinationPort" label="POD" :options="catalogOptions.pod" :disabled="loadingCatalogs" />
          <DhSelect v-model="manualRateForm.finalDestinationPort" label="Destino final" :options="catalogOptions.pod" :disabled="loadingCatalogs" />
          <DhSelect v-model="manualRateForm.containerType" :label="t('pricing.common.container')" :options="catalogOptions.containerTypes" :disabled="loadingCatalogs" />
          <DhSelect v-model="manualRateForm.currency" :label="t('pricing.common.currency')" :options="catalogOptions.currencies" :disabled="loadingCatalogs" />
          <DhInput v-model="manualRateForm.amount" label="Costo del flete" type="number" step="0.01" />
          <DhInput v-model="manualRateForm.freeDays" :label="t('pricing.common.freeDays')" type="number" step="1" />
          <DhInput v-model="manualRateForm.validFrom" :label="t('pricing.common.validFrom')" type="date" />
          <DhInput v-model="manualRateForm.validTo" :label="t('pricing.common.validTo')" type="date" />
          <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text-muted)]">Margen esperado: <strong>12%</strong>. Solo Administrador/SuperUsuario puede crear tarifa directa.</div>
          <DhInput v-model="manualRateForm.saleAmount" label="Venta manual del flete" type="number" step="0.01" :disabled="!canApproveFreight" />
          <DhCheckbox v-model="manualRateForm.applyAutomaticFixedCosts" class="md:col-span-2" :label="t('pricing.manualRate.applyAutomaticCosts')" />
          <p class="md:col-span-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ t('pricing.manualRate.helper') }}
          </p>
          <DhTextarea v-model="manualRateForm.notes" class="md:col-span-2" :label="t('pricing.common.notes')" :rows="3" />
        </div>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="manualRateModalOpen = false" />
          <DhButton :icon="Plus" :label="t('pricing.actions.createRate')" :loading="savingManualRate" :disabled="!canCreateDirectManualRate" @click="createManualRate" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="fclRateEditModalOpen" :title="t('pricing.rates.editFreightTitle')" size="lg" @close="fclRateEditModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.rates.editFreightHelp') }}</p>
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="fclRateEditForm.carrier" :label="t('pricing.common.carrier')" :options="catalogOptions.carriers" :disabled="loadingCatalogs" />
          <DhSelect v-model="fclRateEditForm.containerType" :label="t('pricing.common.container')" :options="catalogOptions.containerTypes" :disabled="loadingCatalogs" />
          <DhSelect v-model="fclRateEditForm.originPort" label="POL" :options="catalogOptions.pol" :disabled="loadingCatalogs" />
          <DhSelect v-model="fclRateEditForm.poePort" label="POE" :options="catalogOptions.poe" :disabled="loadingCatalogs" />
          <DhSelect v-model="fclRateEditForm.destinationPort" label="POD" :options="catalogOptions.pod" :disabled="loadingCatalogs" />
          <DhSelect v-model="fclRateEditForm.currency" :label="t('pricing.common.currency')" :options="catalogOptions.currencies" :disabled="loadingCatalogs" />
          <DhInput v-model="fclRateEditForm.amount" label="Costo del flete" type="number" step="0.01" />
          <DhInput v-model="fclRateEditForm.saleAmount" label="Venta del flete" type="number" step="0.01" :disabled="!canApproveFreight" />
          <DhInput v-model="fclRateEditForm.freeDays" :label="t('pricing.common.freeDays')" type="number" step="1" />
          <div class="grid gap-3 md:grid-cols-2">
            <DhInput v-model="fclRateEditForm.validFrom" :label="t('pricing.common.validFrom')" type="date" />
            <DhInput v-model="fclRateEditForm.validTo" :label="t('pricing.common.validTo')" type="date" />
          </div>
          <DhTextarea v-model="fclRateEditForm.notes" class="md:col-span-2" :label="t('pricing.common.notes')" :rows="3" />
        </div>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="fclRateEditModalOpen = false" />
          <DhButton :icon="Pencil" :label="t('common.save')" :loading="savingFclRateEdit" :disabled="!canUpdateFclDetail" @click="saveFclRateDetailEdit" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="rateCostEditModalOpen" :title="t('pricing.rates.editCostTitle')" size="lg" @close="rateCostEditModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.rates.editCostHelp') }}</p>
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="rateCostEditForm.name" :label="t('pricing.common.name')" />
          <DhSelect v-model="rateCostEditForm.costType" :label="t('pricing.common.costType')" :options="costTypeOptions" />
          <DhSelect v-model="rateCostEditForm.currency" :label="t('pricing.common.currency')" :options="catalogOptions.currencies" :disabled="loadingCatalogs" />
          <DhInput v-model="rateCostEditForm.amount" label="Costo" type="number" step="0.01" />
          <DhInput v-model="rateCostEditForm.saleAmount" label="Venta" type="number" step="0.01" class="md:col-span-2" />
          <DhTextarea v-model="rateCostEditForm.notes" class="md:col-span-2" :label="t('pricing.common.notes')" :rows="3" />
        </div>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="rateCostEditModalOpen = false" />
          <DhButton :icon="Pencil" :label="t('common.save')" :loading="savingRateCostEdit" :disabled="!canUpdateCostDetail" @click="saveRateCostDetailEdit" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="rejectModalOpen" :title="t('pricing.reject.title')" size="md" @close="rejectModalOpen = false">
      <div class="space-y-4">
        <DhTextarea v-model="rejectForm.reason" :label="t('pricing.reject.reason')" :placeholder="t('pricing.reject.placeholder')" :rows="4" />
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="rejectModalOpen = false" />
          <DhButton variant="danger" :icon="X" :label="t('pricing.actions.reject')" @click="rejectImport" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="duplicateRateModalOpen" :title="t('pricing.duplicateRate.title')" size="md" @close="duplicateRateModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.duplicateRate.description') }}</p>
        <DhInput v-model="duplicateRateForm.clientName" label="Agente" />
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-semibold text-[var(--dh-text-muted)]">Margen esperado: <strong>12%</strong></div>
          <DhInput v-model="duplicateRateForm.saleAmount" type="number" step="0.01" :label="t('pricing.duplicateRate.saleAmount')" :disabled="!canApproveFreight" />
        </div>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.duplicateRate.helper') }}</p>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="duplicateRateModalOpen = false" />
          <DhButton variant="primary" :icon="Copy" :loading="duplicatingRate" :label="t('pricing.actions.duplicate')" @click="duplicateRate" />
        </div>
      </div>
    </DhModal>

    <DhModal :open="marginRejectModalOpen" :title="t('pricing.marginReject.title')" size="md" @close="marginRejectModalOpen = false">
      <div class="space-y-4">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.marginReject.description') }}</p>
        <DhTextarea v-model="marginRejectForm.reason" :label="t('pricing.marginReject.reason')" :placeholder="t('pricing.marginReject.placeholder')" :rows="4" />
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" :label="t('common.cancel')" @click="marginRejectModalOpen = false" />
          <DhButton variant="danger" :icon="X" :label="t('pricing.actions.reject')" @click="submitMarginReject" />
        </div>
      </div>
    </DhModal>

    <section v-if="selectedRate && canPrintSelectedRate" class="pricing-print-only">
      <div class="quote-card">
        <div class="quote-topbar"></div>

        <header class="quote-header">
          <div class="quote-title">
            <p class="quote-eyebrow">{{ t('pricing.print.quote') }}</p>
            <h1>{{ selectedRate.clientNameSnapshot || 'Sin agente' }}</h1>
            <p>{{ t('pricing.print.preparedFor') }}</p>
          </div>
          <div class="quote-meta-card">
            <p class="quote-meta-label">{{ t('pricing.print.date') }}</p>
            <p class="quote-meta-value">{{ quoteDateLabel }}</p>
            <p class="quote-meta-label quote-meta-spaced">{{ t('pricing.rates.validity') }}</p>
            <p class="quote-meta-value">{{ selectedRate.validFrom?.slice(0, 10) || '—' }} / {{ selectedRate.validTo?.slice(0, 10) || '—' }}</p>
          </div>
        </header>

        <section class="quote-summary">
          <article>
            <p>{{ t('pricing.print.route') }}</p>
            <strong>{{ routeLabel(selectedRate) }}</strong>
          </article>
          <article>
            <p>{{ t('pricing.common.carrier') }}</p>
            <strong>{{ carrierLabel(selectedRate) }}</strong>
          </article>
          <article>
            <p>{{ t('pricing.common.container') }}</p>
            <strong>{{ selectedRateMainDetail?.containerTypeNameSnapshot || selectedRateMainDetail?.containerTypeCodeSnapshot || 'FCL' }}</strong>
          </article>
          <article class="quote-summary-total">
            <p>{{ t('pricing.print.total') }}</p>
            <strong>{{ money(selectedRate.saleAmount, selectedRate.currencyCodeSnapshot) }}</strong>
          </article>
        </section>

        <table class="quote-table">
          <thead>
            <tr>
              <th>{{ t('pricing.print.item') }}</th>
              <th>{{ t('pricing.print.detail') }}</th>
              <th class="text-right">{{ t('pricing.rates.saleAmount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="selectedRateBaseSaleAmount > 0">
              <td>
                <strong>{{ t('pricing.print.oceanFreight') }}</strong>
                <span>{{ routeLabel(selectedRate) }}</span>
              </td>
              <td>{{ selectedRateMainDetail?.containerTypeNameSnapshot || selectedRateMainDetail?.containerTypeCodeSnapshot || 'FCL' }}</td>
              <td class="text-right">{{ money(selectedRateBaseSaleAmount, selectedRate.currencyCodeSnapshot) }}</td>
            </tr>
            <tr v-for="row in clientVisibleCostRows" :key="String(row.id)">
              <td>
                <strong>{{ row.name }}</strong>
                <span>{{ costTypeLabel(String(row.costType)) }}</span>
              </td>
              <td>{{ row.isManual ? t('pricing.common.manual') : t('pricing.common.automatic') }}</td>
              <td class="text-right">{{ money(costSaleAmount(row), String(row.currencyCodeSnapshot || selectedRate.currencyCodeSnapshot || 'USD')) }}</td>
            </tr>
          </tbody>
        </table>

        <section class="quote-total-box">
          <div>
            <p>{{ t('pricing.print.currency') }}</p>
            <strong>{{ selectedRate.currencyCodeSnapshot }}</strong>
          </div>
          <div>
            <p>{{ t('pricing.print.total') }}</p>
            <strong>{{ money(selectedRate.saleAmount, selectedRate.currencyCodeSnapshot) }}</strong>
          </div>
        </section>

        <footer class="quote-footer">
          <p>{{ t('pricing.print.footer') }}</p>
          <p>{{ t('pricing.print.footerNote') }}</p>
        </footer>
      </div>
    </section>

  </section>
</template>


<style scoped>
.pricing-print-only {
  display: none;
}

@media print {
  @page {
    size: A4;
    margin: 14mm;
  }

  :global(body *) {
    visibility: hidden !important;
  }

  .pricing-print-only,
  .pricing-print-only * {
    visibility: visible !important;
  }

  .pricing-print-only {
    display: block !important;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #f8fafc;
    color: #0f172a;
    padding: 0;
    font-family: Inter, Arial, sans-serif;
  }

  .quote-card {
    min-height: 100vh;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    box-shadow: 0 18px 55px rgba(15, 23, 42, 0.12);
    overflow: hidden;
  }

  .quote-topbar {
    height: 10px;
    background: linear-gradient(90deg, #fc2800 0%, #111827 52%, #fc2800 100%);
  }

  .quote-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 28px;
    padding: 28px 30px 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .quote-title h1 {
    margin: 6px 0 8px;
    color: #0f172a;
    font-size: 30px;
    font-weight: 950;
    line-height: 1.05;
  }

  .quote-title > p:not(.quote-eyebrow) {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    font-weight: 750;
  }

  .quote-eyebrow {
    margin: 0;
    color: #fc2800;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .quote-meta-card {
    align-self: start;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: #f8fafc;
    padding: 14px 16px;
    text-align: right;
  }

  .quote-meta-label {
    margin: 0;
    color: #64748b;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .quote-meta-spaced {
    margin-top: 12px;
  }

  .quote-meta-value {
    margin: 3px 0 0;
    color: #0f172a;
    font-size: 12px;
    font-weight: 900;
  }

  .quote-summary {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr 1.2fr;
    gap: 12px;
    padding: 22px 30px;
  }

  .quote-summary article {
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: #f8fafc;
    padding: 14px 16px;
  }

  .quote-summary p,
  .quote-total-box p {
    margin: 0;
    color: #64748b;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .quote-summary strong {
    display: block;
    margin-top: 5px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 950;
  }

  .quote-summary-total {
    background: #111827 !important;
    border-color: #111827 !important;
  }

  .quote-summary-total p,
  .quote-summary-total strong {
    color: #ffffff !important;
  }

  .quote-table {
    width: calc(100% - 60px);
    margin: 0 30px;
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    font-size: 12px;
  }

  .quote-table th {
    background: #111827;
    color: #ffffff;
    padding: 12px 14px;
    text-align: left;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .quote-table td {
    border-top: 1px solid #e5e7eb;
    padding: 13px 14px;
    color: #0f172a;
    font-weight: 750;
    vertical-align: top;
  }

  .quote-table tbody tr:nth-child(even) td {
    background: #f8fafc;
  }

  .quote-table td strong {
    display: block;
    color: #0f172a;
    font-size: 12px;
    font-weight: 950;
  }

  .quote-table td span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
  }

  .quote-total-box {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 14px;
    width: 360px;
    margin: 22px 30px 0 auto;
  }

  .quote-total-box div {
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 14px 16px;
    background: #f8fafc;
    text-align: right;
  }

  .quote-total-box div:last-child {
    background: #fc2800;
    border-color: #fc2800;
  }

  .quote-total-box div:last-child p,
  .quote-total-box div:last-child strong {
    color: #ffffff;
  }

  .quote-total-box strong {
    display: block;
    margin-top: 5px;
    color: #0f172a;
    font-size: 18px;
    font-weight: 950;
  }

  .text-right {
    text-align: right !important;
  }

  .quote-footer {
    margin: 28px 30px 0;
    border-top: 1px solid #e5e7eb;
    padding-top: 16px;
    color: #64748b;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.5;
  }

  .quote-footer p {
    margin: 0 0 4px;
  }
}
</style>
