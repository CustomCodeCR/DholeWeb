<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Copy, Edit3, Eye, ReceiptText, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhCrudToolbar, DhPagination } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
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
  rateDisplayName,
  routeLabel,
  statusTone,
} from '@/modules/pricing/utils/pricingFormat'

type CommercialRateStatus = 'PendingApproval' | 'Open' | 'Sent' | 'Expired' | 'AcceptedByClient' | 'RejectedByClient'

const commercialStatuses = new Set<CommercialRateStatus>([
  'PendingApproval',
  'Open',
  'Sent',
  'Expired',
  'AcceptedByClient',
  'RejectedByClient',
])

function normalizeCommercialStatus(value: unknown): CommercialRateStatus {
  const status = typeof value === 'string' ? value : ''
  if (commercialStatuses.has(status as CommercialRateStatus)) return status as CommercialRateStatus
  if (status === 'RejectedByClient' || status === 'Closed') return 'RejectedByClient'
  if (status === 'Sent') return 'Sent'
  if (status === 'Expired') return 'Expired'
  if (status === 'AcceptedByClient') return 'AcceptedByClient'
  return 'Open'
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
  if (rate.shipmentMode === 'Ftl') return `${rate.containerQuantity} × FTL`
  const allocations = rate.containers?.filter((item) => item.quantity > 0) ?? []
  if (allocations.length === 0) return `${rate.containerQuantity} × ${rate.containerTypeName}`
  return allocations.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
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
const selectedIds = ref<string[]>([])
const loading = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = reactive({
  search: '',
  status: normalizeCommercialStatus(route.query.status),
  agentId: '',
  carrierId: '',
  polId: '',
  poeId: '',
  podId: '',
  containerTypeId: '',
  currencyId: '',
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

const statusOptions: Array<{ label: string; value: CommercialRateStatus }> = [
  { label: 'Pendientes de aprobación', value: 'PendingApproval' },
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]

const quickStatusOptions = statusOptions

const activeFiltersCount = computed(
  () =>
    Object.entries(filters).filter(([key, value]) => !['search', 'status'].includes(key) && String(value || '').trim())
      .length + (filters.search.trim() ? 1 : 0),
)

function applyQuickStatus(status: CommercialRateStatus) {
  filters.status = status
  applyFilters()
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
        RejectedByClient: 'No aceptada',
        Closed: 'No aceptada',
        Expired: 'Vencida',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function load() {
  try {
    loading.value = true

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
        if (filters.status && normalizeCommercialStatus(rate.status) !== filters.status) return false
        if (filters.agentId && rate.agentId !== filters.agentId) return false
        if (filters.carrierId && rate.carrierId !== filters.carrierId) return false
        if (filters.polId && rate.polId !== filters.polId) return false
        if (filters.poeId && rate.poeId !== filters.poeId) return false
        if (filters.podId && rate.podId !== filters.podId) return false
        if (filters.containerTypeId && rate.containerTypeId !== filters.containerTypeId) return false
        if (filters.currencyId && rate.currencyId !== filters.currencyId) return false
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

      const start = (page.value - 1) * pageSize.value
      const pageRows = sellerRows.slice(start, start + pageSize.value)
      rows.value = pageRows
      total.value = sellerRows.length
      selectedIds.value = selectedIds.value.filter((id) => pageRows.some((row) => row.id === id))
      return
    }

    const result = await PricingService.browseRates({
      pageNumber: page.value,
      pageSize: filters.status === 'Open' ? Math.max(pageSize.value, 100) : pageSize.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
      agentId: filters.agentId || undefined,
      carrierId: filters.carrierId || undefined,
      polId: filters.polId || undefined,
      poeId: filters.poeId || undefined,
      podId: filters.podId || undefined,
      containerTypeId: filters.containerTypeId || undefined,
      currencyId: filters.currencyId || undefined,
      idtraNumber: filters.idtraNumber || undefined,
      quoNumber: filters.quoNumber || undefined,
      quoteDate: filters.quoteDate || undefined,
      validFrom: filters.validFrom || undefined,
      validTo: filters.validTo || undefined,
      excludeTariffMasters: true,
    })

    const safeItems = Array.isArray(result?.items)
      ? result.items.filter((row): row is RateDto => Boolean(row && row.id))
      : []

    const visibleItems = filters.status === 'Open'
      ? safeItems.filter((item) => item.status === 'Open')
      : safeItems

    rows.value = visibleItems
    total.value = filters.status === 'Open'
      ? visibleItems.length
      : result?.totalCount ?? visibleItems.length
    selectedIds.value = selectedIds.value.filter((id) => visibleItems.some((row) => row.id === id))
  } catch (error) {
    rows.value = []
    total.value = 0
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
  Object.assign(filters, {
    search: '',
    status: 'Open',
    agentId: '',
    carrierId: '',
    polId: '',
    poeId: '',
    podId: '',
    containerTypeId: '',
    currencyId: '',
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
  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'view' } })
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
      title="Tarifas oficiales"
      subtitle="Seguimiento por Pendientes de aprobación, Abiertas, Enviadas, Vencidas, Aceptadas y No aceptadas."
      :icon="ReceiptText"
    />

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Tarifas oficiales"
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

      <div class="mt-4 flex flex-wrap items-center gap-2">
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
            filters.status === option.value
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
          <DhSelect
            v-model="filters.status"
            label="Estado"
            :options="statusOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.agentId"
            label="Agente"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.agentOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.carrierId"
            label="Naviera"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.carrierOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.polId"
            label="POL"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.polOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.poeId"
            label="POE"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.poeOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.podId"
            label="POD"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.podOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.containerTypeId"
            label="Contenedor"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.containerOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.currencyId"
            label="Moneda"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.currencyOptions.value]"
            placeholder=""
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
        <div
          class="overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]"
        >
          <table class="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead class="bg-black/[0.035] text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
              <tr>
                <th class="w-12 px-4 py-3"></th>
                <th class="px-4 py-3">Tarifa</th>
                <th class="px-4 py-3">Operación</th>
                <th class="px-4 py-3 text-right">Resumen comercial</th>
                <th class="px-4 py-3">Vigencia</th>
                <th class="px-4 py-3 text-center">Estado</th>
                <th class="w-[190px] px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">
                  Cargando...
                </td>
              </tr>
              <tr v-else-if="rows.length === 0">
                <td colspan="7" class="px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]">
                  No hay tarifas que coincidan con los filtros.
                </td>
              </tr>
              <template v-else>
              <tr
                v-for="row in rows"
                :key="row.id"
                class="cursor-pointer border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]"
                @click="openDetail(row)"
              >
                <td class="px-4 py-4" @click.stop>
                  <DhCheckbox
                    :model-value="selectedIds.includes(row.id)"
                    @update:model-value="toggleSelection(row.id)"
                  />
                </td>
                <td class="px-4 py-4">
                  <div class="min-w-[300px]">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-full dh-bg-primary-soft px-2.5 py-1 text-[11px] font-black text-[var(--dh-primary)]">
                        {{ row.quoNumber || row.rateCode }}
                      </span>
                      <DhBadge :label="`REV ${row.revisionNumber || 1}`" variant="primary" />
                      <DhBadge
                        :label="isMasterTariff(row) ? 'TARIFARIO · MAESTRO' : row.rateType === 'Tariff' ? 'TARIFA' : 'SPOT'"
                        :variant="row.rateType === 'Spot' ? 'warning' : isMasterTariff(row) ? 'neutral' : 'success'"
                      />
                    </div>
                    <p class="mt-2 font-black text-[var(--dh-text)]">
                      {{ [row.polName, row.poeName, row.podName].filter(Boolean).join(' → ') }}
                    </p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                      {{ row.clientName || 'Sin cliente' }}
                      <span v-if="row.idtraNumber" class="font-black text-[var(--dh-primary)]"> · IDTRA {{ row.idtraNumber }}</span>
                    </p>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <div class="min-w-[190px]">
                    <p class="font-black text-[var(--dh-text)]">{{ row.carrierName || 'Sin naviera' }}</p>
                    <p class="mt-1 text-sm font-bold text-[var(--dh-text-soft)]">{{ containerSummary(row) }}</p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Agente: {{ row.agentName || '—' }}</p>
                  </div>
                </td>
                <td class="px-4 py-4 text-right">
                  <div class="min-w-[240px]">
                    <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Costo</p>
                    <p class="font-black">{{ formatMoney(row.totalCostUsd, 'USD') }}</p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Venta / Utilidad</p>
                    <p class="font-black text-[var(--dh-primary)]">
                      {{ formatMoney(row.totalSaleUsd, 'USD') }}
                      <span class="text-[var(--dh-text-soft)]"> / {{ formatMoney(row.totalUtilityUsd, 'USD') }}</span>
                    </p>
                    <div class="mt-2 flex justify-end">
                      <DhBadge :label="`${Number(row.marginPercentage || 0).toFixed(2)}%`" :variant="marginTone(Number(row.marginPercentage || 0))" />
                    </div>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <div class="min-w-[150px]">
                    <p class="font-black">{{ formatDate(row.validFrom) }}</p>
                    <p class="text-xs font-semibold text-[var(--dh-text-muted)]">hasta {{ formatDate(row.validTo) }}</p>
                    <p class="mt-1 text-xs font-bold text-[var(--dh-text-soft)]">{{ row.freeDays }} días libres</p>
                  </div>
                </td>
                <td class="px-4 py-4 text-center">
                  <DhBadge :label="statusLabel(row.status)" :variant="statusTone(row.status)" />
                </td>
                <td class="px-4 py-4" @click.stop>
                  <div class="flex justify-end gap-1">
                    <button type="button" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Ver en wizard" @click="openDetail(row)">
                      <Eye class="h-4 w-4" />
                    </button>
                    <button
                      v-if="canUpdateRate(row)"
                      type="button"
                      class="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-black text-[var(--dh-primary)] hover:bg-black/5 dark:hover:bg-white/10"
                      title="Actualizar tarifa"
                      @click="openEdit(row)"
                    >
                      <Edit3 class="h-3.5 w-3.5" />
                      <span>Actualizar</span>
                    </button>
                    <button
                      v-if="canCreate"
                      type="button"
                      class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                      title="Duplicar tarifa"
                      @click="duplicate(row)"
                    >
                      <Copy class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
              </template>
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
