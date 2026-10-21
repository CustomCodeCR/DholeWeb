<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Copy, Edit3, Eye, FileSpreadsheet, ReceiptText, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhMultiSelect } from '@/shared/components/atoms'
import { DhCrudToolbar, DhPagination } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import { UsersService } from '@/core/services/usersService'
import { SellerVisibilityService } from '@/core/services/sellerVisibilityService'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { RateDto, RateStatus } from '@/core/interfaces/pricing'
import PricingDuplicateRateModal from '@/modules/pricing/components/PricingDuplicateRateModal.vue'
import PricingApplyTariffModal from '@/modules/pricing/components/PricingApplyTariffModal.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import {
  formatDate,
  formatMoney,
  marginTone,
  landEquipmentSummary,
  rateDisplayName,
  routeLabel,
  statusTone,
} from '@/modules/pricing/utils/pricingFormat'

type CommercialRateStatus = 'PendingApproval' | 'Open' | 'Sent' | 'Expired' | 'AcceptedByClient' | 'PendingReapproval' | 'RejectedByClient' | 'Cancelled'
type CommercialRateStatusFilter = CommercialRateStatus | ''

const commercialStatuses = new Set<CommercialRateStatus>([
  'PendingApproval',
  'Open',
  'Sent',
  'Expired',
  'AcceptedByClient',
  'PendingReapproval',
  'RejectedByClient',
  'Cancelled',
])

function normalizeCommercialStatus(value: unknown): CommercialRateStatusFilter {
  const status = typeof value === 'string' ? value : ''
  if (commercialStatuses.has(status as CommercialRateStatus)) return status as CommercialRateStatus
  if (status === 'RejectedByClient' || status === 'Closed') return 'RejectedByClient'
  if (status === 'Sent' || status === 'RequestedByClient') return 'Sent'
  if (status === 'Expired') return 'Expired'
  if (status === 'AcceptedByClient') return 'AcceptedByClient'
  return ''
}

