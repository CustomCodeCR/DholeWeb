<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  PowerOff,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapPagedResponse } from '@/core/api/apiResponse'
import { PricingService } from '@/core/services/pricingService'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useDhConfirm } from '@/core/composables/useDhConfirm'
import PricingImportReviewDrawer from '@/modules/pricing/components/PricingImportReviewDrawer.vue'
import PricingMultiSelect from '@/modules/pricing/components/PricingMultiSelect.vue'
import PricingReasonModal from '@/modules/pricing/components/PricingReasonModal.vue'
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

type QueueStatus =
  | 'Pending'
  | 'PreAuthorized'
  | 'Approved'
  | 'Rejected'
  | 'Created'
  | 'Expired'
  | 'Inactive'
type QueueSource = 'Email' | 'Pdf' | 'Excel' | 'Csv' | 'Image' | 'Manual' | 'AgentExtraction'

interface ReviewQueueItem {
  id: string
  importBatchId: string
  sourceType: string
  shipmentMode: string
  carrier: string
  agent: string
  pol: string
  poe: string
  pod: string
  containerType: string
  currency: string
  freight: number
  transitDays?: number | null
  validFrom: string
  validTo: string
  status: string
  spaceComment?: string | null
  rawDataJson?: string | null
  createdAt: string
}

const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const { t } = useI18n()
const { confirm } = useDhConfirm()
const authStore = useAuthStore()
const catalogs = usePricingCatalogs()
const route = useRoute()

const rows = ref<ReviewQueueItem[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const processing = ref(false)
const pageNumber = ref(1)
const pageSize = ref('25')
const totalCount = ref(0)
const totalPages = ref(1)

const filters = reactive({
  search: '',
  sourceType: [] as QueueSource[],
  status: ['Pending', 'PreAuthorized', 'Approved'] as QueueStatus[],
  carrierId: [] as string[],
  agentId: [] as string[],
  containerTypeId: [] as string[],
  importBatchId: typeof route.query.importBatchId === 'string' ? route.query.importBatchId : '',
  polId: [] as string[],
  poeId: [] as string[],
  createdFrom: '',
  createdTo: '',
})

const statusOptions = [
  { label: 'Pendientes manuales', value: 'Pending' },
  { label: 'Preautorizadas', value: 'PreAuthorized' },
  { label: 'Preaprobadas', value: 'Approved' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Inactivas', value: 'Inactive' },
  { label: 'Rechazadas', value: 'Rejected' },
  { label: 'Utilizadas', value: 'Created' },
]
const sourceOptions = [
  { label: 'Correo', value: 'Email' },
  { label: 'PDF', value: 'Pdf' },
  { label: 'Excel', value: 'Excel' },
  { label: 'CSV', value: 'Csv' },
  { label: 'Imagen', value: 'Image' },
  { label: 'Manual', value: 'Manual' },
  { label: 'Extracción agente', value: 'AgentExtraction' },
]
const pageSizeOptions = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
]
const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }
const inactivatableStatuses = ['Pending', 'PreAuthorized', 'Approved', 'Expired']

const carrierFilterOptions = computed(() => catalogs.carrierOptions.value)
const polFilterOptions = computed(() => catalogs.polOptions.value)
const poeFilterOptions = computed(() => catalogs.poeOptions.value)
const agentFilterOptions = computed(() => catalogs.agentOptions.value)
const containerFilterOptions = computed(() => catalogs.containerOptions.value)

const isPricingAdmin = computed(() =>
  authStore.hasRole('Administrador') || authStore.hasRole('Admin') || authStore.hasRole('Administrator'),
)
const canPreApprove = computed(() =>
  isPricingAdmin.value || authStore.hasScope(PRICING_SCOPES.importFclRates.approve),
)
const canRejectImported = computed(() =>
  isPricingAdmin.value || authStore.hasScope(PRICING_SCOPES.importFclRates.reject),
)
const canInactivateImported = computed(() =>
  isPricingAdmin.value || authStore.hasScope(PRICING_SCOPES.importFclRates.review),
)