// The seller endpoint returns the full owner-scoped list, so sort before
// client-side pagination to keep accepted quotes without IDTRA at the top.
function acceptedRateMissingIdtra(rate: RateDto): boolean {
  return normalizeCommercialStatus(rate.status) === 'AcceptedByClient'
    && !String(rate.idtraNumber ?? '').trim()
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const displayRate = (rate: RateDto) => catalogs.resolveRateLabels(rate)
const displayRateName = (rate: RateDto) => rateDisplayName(displayRate(rate))

function containerSummary(rate: RateDto) {
  if (rate.shipmentMode === 'Lcl' || rate.shipmentMode === 'Ltl') {
    return `${rate.shipmentMode.toUpperCase()} · ${Number(rate.chargeableQuantity || 0).toFixed(3)} CBM`
  }
  if (rate.shipmentMode === 'Ftl') return landEquipmentSummary(rate)
  const allocations = rate.containers?.filter((item) => item.quantity > 0) ?? []
  if (allocations.length === 0) return `${rate.containerQuantity} × ${rate.containerTypeName}`
  return allocations.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
}

function operationProvider(rate: RateDto) {
  if (rate.shipmentMode === 'Ftl') return 'TIGSA'
  return rate.carrierName || 'Sin naviera'
}

function operationAgent(rate: RateDto) {
  if (rate.shipmentMode === 'Ftl' || rate.shipmentMode === 'Ltl') return 'Grupo Castro Fallas'
  return rate.agentName || '—'
}

function canonicalRateCurrency(code?: string | null, name?: string | null) {
  const value = `${code ?? ''} ${name ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()

  if (value.includes('CRC') || value.includes('COLON')) return 'CRC'
  if (value.includes('USD') || value.includes('DOLAR') || value.includes('DOLLAR')) return 'USD'
  return ''
}

function rateFinancialSummary(rate: RateDto) {
  const exchangeRate = Number(rate.exchangeRateApplied || rate.exchangeRateSale || 0)
  let costUsd = 0
  let saleUsd = 0
  let costCrc = 0
  let saleCrc = 0
  let taxUsd = 0
  let taxCrc = 0
  let recognizedDetails = false

  for (const detail of rate.rateDetails ?? []) {
    const quantity = Number(detail.quantity) > 0 ? Number(detail.quantity) : 1
    const cost = Number(detail.costAmount || 0) * quantity
    const sale = Number(detail.saleAmount || 0) * quantity
    const tax = Number(detail.destinationTaxAmount || 0) * quantity
    const code = canonicalRateCurrency(detail.currencyCode, detail.currencyName)

    if (code === 'USD') {
      recognizedDetails = true
      costUsd += cost
      saleUsd += sale
      taxUsd += tax
      if (exchangeRate > 0) {
        costCrc += cost * exchangeRate
        saleCrc += sale * exchangeRate
        taxCrc += tax * exchangeRate
      }
    } else if (code === 'CRC') {
      recognizedDetails = true
      costCrc += cost
      saleCrc += sale
      taxCrc += tax
      if (exchangeRate > 0) {
        costUsd += cost / exchangeRate
        saleUsd += sale / exchangeRate
        taxUsd += tax / exchangeRate
      }
    }
  }

  const detailValues = Math.abs(costUsd) + Math.abs(saleUsd) + Math.abs(costCrc) + Math.abs(saleCrc)

  if (!recognizedDetails || detailValues === 0) {
    costUsd = Number(rate.totalCostUsd || 0)
    saleUsd = Number(rate.totalSaleUsd || 0)
    costCrc = Number(rate.totalCostCrc || 0)
    saleCrc = Number(rate.totalSaleCrc || 0)
    taxUsd = Number((rate as RateDto & { totalTaxUsd?: number }).totalTaxUsd || 0)
    taxCrc = Number((rate as RateDto & { totalTaxCrc?: number }).totalTaxCrc || 0)

    const dualValues = Math.abs(costUsd) + Math.abs(saleUsd) + Math.abs(costCrc) + Math.abs(saleCrc)

    if (dualValues === 0) {
      const nativeCost = Number(rate.totalCostAmount || 0)
      const nativeSale = Number(rate.totalSaleAmount || 0)
      const nativeCode = canonicalRateCurrency(rate.currencyCode, rate.currencyName) || 'USD'

      if (nativeCode === 'CRC') {
        costCrc = nativeCost
        saleCrc = nativeSale
        if (exchangeRate > 0) {
          costUsd = nativeCost / exchangeRate
          saleUsd = nativeSale / exchangeRate
        }
      } else {
        costUsd = nativeCost
        saleUsd = nativeSale
        if (exchangeRate > 0) {
          costCrc = nativeCost * exchangeRate
          saleCrc = nativeSale * exchangeRate
        }
      }
    }
  }

  if (exchangeRate > 0) {
    if ((costUsd !== 0 || saleUsd !== 0) && costCrc === 0 && saleCrc === 0) {
      costCrc = costUsd * exchangeRate
      saleCrc = saleUsd * exchangeRate
    } else if ((costCrc !== 0 || saleCrc !== 0) && costUsd === 0 && saleUsd === 0) {
      costUsd = costCrc / exchangeRate
      saleUsd = saleCrc / exchangeRate
    }

    if (taxUsd !== 0 && taxCrc === 0) taxCrc = taxUsd * exchangeRate
    if (taxCrc !== 0 && taxUsd === 0) taxUsd = taxCrc / exchangeRate
  }

  const utilityUsd = saleUsd - costUsd
  const utilityCrc = saleCrc - costCrc
  const margin = saleUsd > 0
    ? (utilityUsd / saleUsd) * 100
    : saleCrc > 0
      ? (utilityCrc / saleCrc) * 100
      : Number(rate.marginPercentage || 0)

  return {
    costUsd,
    costCrc,
    saleUsd,
    saleCrc,
    subtotalUsd: saleUsd,
    subtotalCrc: saleCrc,
    taxUsd,
    taxCrc,
    totalUsd: saleUsd + taxUsd,
    totalCrc: saleCrc + taxCrc,
    utilityUsd,
    utilityCrc,
    margin,
  }
}

const rows = ref<RateDto[]>([])
const creatorDirectory = ref<Record<string, { displayName: string; userName: string }>>({})

async function loadCreatorDirectory() {
  try {
    const users = await UsersService.browse({ pageNumber: 1, pageSize: 200 })
    creatorDirectory.value = Object.fromEntries(
      users.map((user) => [user.id, { displayName: user.displayName, userName: user.userName }]),
    )
  } catch {
    creatorDirectory.value = {}
  }
}

function creatorDisplayName(rate: RateDto) {
  if (rate.createdByDisplayName) return rate.createdByDisplayName
  if (rate.createdByUserName) return rate.createdByUserName
  if (rate.createdByUserId) {
    const user = creatorDirectory.value[rate.createdByUserId]
    return user?.displayName || user?.userName || rate.createdByUserId
  }
  return '—'
}

function creatorUserName(rate: RateDto) {
  if (rate.createdByUserName) return rate.createdByUserName
  if (!rate.createdByUserId) return ''
  return creatorDirectory.value[rate.createdByUserId]?.userName || ''
}

function auditDisplayName(displayName?: string | null, userName?: string | null, userId?: string | null) {
  if (displayName) return displayName
  if (userName) return userName
  if (!userId) return '—'
  const user = creatorDirectory.value[userId] || creatorDirectory.value[userId.toLowerCase()]
  return user?.displayName || user?.userName || userId
}

function reviewerDisplayName(rate: RateDto) {
  return auditDisplayName(rate.reviewedByDisplayName, rate.reviewedByUserName, rate.reviewedByUserId)
}

function lastModifierDisplayName(rate: RateDto) {
  return auditDisplayName(rate.lastModifiedByDisplayName, rate.lastModifiedByUserName, rate.lastModifiedByUserId)
}
const selectedIds = ref<string[]>([])
const loading = ref(false)
const loadError = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selectedExecutiveNames = ref<string[]>([])
const executiveOptions = ref<string[]>([])
const executivesLoading = ref(false)

async function loadExecutiveOptions() {
  executivesLoading.value = true
  try {
    const sellers = await SellerVisibilityService.rateOptions()
    const names = new Map<string, string>()
    for (const seller of sellers) {
      const name = String(seller.displayName || seller.userName || seller.email || '').trim()
      if (name) names.set(name.toLocaleLowerCase('es'), name)
    }
    executiveOptions.value = [...names.values()].sort((a, b) => a.localeCompare(b, 'es'))
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la lista de vendedores.')
  } finally {
    executivesLoading.value = false
  }
}

const initialStatus = normalizeCommercialStatus(route.query.status)
const selectedFilters = reactive({
  statuses: initialStatus ? [initialStatus] : [] as string[],
  agentIds: [] as string[],
  carrierIds: [] as string[],
  polIds: [] as string[],
  poeIds: [] as string[],
  podIds: [] as string[],
  containerTypeIds: [] as string[],
  currencyIds: [] as string[],
})

const filters = reactive({
  search: '',
  idtraNumber: '',
  quoNumber: '',
  quoteDate: '',
  validFrom: '',
  validTo: '',
})

const hasPricingOperatorAccess = computed(() =>
  authStore.hasScope(PRICING_SCOPES.rates.create)
  || authStore.hasScope(PRICING_SCOPES.rates.update)
  || authStore.hasScope(PRICING_SCOPES.rates.delete)
  || authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin)
  || authStore.hasScope(PRICING_SCOPES.rates.approveFreight)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.review)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.approve)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.reject)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate),
)

const isSellerUser = computed(() => {
  const sellerRole = authStore.roles.some((role) => {
    const value = role.trim().toLowerCase()
    return value === 'vendedor'
      || value === 'seller'
      || value === 'ventas'
      || value.includes('vendedor')
      || value.includes('seller')
  })

  const sellerCapability = sellerRole || authStore.hasScope('pricing.rate-request.create')
  return sellerCapability && !hasPricingOperatorAccess.value
    && !authStore.hasScope('pricing.rate-request.view-all')
})

const canCreate = computed(() =>
  !isSellerUser.value && authStore.hasScope(PRICING_SCOPES.rates.create),
)
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))

const requestedRateUpdateStatuses = new Set<RateStatus>([
  'PendingApproval',
  'ApprovedByManagement',
  'RejectedByManagement',
  'Open',
  'Sent',
  'RequestedByClient',
])

function canUpdateRate(rate: RateDto) {
  return canUpdate.value && requestedRateUpdateStatuses.has(rate.status)
}

function isMasterTariff(rate: RateDto | null | undefined) {
  if (!rate || rate.rateType !== 'Tariff') return false
  const clientName = typeof rate.clientName === 'string' ? rate.clientName : ''
  return clientName.toUpperCase().includes('TARIFARIO')
}

function canApplyTariffRate(rate: RateDto) {
  return canCreate.value
    && isMasterTariff(rate)
    && ['ApprovedByManagement', 'Open', 'Sent', 'RequestedByClient', 'AcceptedByClient'].includes(rate.status)
}

function rateUpdateWindowMessage(rate: RateDto) {
  if (rate.status === 'Sent' || rate.status === 'RequestedByClient') {
    return 'La tarifa está enviada y todavía está pendiente de aceptación o rechazo del vendedor.'
  }
  return 'La tarifa todavía se encuentra dentro de la solicitud antes del envío de Pricing.'
}

const statusOptions: Array<{ label: string; value: CommercialRateStatusFilter }> = [
  { label: 'Todas', value: '' },
  { label: 'Pendientes de aprobación', value: 'PendingApproval' },
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'Aprobada pendiente de re-aprobación', value: 'PendingReapproval' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
  { label: 'Canceladas', value: 'Cancelled' },
]

const quickStatusOptions = statusOptions

const activeFiltersCount = computed(
  () => Object.values(filters).filter((value) => String(value || '').trim()).length
    + Object.values(selectedFilters).filter((values) => values.length > 0).length
    + (selectedExecutiveNames.value.length ? 1 : 0),
)

function applyQuickStatus(status: CommercialRateStatusFilter) {
  selectedFilters.statuses = status ? [status] : []
  applyFilters()
}

function commercialStatusForRate(rate: RateDto): CommercialRateStatusFilter {
  return rate.pendingReapproval ? 'PendingReapproval' : normalizeCommercialStatus(rate.status)
}

function rowStatusLabel(rate: RateDto) {
  return rate.revisionPending ? 'En modificación'
    : rate.pendingReapproval ? 'Pendiente de re-aprobación'
      : statusLabel(rate.status)
}

function rowStatusTone(rate: RateDto) {
  return rate.revisionPending || rate.pendingReapproval ? 'warning' : statusTone(rate.status)
}

function statusLabel(status: string) {
  return (
    (
      {
        Open: 'Abierta',
        PendingApproval: 'Pendiente de aprobación',
        ApprovedByManagement: 'Aprobada por gerencia',
        RejectedByManagement: 'Rechazada por gerencia',
        Sent: 'Enviada',
        RequestedByClient: 'Solicitada por cliente',
        AcceptedByClient: 'Aceptada',
        PendingReapproval: 'Aprobada pendiente de re-aprobación',
        RejectedByClient: 'No aceptada',
        Closed: 'No aceptada',
        Cancelled: 'Cancelada',
        Expired: 'Vencida',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function load() {
  try {
    loading.value = true
    loadError.value = false

    if (isSellerUser.value) {
      const response = await callEndpoint<unknown>({
        method: 'GET',
        path: '/api/pricing/seller-rates',
        headers: { Accept: 'application/json' },
      })

      let sellerRows = unwrapListResponse<RateDto>(response)
        .filter((rate) => Boolean(rate?.id))
        .filter((rate) => !isMasterTariff(rate))

      const searchValue = filters.search.trim().toLowerCase()
      sellerRows = sellerRows.filter((rate) => {
        if (selectedExecutiveNames.value.length && !selectedExecutiveNames.value.some(
          (name) => name.toLocaleLowerCase('es') === String(rate.executiveName || '').trim().toLocaleLowerCase('es'),
        )) return false
        if (selectedFilters.statuses.length && !selectedFilters.statuses.includes(commercialStatusForRate(rate))) return false
        if (selectedFilters.agentIds.length && !selectedFilters.agentIds.includes(rate.agentId || '')) return false
        if (selectedFilters.carrierIds.length && !selectedFilters.carrierIds.includes(rate.carrierId || '')) return false
        if (selectedFilters.polIds.length && !selectedFilters.polIds.includes(rate.polId || '')) return false
        if (selectedFilters.poeIds.length && !selectedFilters.poeIds.includes(rate.poeId || '')) return false
        if (selectedFilters.podIds.length && !selectedFilters.podIds.includes(rate.podId || '')) return false
        if (selectedFilters.containerTypeIds.length && !selectedFilters.containerTypeIds.includes(rate.containerTypeId || '')
          && !rate.containers?.some((item) => selectedFilters.containerTypeIds.includes(item.containerTypeId))) return false
        if (selectedFilters.currencyIds.length && !selectedFilters.currencyIds.includes(rate.currencyId || '')) return false
        if (filters.idtraNumber && !String(rate.idtraNumber || '').toLowerCase().includes(filters.idtraNumber.toLowerCase())) return false
        if (filters.quoNumber && !String(rate.quoNumber || '').toLowerCase().includes(filters.quoNumber.toLowerCase())) return false
        if (filters.validFrom && String(rate.validFrom || '').slice(0, 10) < filters.validFrom) return false
        if (filters.validTo && String(rate.validTo || '').slice(0, 10) > filters.validTo) return false

        if (!searchValue) return true
        return [
          rate.rateCode,
          rate.quoNumber,
          rate.clientName,
          rate.executiveName,
          rate.carrierName,
          rate.polName,
          rate.poeName,
          rate.podName,
        ].some((value) => String(value || '').toLowerCase().includes(searchValue))
      })

      sellerRows.sort(
        (left, right) => Number(acceptedRateMissingIdtra(right)) - Number(acceptedRateMissingIdtra(left)),
      )

      const start = (page.value - 1) * pageSize.value
      const pageRows = sellerRows.slice(start, start + pageSize.value)
      rows.value = pageRows
      await loadCreatorDirectory()
      total.value = sellerRows.length
      selectedIds.value = selectedIds.value.filter((id) => pageRows.some((row) => row.id === id))
      return
    }

    const result = await PricingService.browseRates({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: filters.search || undefined,
      statuses: selectedFilters.statuses,
      agentIds: selectedFilters.agentIds,
      carrierIds: selectedFilters.carrierIds,
      polIds: selectedFilters.polIds,
      poeIds: selectedFilters.poeIds,
      podIds: selectedFilters.podIds,
      containerTypeIds: selectedFilters.containerTypeIds,
      currencyIds: selectedFilters.currencyIds,
      idtraNumber: filters.idtraNumber || undefined,
      quoNumber: filters.quoNumber || undefined,
      quoteDate: filters.quoteDate || undefined,
      validFrom: filters.validFrom || undefined,
      validTo: filters.validTo || undefined,
      excludeTariffMasters: true,
      executiveNames: selectedExecutiveNames.value.length ? selectedExecutiveNames.value : undefined,
    })

    const safeItems = Array.isArray(result?.items)
      ? result.items.filter((row): row is RateDto => Boolean(row && row.id))
      : []

    rows.value = safeItems
    await loadCreatorDirectory()
    total.value = result?.totalCount ?? safeItems.length
    selectedIds.value = selectedIds.value.filter((id) => safeItems.some((row) => row.id === id))
  } catch (error) {
    rows.value = []
    total.value = 0
    loadError.value = true
    toastStore.backendError(error, 'No se pudieron cargar las tarifas.')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}
function clearFilters() {
  selectedExecutiveNames.value = []
  for (const key of Object.keys(selectedFilters) as Array<keyof typeof selectedFilters>) {
    selectedFilters[key] = []
  }
  Object.assign(filters, {
    search: '',
    idtraNumber: '',
    quoNumber: '',
    quoteDate: '',
    validFrom: '',
    validTo: '',
  })
  applyFilters()
}

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

function openDetail(rate: RateDto) {
  if (isSellerUser.value) {
    // Sellers must never open Pricing's internal wizard or unpublished price details.
    void router.push({ name: 'pricing-seller-rate-detail', params: { rateId: rate.id } })
    return
  }
  void router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'view' } })
}

function openEdit(rate: RateDto) {
  if (!canUpdateRate(rate)) {
    toastStore.warning(
      'Actualización no disponible',
      'Solo se puede actualizar una tarifa antes de que Pricing la envíe o mientras está enviada y pendiente de aceptación/rechazo del vendedor.',
    )
    return
  }
  toastStore.info('Actualización de tarifa', `${rateUpdateWindowMessage(rate)} Debe indicar el motivo del cambio antes de guardar.`)
  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'edit' } })
}

function applyTariff(rate: RateDto) {
  if (!canApplyTariffRate(rate)) return

  modalStore.open({
    title: 'Aplicar tarifario a cliente',
    component: PricingApplyTariffModal,
    size: 'md',
    props: {
      rate,
      onApplied: async () => {
        await load()
      },
    },
  })
}

function duplicate(rate: RateDto) {
  modalStore.open({
    title: isMasterTariff(rate) ? 'Duplicar tarifario' : 'Duplicar tarifa',
    component: PricingDuplicateRateModal,
    props: {
      rate,
      onDuplicated: async (duplicatedRateId: string) => {
        await load()
        await router.push({
          name: 'pricing-rate-wizard',
          params: { rateId: duplicatedRateId },
          query: { mode: 'edit', duplicateReview: '1' },
        })
      },
    },
  })
}

function confirmDelete() {
  if (!selectedIds.value.length) return
  modalStore.open({
    title: 'Eliminar tarifas',
    component: DhConfirmDialog,
    props: {
      title: 'Eliminar tarifas',
      message: `¿Desea eliminar ${selectedIds.value.length} tarifa${selectedIds.value.length === 1 ? '' : 's'}? Esta acción conserva la trazabilidad de auditoría.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await PricingService.deleteRates(selectedIds.value)
        selectedIds.value = []
        modalStore.close()
        toastStore.success('Tarifas eliminadas')
        await load()
      },
      onCancel: modalStore.close,
    },
  })
}

watch([page, pageSize], load)

// La vista puede permanecer montada en una pestaña al navegar desde el dashboard.
// Actualizar el filtro cuando cambie ?status= evita mostrar tarifas del estado anterior.
watch(
  () => route.query.status,
  (value) => {
    const nextStatus = normalizeCommercialStatus(value)
    const updated = nextStatus ? [nextStatus] : []
    if (selectedFilters.statuses.length === updated.length && selectedFilters.statuses.every((item, index) => item === updated[index])) return
    selectedFilters.statuses = updated
    applyFilters()
  },
)

async function openRequestedRate() {
  const rateId = typeof route.query.rateId === 'string' ? route.query.rateId.trim() : ''
  if (!rateId) return

  try {
    const rate = await PricingService.getRate(rateId)
    openDetail(rate)
  } catch (error) {
    toastStore.backendError(error, 'La tarifa fue creada, pero no se pudo abrir su detalle.')
  }
}

useViewShortcuts({
  save: load,
  refresh: load,
})

watch(
  () => route.query.rateId,
  async (rateId, previousRateId) => {
    if (rateId && rateId !== previousRateId) await openRequestedRate()
  },
)

onMounted(async () => {
  if (!isSellerUser.value) void loadExecutiveOptions()
  try {
    await catalogs.loadAll()
  } catch (error) {
    // La tabla de tarifas debe seguir operativa aunque Config no pueda cargar
    // temporalmente alguno de sus catálogos auxiliares.
    console.error('[PricingRatesView] No se pudieron cargar todos los catálogos.', error)
  }

  await load()
  await openRequestedRate()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas"
      subtitle="Seguimiento por estado comercial, incluidas las tarifas aprobadas pendientes de re-aprobación."
      :icon="ReceiptText"
    >
      <template #actions>
        <DhButton
          v-if="authStore.hasScope('pricing.rate-request.view-all')"
          label="Reporte de cotizaciones"
          :icon="FileSpreadsheet"
          @click="router.push({ name: 'pricing-commercial-report' })"
        />
      </template>
    </DhPageHeader>


    <section class="dh-glass dh-liquid rounded-[24px] p-3 sm:rounded-[32px] sm:p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Tarifas"
        :show-create="false"
        @refresh="load"
        @search="applyFilters"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} tarifas · Margen esperado 12%
            <span v-if="activeFiltersCount">
              · {{ activeFiltersCount }} filtro{{ activeFiltersCount === 1 ? '' : 's' }} activo{{
                activeFiltersCount === 1 ? '' : 's'
              }}</span
            >.
          </p></template
        >
      </DhCrudToolbar>

      <div class="dh-scrollbar mt-4 flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <span
          class="mr-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
        >
          Categorías
        </span>
        <button
          v-for="option in quickStatusOptions"
          :key="option.value"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-black transition"
          :class="
            (option.value ? selectedFilters.statuses.length === 1 && selectedFilters.statuses[0] === option.value : selectedFilters.statuses.length === 0)
              ? 'border-[var(--dh-primary)] dh-bg-primary-soft text-[var(--dh-primary)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-soft)] hover:border-[var(--dh-primary)]/50'
          "
          @click="applyQuickStatus(option.value)"
        >
          {{ option.label }}
        </button>
        <button
          v-if="activeFiltersCount"
          type="button"
          class="ml-auto text-xs font-black text-[var(--dh-primary)] hover:underline"
          @click="clearFilters"
        >
          Limpiar filtros
        </button>
      </div>

      <div
        v-if="filtersOpen"
        class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]"
      >
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DhMultiSelect
            v-model="selectedFilters.statuses"
            label="Estado"
            :options="statusOptions.filter((option) => Boolean(option.value))"
            placeholder="Todos"
            search-placeholder="Buscar estado..."
          />
          <DhMultiSelect
            v-model="selectedFilters.agentIds"
            label="Agente"
            :options="catalogs.agentOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar agente..."
          />
          <DhMultiSelect
            v-model="selectedFilters.carrierIds"
            label="Naviera"
            :options="catalogs.carrierOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar naviera..."
          />
          <DhMultiSelect
            v-model="selectedFilters.polIds"
            label="POL"
            :options="catalogs.polOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar pol..."
          />
          <DhMultiSelect
            v-model="selectedFilters.poeIds"
            label="POE"
            :options="catalogs.poeOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar poe..."
          />
          <DhMultiSelect
            v-model="selectedFilters.podIds"
            label="POD"
            :options="catalogs.podOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar pod..."
          />
          <DhMultiSelect
            v-model="selectedFilters.containerTypeIds"
            label="Contenedor"
            :options="catalogs.containerOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar contenedor..."
          />
          <DhMultiSelect
            v-model="selectedFilters.currencyIds"
            label="Moneda"
            :options="catalogs.currencyOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar moneda..."
          />
          <DhMultiSelect
            v-if="!isSellerUser"
            v-model="selectedExecutiveNames"
            label="Vendedor"
            :options="executiveOptions.map((name) => ({ label: name, value: name }))"
            :disabled="executivesLoading"
            :empty-text="executivesLoading ? 'Cargando vendedores...' : 'No hay vendedores disponibles.'"
            search-placeholder="Buscar vendedor..."
            placeholder="Todos"
          />
          <DhInput v-model="filters.idtraNumber" label="Número IDTRA" placeholder="Buscar IDTRA" />
          <DhInput v-model="filters.quoNumber" label="Número QUO" placeholder="Buscar QUO" />
          <DhInput v-model="filters.quoteDate" type="date" label="Fecha de cotización" />
          <DhInput v-model="filters.validFrom" type="date" label="Vigente desde" />
          <DhInput v-model="filters.validTo" type="date" label="Vigente hasta" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <DhButton label="Limpiar" variant="ghost" size="sm" @click="clearFilters" /><DhButton
            label="Aplicar filtros"
            size="sm"
            @click="applyFilters"
          />
        </div>
      </div>

      <div
        v-if="selectedIds.length"
        class="mt-5 flex items-center justify-between rounded-[22px] dh-bg-primary-soft px-4 py-3"
      >
        <p class="text-sm font-black text-[var(--dh-primary)]">
          {{ selectedIds.length }} seleccionada{{ selectedIds.length === 1 ? '' : 's' }}
        </p>
        <DhButton
          v-if="canDelete"
          label="Eliminar seleccionadas"
          :icon="Trash2"
          variant="danger"
          size="sm"
          @click="confirmDelete"
        />
      </div>

      <div class="mt-5">
        <!-- Phone/tablet: rates are records, not a squeezed desktop table. -->
        <div class="grid gap-3 lg:hidden">
          <div
            v-if="loading"
            class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
          >
            Cargando...
          </div>

          <div
            v-else-if="loadError"
            class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
          >
            No se pudieron cargar las tarifas. Intente nuevamente desde Actualizar.
          </div>
          <div
            v-else-if="rows.length === 0"
            class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
          >
            No hay tarifas que coincidan con los filtros.
          </div>

          <article
            v-for="row in rows"
            v-else
            :key="`mobile:${row.id}`"
            class="min-w-0 overflow-hidden rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-sm)] sm:p-4"
            @click="openDetail(row)"
          >
            <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
              <div class="shrink-0 pt-0.5" @click.stop>
                <DhCheckbox
                  :model-value="selectedIds.includes(row.id)"
                  @update:model-value="toggleSelection(row.id)"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span class="max-w-full break-all rounded-full dh-bg-primary-soft px-2.5 py-1 text-[10px] font-black text-[var(--dh-primary)]">
                    {{ row.quoNumber || row.rateCode }}
                  </span>
                  <DhBadge :label="`REV ${row.revisionNumber || 1}`" variant="primary" />
                  <DhBadge
                    :label="isMasterTariff(row) ? 'TARIFARIO · MAESTRO' : row.rateType === 'Tariff' ? 'TARIFA' : 'SPOT'"
                    :variant="row.rateType === 'Spot' ? 'warning' : isMasterTariff(row) ? 'neutral' : 'success'"
                  />
                  <span data-mobile-rate-status class="inline-flex">
                    <DhBadge :label="rowStatusLabel(row)" :variant="rowStatusTone(row)" />
                  </span>
                </div>

                <p class="mt-2 break-words text-sm font-black leading-5 text-[var(--dh-text)]">
                  {{ [row.polName, row.poeName, row.podName].filter(Boolean).join(' → ') }}
                </p>
                <p class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ row.clientName || 'Sin cliente' }}
                  <span v-if="row.idtraNumber" class="font-black text-[var(--dh-primary)]"> · IDTRA {{ row.idtraNumber }}</span>
                </p>
                  <p v-if="row.pendingReapproval" class="mt-2 break-words rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold text-[var(--dh-text)]">
                    <strong>Motivo de modificación:</strong> {{ row.reapprovalReason || 'No registrado en revisiones anteriores; consultar auditoría.' }}
                  </p>
              </div>

            </div>

            <div class="mt-3 grid grid-cols-2 gap-2">
              <div class="min-w-0 rounded-xl bg-black/[0.035] p-2.5 dark:bg-white/[0.04]">
                <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Operación</p>
                <p class="mt-1 break-words text-sm font-black text-[var(--dh-text)]">{{ operationProvider(row) }}</p>
                <p class="mt-1 break-words text-xs font-bold text-[var(--dh-text-soft)]">{{ containerSummary(row) }}</p>
                <p class="mt-1 break-words text-[11px] font-semibold text-[var(--dh-text-muted)]">Agente: {{ operationAgent(row) }}</p>
              </div>

              <div class="min-w-0 rounded-xl bg-black/[0.035] p-2.5 dark:bg-white/[0.04]">
                <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Cotizado por</p>
                <p class="mt-1 break-words text-sm font-black text-[var(--dh-text)]">{{ creatorDisplayName(row) }}</p>
                <p
                  v-if="creatorUserName(row) && creatorUserName(row).toLowerCase() !== creatorDisplayName(row).toLowerCase()"
                  class="mt-1 break-all text-[11px] font-semibold text-[var(--dh-text-muted)]"
                >
                  @{{ creatorUserName(row) }}
                </p>
              </div>
            </div>

            <div class="mt-2 grid grid-cols-2 gap-2">
              <div class="min-w-0 rounded-xl bg-black/[0.035] p-2.5 dark:bg-white/[0.04]">
                <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Revisado por</p>
                <p class="mt-1 break-words text-sm font-black text-[var(--dh-text)]">{{ reviewerDisplayName(row) }}</p>
              </div>
              <div class="min-w-0 rounded-xl bg-black/[0.035] p-2.5 dark:bg-white/[0.04]">
                <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Última modificación por</p>
                <p class="mt-1 break-words text-sm font-black text-[var(--dh-text)]">{{ lastModifierDisplayName(row) }}</p>
              </div>
            </div>

            <div class="mt-2 grid grid-cols-2 gap-2">
              <div class="min-w-0 rounded-xl border border-[var(--dh-border)] p-2.5">
                <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Costo</p>
                <p class="mt-1 whitespace-nowrap text-sm font-black">{{ formatMoney(row.totalCostUsd, 'USD') }}</p>
              </div>
              <div class="min-w-0 rounded-xl border border-[var(--dh-border)] p-2.5">
                <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Vigencia</p>
                <p class="mt-1 text-sm font-black">{{ formatDate(row.validFrom) }}</p>
                <p class="text-[11px] font-semibold text-[var(--dh-text-muted)]">hasta {{ formatDate(row.validTo) }}</p>
              </div>
            </div>

            <div class="mt-2 rounded-xl border border-[var(--dh-border)] p-2.5">
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Venta / Utilidad</p>
                  <p class="mt-1 break-words text-sm font-black text-[var(--dh-primary)]">
                    {{ formatMoney(row.totalSaleUsd, 'USD') }}
                    <span class="text-[var(--dh-text-soft)]"> / {{ formatMoney(row.totalUtilityUsd, 'USD') }}</span>
                  </p>
                </div>
                <DhBadge
                  class="shrink-0"
                  :label="`${Number(row.marginPercentage || 0).toFixed(2)}%`"
                  :variant="marginTone(Number(row.marginPercentage || 0))"
                />
              </div>
              <p class="mt-2 text-[11px] font-bold text-[var(--dh-text-soft)]">{{ row.freeDays }} días libres</p>
            </div>

            <div class="mt-3 grid grid-flow-col auto-cols-[2.75rem] justify-center gap-2 border-t border-[var(--dh-border)] pt-2.5" @click.stop>
              <button
                type="button"
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                title="Ver en wizard"
                aria-label="Ver en wizard"
                @click="openDetail(row)"
              >
                <Eye class="h-4 w-4" />
              </button>
              <button
                v-if="canUpdateRate(row)"
                type="button"
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--dh-primary)] hover:bg-black/5 dark:hover:bg-white/10"
                title="Actualizar tarifa"
                aria-label="Actualizar tarifa"
                @click="openEdit(row)"
              >
                <Edit3 class="h-4 w-4" />
              </button>
              <button
                v-if="canCreate"
                type="button"
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                title="Duplicar tarifa"
                aria-label="Duplicar tarifa"
                @click="duplicate(row)"
              >
                <Copy class="h-4 w-4" />
              </button>
            </div>
          </article>
        </div>

        <!-- Desktop: stable column widths prevent status/actions from collapsing letter-by-letter. -->
        <div
          class="hidden overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)] lg:block"
        >
          <table class="w-full min-w-[1360px] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col class="w-12" />
              <col class="w-[22%]" />
              <col class="w-[15%]" />
              <col class="w-[12%]" />
              <col class="w-[16%]" />
              <col class="w-[15%]" />
              <col class="w-[10%]" />
              <col class="w-[7%]" />
              <col class="w-[112px]" />
            </colgroup>
            <thead class="bg-black/[0.035] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
              <tr>
                <th class="px-3 py-3"></th>
                <th class="px-3 py-3 whitespace-nowrap">Tarifa</th>
                <th class="px-3 py-3 whitespace-nowrap">Operación</th>
                <th class="px-3 py-3 whitespace-nowrap">Cotizado por</th>
                <th class="px-3 py-3 whitespace-nowrap">Revisado por</th>
                <th class="px-3 py-3 whitespace-nowrap text-right">Resumen comercial</th>
                <th class="px-3 py-3 whitespace-nowrap">Vigencia</th>
                <th class="px-3 py-3 whitespace-nowrap text-center">Estado</th>
                <th class="px-3 py-3 whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="9" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">Cargando...</td>
              </tr>
              <tr v-else-if="loadError">
                <td colspan="9" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">No se pudieron cargar las tarifas. Intente nuevamente desde Actualizar.</td>
              </tr>
              <tr v-else-if="rows.length === 0">
                <td colspan="9" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">No hay tarifas que coincidan con los filtros.</td>
              </tr>
              <tr
                v-for="row in rows"
                v-else
                :key="row.id"
                class="cursor-pointer border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]"
                @click="openDetail(row)"
              >
                <td class="px-3 py-4 align-top" @click.stop>
                  <DhCheckbox
                    :model-value="selectedIds.includes(row.id)"
                    @update:model-value="toggleSelection(row.id)"
                  />
                </td>

                <td class="px-3 py-4 align-top">
                  <div class="min-w-0">
                    <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span class="max-w-full break-all rounded-full dh-bg-primary-soft px-2 py-1 text-[10px] font-black text-[var(--dh-primary)]">
                        {{ row.quoNumber || row.rateCode }}
                      </span>
                      <DhBadge :label="`REV ${row.revisionNumber || 1}`" variant="primary" />
                      <DhBadge
                        :label="isMasterTariff(row) ? 'TARIFARIO · MAESTRO' : row.rateType === 'Tariff' ? 'TARIFA' : 'SPOT'"
                        :variant="row.rateType === 'Spot' ? 'warning' : isMasterTariff(row) ? 'neutral' : 'success'"
                      />
                    </div>
                    <p class="mt-2 break-words font-black leading-5 text-[var(--dh-text)]">
                      {{ [row.polName, row.poeName, row.podName].filter(Boolean).join(' → ') }}
                    </p>
                    <p class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">
                      {{ row.clientName || 'Sin cliente' }}
                      <span v-if="row.idtraNumber" class="font-black text-[var(--dh-primary)]"> · IDTRA {{ row.idtraNumber }}</span>
                    </p>
                  <p v-if="row.pendingReapproval" class="mt-2 break-words rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold text-[var(--dh-text)]">
                    <strong>Motivo de modificación:</strong> {{ row.reapprovalReason || 'No registrado en revisiones anteriores; consultar auditoría.' }}
                  </p>
                  </div>
                </td>

                <td class="px-3 py-4 align-top">
                  <p class="break-words font-black text-[var(--dh-text)]">{{ operationProvider(row) }}</p>
                  <p class="mt-1 break-words text-xs font-bold text-[var(--dh-text-soft)]">{{ containerSummary(row) }}</p>
                  <p class="mt-1 break-words text-[11px] font-semibold text-[var(--dh-text-muted)]">Agente: {{ operationAgent(row) }}</p>
                </td>

                <td class="px-3 py-4 align-top">
                  <p class="break-words font-black text-[var(--dh-text)]">{{ creatorDisplayName(row) }}</p>
                  <p
                    v-if="creatorUserName(row) && creatorUserName(row).toLowerCase() !== creatorDisplayName(row).toLowerCase()"
                    class="mt-1 break-all text-[11px] font-semibold text-[var(--dh-text-muted)]"
                  >
                    @{{ creatorUserName(row) }}
                  </p>
                </td>

                <td class="px-3 py-4 align-top">
                  <p class="break-words font-black text-[var(--dh-text)]">{{ reviewerDisplayName(row) }}</p>
                  <p class="mt-1 break-words text-[11px] font-semibold text-[var(--dh-text-muted)]">
                    Última modificación por: {{ lastModifierDisplayName(row) }}
                  </p>
                </td>

                <td class="px-3 py-4 text-right align-top">
                  <p class="text-[11px] font-semibold text-[var(--dh-text-muted)]">Costo</p>
                  <p class="whitespace-nowrap font-black">{{ formatMoney(row.totalCostUsd, 'USD') }}</p>
                  <p class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">Venta / Utilidad</p>
                  <p class="whitespace-nowrap font-black text-[var(--dh-primary)]">
                    {{ formatMoney(row.totalSaleUsd, 'USD') }}
                    <span class="text-[var(--dh-text-soft)]"> / {{ formatMoney(row.totalUtilityUsd, 'USD') }}</span>
                  </p>
                  <div class="mt-2 flex justify-end">
                    <DhBadge :label="`${Number(row.marginPercentage || 0).toFixed(2)}%`" :variant="marginTone(Number(row.marginPercentage || 0))" />
                  </div>
                </td>

                <td class="px-3 py-4 align-top">
                  <p class="whitespace-nowrap font-black">{{ formatDate(row.validFrom) }}</p>
                  <p class="whitespace-nowrap text-[11px] font-semibold text-[var(--dh-text-muted)]">hasta {{ formatDate(row.validTo) }}</p>
                  <p class="mt-1 whitespace-nowrap text-[11px] font-bold text-[var(--dh-text-soft)]">{{ row.freeDays }} días libres</p>
                </td>

                <td class="px-3 py-4 text-center align-top">
                  <div class="flex justify-center whitespace-nowrap">
                    <DhBadge :label="rowStatusLabel(row)" :variant="rowStatusTone(row)" />
                  </div>
                </td>

                <td class="px-3 py-4 align-top" @click.stop>
                  <div class="flex items-center justify-end gap-1 whitespace-nowrap">
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                      title="Ver en wizard"
                      @click="openDetail(row)"
                    >
                      <Eye class="h-4 w-4" />
                    </button>
                    <button
                      v-if="canUpdateRate(row)"
                      type="button"
                      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--dh-primary)] hover:bg-black/5 dark:hover:bg-white/10"
                      title="Actualizar tarifa"
                      @click="openEdit(row)"
                    >
                      <Edit3 class="h-4 w-4" />
                    </button>
                    <button
                      v-if="canCreate"
                      type="button"
                      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                      title="Duplicar tarifa"
                      @click="duplicate(row)"
                    >
                      <Copy class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-5">
        <DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </section>
  </section>
</template>