const selectedPendingIds = computed(() =>
  rows.value
    .filter(
      (row) =>
        ['Pending', 'PreAuthorized'].includes(row.status) && selectedIds.value.includes(row.id),
    )
    .map((row) => row.id),
)
const selectedInactivatableIds = computed(() =>
  rows.value
    .filter(
      (row) =>
        inactivatableStatuses.includes(row.status) && selectedIds.value.includes(row.id),
    )
    .map((row) => row.id),
)
const selectedBatchIds = computed(() =>
  Array.from(new Set([...selectedPendingIds.value, ...selectedInactivatableIds.value])),
)
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.includes(row.id)),
)
const visiblePages = computed(() => {
  const total = totalPages.value
  const visibleCount = Math.min(5, total)
  const maxStart = Math.max(1, total - visibleCount + 1)
  const start = Math.min(Math.max(1, pageNumber.value - 2), maxStart)
  return Array.from({ length: visibleCount }, (_, index) => start + index)
})
const firstVisibleItem = computed(() =>
  totalCount.value === 0 ? 0 : (pageNumber.value - 1) * Number(pageSize.value) + 1,
)
const lastVisibleItem = computed(() =>
  Math.min(pageNumber.value * Number(pageSize.value), totalCount.value),
)

function statusLabel(value: string) {
  return ({
    Pending: 'Pendiente manual',
    PreAuthorized: 'Preautorizada',
    Approved: 'Preaprobada',
    Expired: 'Vencida',
    Inactive: 'Inactiva',
    Rejected: 'Rechazada',
    Created: 'Utilizada',
  } as Record<string, string>)[value] ?? value
}

function statusVariant(value: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'Approved' || value === 'Created') return 'success'
  if (value === 'PreAuthorized') return 'warning'
  if (value === 'Pending') return 'warning'
  if (value === 'Rejected' || value === 'Expired') return 'danger'
  return 'neutral'
}

function sourceLabel(value: string) {
  return ({
    Email: 'Correo',
    Pdf: 'PDF',
    Excel: 'Excel',
    Csv: 'CSV',
    Image: 'Imagen',
    Manual: 'Manual',
    AgentExtraction: 'Extracción agente',
  } as Record<string, string>)[value] ?? value
}

function shipmentModeLabel(value: string) {
  return ({
    fcl: 'FCL',
    lcl: 'LCL marítimo · Coloader',
    lclcoloader: 'LCL marítimo · Coloader',
    air: 'LCL aéreo · Coloader',
    airlclcoloader: 'LCL aéreo · Coloader',
    ltl: 'LTL · Terrestre consolidado',
    unknown: 'Por clasificar',
  } as Record<string, string>)[String(value ?? '').trim().toLowerCase()] ?? 'Por clasificar'
}

function shipmentModeVariant(value: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'air' || normalized === 'airlclcoloader') return 'success'
  if (normalized === 'ltl') return 'success'
  if (normalized === 'lcl' || normalized === 'lclcoloader') return 'warning'
  return 'neutral'
}

function extractionSourceDetails(rawDataJson?: string | null) {
  if (!rawDataJson) return null

  try {
    const parsed = JSON.parse(rawDataJson) as {
      _dholeSource?: {
        providerName?: string
        provider?: string
        extractedAtUtc?: string
        executionId?: string
      }
    }
    const source = parsed._dholeSource
    if (!source) return null

    const provider = source.providerName || source.provider || 'Agente'
    const extractedAt = source.extractedAtUtc
      ? new Intl.DateTimeFormat('es-CR', {
          dateStyle: 'short',
          timeStyle: 'medium',
          timeZone: 'America/Costa_Rica',
        }).format(new Date(source.extractedAtUtc))
      : null

    return [`Extracción automática ${provider}`, extractedAt ? `realizada ${extractedAt}` : null]
      .filter(Boolean)
      .join(' · ')
  } catch {
    return null
  }
}

function sourceDetails(row: ReviewQueueItem) {
  return row.sourceType === 'AgentExtraction'
    ? extractionSourceDetails(row.rawDataJson)
    : null
}

function buildReviewQueueQueryString() {
  const params = new URLSearchParams()
  const appendMany = (key: string, values: readonly string[]) => {
    values.forEach((value) => {
      if (value) params.append(key, value)
    })
  }

  if (filters.search.trim()) params.set('search', filters.search.trim())
  appendMany('sourceType', filters.sourceType)
  appendMany('status', filters.status)
  appendMany('carrierId', filters.carrierId)
  appendMany('agentId', filters.agentId)
  appendMany('containerTypeId', filters.containerTypeId)
  appendMany('polId', filters.polId)
  appendMany('poeId', filters.poeId)
  if (filters.importBatchId) params.set('importBatchId', filters.importBatchId)
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom)
  if (filters.createdTo) params.set('createdTo', filters.createdTo)
  params.set('pageNumber', String(pageNumber.value))
  params.set('pageSize', String(Number(pageSize.value)))

  const query = params.toString()
  return query ? `?${query}` : ''
}

async function load() {
  try {
    loading.value = true
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/import-rates/review-queue' + buildReviewQueueQueryString(),
      headers: { Accept: 'application/json' },
    })

    const paged = unwrapPagedResponse<ReviewQueueItem>(response)
    rows.value = paged.items
    totalCount.value = paged.totalCount ?? paged.items.length
    totalPages.value = Math.max(
      1,
      paged.totalPages ?? Math.ceil(totalCount.value / Number(pageSize.value)),
    )
    pageNumber.value = paged.pageNumber ?? pageNumber.value
    selectedIds.value = selectedIds.value.filter((id) => rows.value.some((row) => row.id === id))
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la cola de revisión.')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  pageNumber.value = 1
  void load()
}

function clearFilters() {
  filters.search = ''
  filters.sourceType = []
  filters.status = ['Pending', 'PreAuthorized', 'Approved']
  filters.carrierId = []
  filters.agentId = []
  filters.containerTypeId = []
  filters.importBatchId = ''
  filters.polId = []
  filters.poeId = []
  filters.createdFrom = ''
  filters.createdTo = ''
  applyFilters()
}

function changePageSize(value: string | number) {
  pageSize.value = String(value)
  pageNumber.value = 1
  void load()
}

function goToPage(target: number) {
  const next = Math.min(Math.max(target, 1), totalPages.value)
  if (next === pageNumber.value || loading.value) return
  pageNumber.value = next
  void load()
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : rows.value.map((row) => row.id)
}

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((current) => current !== id)
    : [...selectedIds.value, id]
}

async function approve(ids: string[]) {
  if (!canPreApprove.value) {
    toastStore.warning('Permiso requerido', 'Necesita permiso para preaprobar tarifas importadas.')
    return
  }
  const pending = ids.filter((id) => rows.value.some((row) => row.id === id && ['Pending', 'PreAuthorized'].includes(row.status)))
  if (!pending.length || processing.value) return
  try {
    processing.value = true
    await PricingService.approveImportRates(pending)
    toastStore.success(`${pending.length} tarifa${pending.length === 1 ? '' : 's'} preaprobada${pending.length === 1 ? '' : 's'}`)
    selectedIds.value = []
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron preaprobar las tarifas.')
  } finally {
    processing.value = false
  }
}

function reject(ids: string[]) {
  if (!canRejectImported.value) {
    toastStore.warning('Permiso requerido', 'Necesita permiso para rechazar tarifas importadas.')
    return
  }
  const pending = ids.filter((id) => rows.value.some((row) => row.id === id && ['Pending', 'PreAuthorized'].includes(row.status)))
  if (!pending.length) return
  modalStore.open({
    title: 'Rechazar tarifas preautorizadas',
    component: PricingReasonModal,
    props: {
      target: 'import',
      ids: pending,
      onSaved: async () => {
        selectedIds.value = []
        await load()
      },
    },
  })
}

async function inactivate(ids: string[]) {
  if (!canInactivateImported.value) {
    toastStore.warning('Permiso requerido', 'Necesita permiso para revisar tarifas importadas.')
    return
  }

  const eligible = ids.filter((id) =>
    rows.value.some((row) => row.id === id && inactivatableStatuses.includes(row.status)),
  )
  if (!eligible.length || processing.value) return

  const confirmed = await confirm({
    title: t('pricing.confirmations.inactivateSelectedTitle'),
    message: t('pricing.confirmations.inactivateSelectedMessage', { count: eligible.length }),
    confirmLabel: t('pricing.confirmations.inactivateConfirm'),
    danger: true,
  })
  if (!confirmed) return

  try {
    processing.value = true
    await callEndpoint<void, { ids: string[] }>(
      {
        method: 'POST',
        path: '/api/pricing/import-rates/inactivate',
        headers: jsonHeaders,
      },
      { body: { ids: eligible } },
    )
    toastStore.success(
      `${eligible.length} tarifa${eligible.length === 1 ? '' : 's'} inactivada${eligible.length === 1 ? '' : 's'}`,
    )
    selectedIds.value = []
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron inactivar las tarifas.')
  } finally {
    processing.value = false
  }
}

function openManualUpload() {
  drawerStore.open({
    title: 'Subir tarifario manualmente',
    component: PricingUploadDrawer,
    size: 'lg',
    props: {
      onSaved: async () => {
        pageNumber.value = 1
        filters.status = ['Pending', 'PreAuthorized', 'Approved']
        await load()
      },
    },
  })
}

async function openReview(row: ReviewQueueItem) {
  try {
    const detail = await PricingService.getImportRate(row.id)
    drawerStore.open({
      title: 'Revisar tarifa recibida',
      component: PricingImportReviewDrawer,
      size: 'full',
      props: {
        importRate: detail,
        canApprove: canPreApprove.value && ['Pending', 'PreAuthorized'].includes(row.status),
        onSaved: load,
        onApproved: load,
      },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo abrir la tarifa.')
  }
}

onMounted(() => {
  void catalogs.loadAll()
  void load()
})
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Revisión de tarifas recibidas"
      description="Revise tarifas recibidas por correo, archivo o extracción automática de agentes antes de utilizarlas en Pricing."
    >
      <template #actions>
        <DhButton @click="openManualUpload">
          <UploadCloud class="h-4 w-4" />
          Subir Excel / PDF
        </DhButton>
        <DhButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw class="h-4 w-4" />
          Actualizar
        </DhButton>
      </template>
    </DhPageHeader>

    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DhInput v-model="filters.search" label="Buscar" placeholder="Naviera, ruta, equipo..." @keyup.enter="applyFilters" />
        <PricingMultiSelect
          v-model="filters.sourceType"
          label="Origen"
          placeholder="Todos los orígenes"
          search-placeholder="Buscar origen..."
          :options="sourceOptions"
        />
        <PricingMultiSelect
          v-model="filters.status"
          label="Estado"
          placeholder="Todos los estados"
          search-placeholder="Buscar estado..."
          :options="statusOptions"
        />
        <PricingMultiSelect
          v-model="filters.carrierId"
          label="Naviera"
          placeholder="Todas las navieras"
          search-placeholder="Buscar naviera..."
          :options="carrierFilterOptions"
        />
        <PricingMultiSelect
          v-model="filters.agentId"
          label="Agente"
          placeholder="Todos los agentes"
          search-placeholder="Buscar agente..."
          :options="agentFilterOptions"
        />
        <PricingMultiSelect
          v-model="filters.containerTypeId"
          label="Contenedor"
          placeholder="Todos los contenedores"
          search-placeholder="Buscar contenedor..."
          :options="containerFilterOptions"
        />
        <PricingMultiSelect
          v-model="filters.polId"
          label="POL"
          placeholder="Todos los POL"
          search-placeholder="Buscar POL..."
          :options="polFilterOptions"
        />
        <PricingMultiSelect
          v-model="filters.poeId"
          label="POE"
          placeholder="Todos los POE"
          search-placeholder="Buscar POE..."
          :options="poeFilterOptions"
        />
        <DhInput v-model="filters.createdFrom" type="date" label="Cargada desde" />
        <DhInput v-model="filters.createdTo" type="date" label="Cargada hasta" />
      </div>
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <DhButton variant="ghost" @click="clearFilters">Limpiar</DhButton>
        <DhButton @click="applyFilters">Aplicar filtros</DhButton>
      </div>
    </section>

    <section
      v-if="selectedBatchIds.length && (canPreApprove || canRejectImported || canInactivateImported)"
      class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.25)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-3"
    >
      <div>
        <p class="font-black text-[var(--dh-text)]">{{ selectedBatchIds.length }} tarifas seleccionadas</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Preaprobación, rechazo e inactivación por batch.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton v-if="canRejectImported && selectedPendingIds.length" variant="danger" :disabled="processing" @click="reject(selectedPendingIds)">
          <X class="h-4 w-4" /> Rechazar
        </DhButton>
        <DhButton v-if="canInactivateImported && selectedInactivatableIds.length" variant="secondary" :disabled="processing" @click="inactivate(selectedInactivatableIds)">
          <PowerOff class="h-4 w-4" /> {{ t('pricing.imports.inactivate') }}
        </DhButton>
        <DhButton v-if="canPreApprove && selectedPendingIds.length" :disabled="processing" @click="approve(selectedPendingIds)">
          <Check class="h-4 w-4" /> {{ t('pricing.imports.preapprove') }}
        </DhButton>
      </div>
    </section>

    <section class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div data-pricing-imports-mobile class="grid gap-3 p-3 lg:hidden">
        <div v-if="loading" class="rounded-2xl border border-[var(--dh-border)] p-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          {{ t('common.loading') }}
        </div>
        <div v-else-if="!rows.length" class="rounded-2xl border border-[var(--dh-border)] p-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          {{ t('pricing.imports.noMatch') }}
        </div>
        <article
          v-for="row in rows"
          v-else
          :key="`mobile:${row.id}`"
          class="min-w-0 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]"
        >
          <div class="flex min-w-0 items-start gap-3">
            <input type="checkbox" class="mt-1 shrink-0" :checked="selectedIds.includes(row.id)" :aria-label="t('pricing.imports.selectRow', { name: row.carrier || row.id })" @change="toggle(row.id)" />
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <DhBadge variant="neutral">{{ sourceLabel(row.sourceType) }}</DhBadge>
                <DhBadge :variant="shipmentModeVariant(row.shipmentMode)">{{ shipmentModeLabel(row.shipmentMode) }}</DhBadge>
                <DhBadge class="ml-auto" :variant="statusVariant(row.status)">{{ statusLabel(row.status) }}</DhBadge>
              </div>
              <p class="mt-3 break-words text-sm font-black text-[var(--dh-text)]">{{ row.pol }} → {{ row.poe }} → {{ row.pod }}</p>
              <p class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.carrier || '—' }} · {{ row.agent || 'Por asignar' }}</p>
              <p v-if="sourceDetails(row)" class="mt-1 break-words text-[11px] font-semibold leading-4 text-[var(--dh-text-muted)]">{{ sourceDetails(row) }}</p>
            </div>
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
              <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('pricing.imports.columns.loaded') }}</dt>
              <dd class="mt-1 font-bold">{{ formatDate(row.createdAt) }}</dd>
            </div>
            <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
              <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('pricing.imports.columns.equipment') }}</dt>
              <dd class="mt-1 break-words font-bold">{{ row.containerType || '—' }}</dd>
            </div>
            <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
              <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('pricing.imports.columns.freight') }}</dt>
              <dd class="mt-1 font-black">{{ formatMoney(row.freight, row.currency || 'USD') }}</dd>
            </div>
            <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
              <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('pricing.imports.columns.transit') }}</dt>
              <dd class="mt-1 font-black">{{ row.transitDays == null ? '—' : `${Math.ceil(row.transitDays)} días` }}</dd>
            </div>
          </dl>

          <div class="mt-3 rounded-xl border border-[var(--dh-border)] p-3 text-xs">
            <p class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('pricing.imports.columns.validity') }}</p>
            <p class="mt-1 font-semibold">{{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }}</p>
          </div>

          <div class="mt-4 flex flex-wrap gap-2 border-t border-[var(--dh-border)] pt-3">
            <DhButton class="flex-1" size="sm" variant="secondary" @click="openReview(row)">
              <MessageSquareText class="h-4 w-4" /> {{ t('pricing.imports.review') }}
            </DhButton>
            <DhButton v-if="canInactivateImported && inactivatableStatuses.includes(row.status)" class="flex-1" size="sm" variant="secondary" :disabled="processing" @click="inactivate([row.id])">
              <PowerOff class="h-4 w-4" /> {{ t('pricing.imports.inactivate') }}
            </DhButton>
            <DhButton v-if="canPreApprove && ['Pending', 'PreAuthorized'].includes(row.status)" class="flex-1" size="sm" :disabled="processing" @click="approve([row.id])">
              <Check class="h-4 w-4" /> {{ t('pricing.imports.preapprove') }}
            </DhButton>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto lg:block">
        <table class="min-w-[1480px] w-full text-sm">
          <thead class="border-b border-[var(--dh-border)] bg-black/[0.025] dark:bg-white/[0.025]">
            <tr class="text-left text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">
              <th class="px-4 py-3">
                <input type="checkbox" :checked="allSelected" :aria-label="t('pricing.imports.selectAllPage')" @change="toggleAll" />
              </th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.loaded') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.source') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.mode') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.carrierAgent') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.route') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.equipment') }}</th>
              <th class="px-4 py-3 text-right">{{ t('pricing.imports.columns.freight') }}</th>
              <th class="px-4 py-3 text-center">{{ t('pricing.imports.columns.transit') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.validity') }}</th>
              <th class="px-4 py-3">{{ t('pricing.imports.columns.status') }}</th>
              <th class="px-4 py-3 text-right">{{ t('pricing.imports.columns.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="12" class="px-4 py-12 text-center font-semibold text-[var(--dh-text-muted)]">{{ t('common.loading') }}</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="12" class="px-4 py-12 text-center font-semibold text-[var(--dh-text-muted)]">{{ t('pricing.imports.noMatch') }}</td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="border-b border-[var(--dh-border)] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            >
              <td :data-label="t('pricing.imports.columns.selection')" class="px-4 py-3">
                <input type="checkbox" :checked="selectedIds.includes(row.id)" :aria-label="t('pricing.imports.selectRow', { name: row.carrier || row.id })" @change="toggle(row.id)" />
              </td>
              <td :data-label="t('pricing.imports.columns.loaded')" class="whitespace-nowrap px-4 py-3 font-semibold">{{ formatDate(row.createdAt) }}</td>
              <td :data-label="t('pricing.imports.columns.source')" class="min-w-[220px] px-4 py-3">
                <DhBadge variant="neutral">{{ sourceLabel(row.sourceType) }}</DhBadge>
                <p
                  v-if="sourceDetails(row)"
                  class="mt-1 max-w-[320px] text-[11px] font-semibold leading-4 text-[var(--dh-text-muted)]"
                >
                  {{ sourceDetails(row) }}
                </p>
              </td>
              <td :data-label="t('pricing.imports.columns.mode')" class="min-w-[180px] px-4 py-3">
                <DhBadge :variant="shipmentModeVariant(row.shipmentMode)">
                  {{ shipmentModeLabel(row.shipmentMode) }}
                </DhBadge>
              </td>
              <td :data-label="t('pricing.imports.columns.carrierAgent')" class="px-4 py-3">
                <p class="font-black text-[var(--dh-text)]">{{ row.carrier || '—' }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ row.agent || 'Por asignar' }}</p>
              </td>
              <td :data-label="t('pricing.imports.columns.route')" class="min-w-[220px] px-4 py-3">
                <p class="font-semibold">{{ row.pol }} → {{ row.poe }} → {{ row.pod }}</p>
              </td>
              <td :data-label="t('pricing.imports.columns.equipment')" class="px-4 py-3 font-semibold">{{ row.containerType }}</td>
              <td :data-label="t('pricing.imports.columns.freight')" class="px-4 py-3 text-right font-black">{{ formatMoney(row.freight, row.currency || 'USD') }}</td>
              <td :data-label="t('pricing.imports.columns.transit')" class="whitespace-nowrap px-4 py-3 text-center font-black">
                {{ row.transitDays == null ? '—' : `${Math.ceil(row.transitDays)} días` }}
              </td>
              <td :data-label="t('pricing.imports.columns.validity')" class="whitespace-nowrap px-4 py-3 text-xs font-semibold">{{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }}</td>
              <td :data-label="t('pricing.imports.columns.status')" class="px-4 py-3"><DhBadge :variant="statusVariant(row.status)">{{ statusLabel(row.status) }}</DhBadge></td>
              <td :data-label="t('pricing.imports.columns.action')" class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <DhButton size="sm" variant="secondary" @click="openReview(row)">
                    <MessageSquareText class="h-4 w-4" /> {{ t('pricing.imports.review') }}
                  </DhButton>
                  <DhButton
                    v-if="canInactivateImported && inactivatableStatuses.includes(row.status)"
                    size="sm"
                    variant="secondary"
                    :disabled="processing"
                    @click="inactivate([row.id])"
                  >
                    <PowerOff class="h-4 w-4" /> {{ t('pricing.imports.inactivate') }}
                  </DhButton>
                  <DhButton v-if="canPreApprove && ['Pending', 'PreAuthorized'].includes(row.status)" size="sm" :disabled="processing" @click="approve([row.id])">
                    <Check class="h-4 w-4" /> {{ t('pricing.imports.preapprove') }}
                  </DhButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="!loading && totalCount > 0"
        class="flex flex-col gap-3 border-t border-[var(--dh-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('pricing.imports.showingRange', { from: firstVisibleItem, to: lastVisibleItem, total: totalCount }) }}
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <div class="w-24">
            <DhSelect
              :model-value="pageSize"
              :label="t('common.rowsPerPage')"
              placeholder=""
              :options="pageSizeOptions"
              @update:model-value="changePageSize"
            />
          </div>

          <DhButton
            size="sm"
            variant="secondary"
            :disabled="pageNumber <= 1"
            :aria-label="t('common.previousPage')"
            @click="goToPage(pageNumber - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </DhButton>

          <DhButton
            v-for="page in visiblePages"
            :key="page"
            size="sm"
            :variant="page === pageNumber ? 'primary' : 'ghost'"
            :disabled="page === pageNumber"
            @click="goToPage(page)"
          >
            {{ page }}
          </DhButton>

          <DhButton
            size="sm"
            variant="secondary"
            :disabled="pageNumber >= totalPages"
            :aria-label="t('common.nextPage')"
            @click="goToPage(pageNumber + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </DhButton>
        </div>
      </div>
    </section>

    <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
      En “Revisar”, el comentario de espacios sí participa en la recomendación; las notas internas quedan solo como auditoría.
    </p>
  </div>
</template>