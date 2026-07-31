<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Eye, FileSpreadsheet, Import, Mail, Ship, Trash2, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import {
  DhCrudToolbar,
  DhDataTable,
  DhPagination,
  type DhTableColumn,
} from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type { ImportRateDto, ImportSourceType, ImportStatus } from '@/core/interfaces/pricing'
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue'
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue'
import PricingImportPreviewDrawer from '@/modules/pricing/components/PricingImportPreviewDrawer.vue'
import PricingWorkflowGuide from '@/modules/pricing/components/PricingWorkflowGuide.vue'
import PricingReasonModal from '@/modules/pricing/components/PricingReasonModal.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<ImportRateDto[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const batchFilter = ref(
  typeof route.query.importBatchId === 'string' ? route.query.importBatchId : '',
)
const refreshing = ref(false)
const bulkApproving = ref(false)
const processingId = ref<string | null>(null)
let refreshTimer: number | undefined
const filters = reactive({
  search: '',
  status: (typeof route.query.status === 'string' ? route.query.status : '') as ImportStatus | '',
  sourceType: '' as ImportSourceType | '',
  agentId: '',
  carrierId: '',
  polId: '',
  poeId: '',
  podId: '',
  containerTypeId: '',
  currencyId: '',
  quoteDate: '',
  validFrom: '',
  validTo: '',
})

const canUpload = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create))
const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve))
const canReject = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.reject))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.delete))
const canCreateRate = computed(
  () =>
    authStore.hasScope(PRICING_SCOPES.rates.create) &&
    authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate),
)
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.includes(row.id)),
)
const selectedRows = computed(() => rows.value.filter((row) => selectedIds.value.includes(row.id)))
const selectedPendingRows = computed(() =>
  selectedRows.value.filter((row) => row.status === 'Pending'),
)
const selectedPendingIds = computed(() => selectedPendingRows.value.map((row) => row.id))
const selectedApprovableIds = computed(() =>
  selectedPendingRows.value.filter(isPoeAssigned).map((row) => row.id),
)
const selectedUnassignedPoeCount = computed(
  () => selectedPendingRows.value.filter((row) => !isPoeAssigned(row)).length,
)
const pagePendingCount = computed(() => rows.value.filter((row) => row.status === 'Pending').length)
const pageApprovedCount = computed(() => rows.value.filter((row) => row.status === 'Approved').length)
const pageMissingPoeCount = computed(() => rows.value.filter((row) => row.status === 'Pending' && !isPoeAssigned(row)).length)
const pageReadyCount = computed(() => rows.value.filter((row) => row.status === 'Pending' && isPoeAssigned(row)).length)

const columns: DhTableColumn<ImportRateDto>[] = [
  { key: 'selected', label: '', width: '48px', align: 'center' },
  { key: 'carrier', label: 'Naviera' },
  { key: 'agent', label: 'Agente' },
  { key: 'route', label: 'Ruta' },
  { key: 'containerType', label: 'Contenedor' },
  { key: 'freight', label: 'Flete', align: 'right' },
  { key: 'freeDays', label: 'Días libres', align: 'center' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'usedAsRateCount', label: 'Uso', align: 'center' },
  { key: 'actions', label: 'Acción', align: 'right', width: '300px' },
]

const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Pendientes', value: 'Pending' },
  { label: 'Aprobadas', value: 'Approved' },
  { label: 'Rechazadas', value: 'Rejected' },
  { label: 'Creadas', value: 'Created' },
]
const sourceOptions = [
  { label: 'Todos', value: '' },
  { label: 'Correo', value: 'Email' },
  { label: 'PDF', value: 'Pdf' },
  { label: 'Excel', value: 'Excel' },
  { label: 'CSV', value: 'Csv' },
  { label: 'Imagen', value: 'Image' },
]

function statusLabel(status: string) {
  return (
    (
      {
        Pending: 'Pendiente',
        Approved: 'Aprobada',
        Rejected: 'Rechazada',
        Created: 'Creada',
        Expired: 'Vencida',
      } as Record<string, string>
    )[status] ?? status
  )
}

function sourceLabel(sourceType: string) {
  return (
    (
      {
        Email: 'Correo',
        Pdf: 'PDF',
        Excel: 'Excel',
        Csv: 'CSV',
        Image: 'Imagen',
      } as Record<string, string>
    )[sourceType] ?? sourceType
  )
}

function catalogLabel(
  items: typeof catalogs.carriers.value,
  id?: string | null,
  value?: string | null,
  fallback = '—',
) {
  return catalogs.findBestMatch(items, id, value)?.name || value || fallback
}

function carrierLabel(row: ImportRateDto) {
  return catalogLabel(catalogs.carriers.value, row.carrierId, row.carrier)
}

function agentLabel(row: ImportRateDto) {
  return catalogLabel(catalogs.agents.value, row.agentId, row.agent, 'Por asignar')
}

function polLabel(row: ImportRateDto) {
  return catalogLabel(catalogs.polPorts.value, row.polId, row.pol)
}

function isPoeAssigned(row: ImportRateDto) {
  return Boolean(catalogs.findById(catalogs.poePorts.value, row.poeId))
}

function poeLabel(row: ImportRateDto) {
  return catalogs.findById(catalogs.poePorts.value, row.poeId)?.name || 'No asignado'
}

function podLabel(row: ImportRateDto) {
  return catalogLabel(catalogs.podPorts.value, row.podId, row.pod)
}

function routeLabel(row: ImportRateDto) {
  return [polLabel(row), poeLabel(row), podLabel(row)].filter(Boolean).join(' → ')
}

function containerLabel(row: ImportRateDto) {
  return catalogLabel(catalogs.containerTypes.value, row.containerTypeId, row.containerType)
}

function currencyName(row: ImportRateDto) {
  return catalogLabel(catalogs.currencies.value, row.currencyId, row.currency, 'USD')
}

function filterValue(items: typeof catalogs.carriers.value, id: string) {
  const item = catalogs.findById(items, id)
  if (!item) return undefined

  const values = [...new Set([item.code, item.name].map((value) => value.trim()).filter(Boolean))]
  return values.join('|') || undefined
}

async function load(silent = false) {
  if (loading.value || refreshing.value) return

  try {
    if (silent) refreshing.value = true
    else loading.value = true
    const result = await PricingService.browseImportRates({
      pageNumber: page.value,
      pageSize: pageSize.value,
      importBatchId: batchFilter.value || undefined,
      search: filters.search || undefined,
      status: filters.status || undefined,
      sourceType: filters.sourceType || undefined,
      agent: filterValue(catalogs.agents.value, filters.agentId),
      carrier: filterValue(catalogs.carriers.value, filters.carrierId),
      pol: filterValue(catalogs.polPorts.value, filters.polId),
      poe: filterValue(catalogs.poePorts.value, filters.poeId),
      pod: filterValue(catalogs.podPorts.value, filters.podId),
      containerType: filterValue(catalogs.containerTypes.value, filters.containerTypeId),
      currency: filterValue(catalogs.currencies.value, filters.currencyId),
      quoteDate: filters.quoteDate || undefined,
      validFrom: filters.validFrom || undefined,
      validTo: filters.validTo || undefined,
    })
    rows.value = result.items
    total.value = result.totalCount ?? result.items.length
    selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id))
  } catch (error) {
    if (!silent) toastStore.backendError(error, 'No se pudieron cargar las tarifas importadas.')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function setStatus(status: ImportStatus | '') {
  filters.status = status
  page.value = 1
  const query = { ...route.query }
  if (status) query.status = status
  else delete query.status
  router.replace({ query })
  load()
}
function clearFilters() {
  Object.assign(filters, {
    search: '',
    status: '',
    sourceType: '',
    agentId: '',
    carrierId: '',
    polId: '',
    poeId: '',
    podId: '',
    containerTypeId: '',
    currencyId: '',
    quoteDate: '',
    validFrom: '',
    validTo: '',
  })
  batchFilter.value = ''
  if (route.query.importBatchId) {
    const query = { ...route.query }
    delete query.importBatchId
    router.replace({ query })
  }
  applyFilters()
}

function openBatchReview() {
  if (!batchFilter.value) return
  router.push(`/pricing/imports/review/${batchFilter.value}`)
}

function clearBatchFilter() {
  batchFilter.value = ''
  const query = { ...route.query }
  delete query.importBatchId
  router.replace({ query })
  page.value = 1
  load()
}

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((value) => value !== id)
    : [...selectedIds.value, id]
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : rows.value.map((row) => row.id)
}

function clearSelection() {
  selectedIds.value = []
}

async function approveOne(row: ImportRateDto) {
  if (!canApprove.value || row.status !== 'Pending' || processingId.value) return

  if (!isPoeAssigned(row)) {
    toastStore.warning(
      'POE no asignado',
      'Seleccione manualmente un POE válido antes de aprobar la importación.',
    )
    openPreview(row)
    return
  }

  try {
    processingId.value = row.id
    await PricingService.approveImportRate(row.id)
    toastStore.success('Importación aprobada')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar la importación.')
  } finally {
    processingId.value = null
  }
}

async function approveSelected() {
  const ids = [...selectedApprovableIds.value]
  if (!canApprove.value || !ids.length || bulkApproving.value) return

  try {
    bulkApproving.value = true
    await PricingService.approveImportRates(ids)
    toastStore.success(
      `${ids.length} importación${ids.length === 1 ? '' : 'es'} aprobada${ids.length === 1 ? '' : 's'}`,
    )
    clearSelection()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron aprobar las importaciones seleccionadas.')
  } finally {
    bulkApproving.value = false
  }
}

function rejectSelected() {
  const ids = [...selectedPendingIds.value]
  if (!canReject.value || !ids.length) return

  modalStore.open({
    title: 'Rechazar importaciones',
    component: PricingReasonModal,
    props: {
      target: 'import',
      ids,
      onSaved: async () => {
        clearSelection()
        await load()
      },
    },
  })
}

function openUpload() {
  drawerStore.open({
    title: 'Importar tarifario',
    component: PricingUploadDrawer,
    size: 'lg',
    props: { onSaved: load },
  })
}

function openConvert(row: ImportRateDto) {
  if (!canCreateRate.value || row.status === 'Rejected') return
  if (row.status !== 'Approved') {
    toastStore.warning(
      'Aprobación requerida',
      'Apruebe la importación antes de convertirla en tarifa.',
    )
    return
  }
  drawerStore.open({
    title: 'Crear tarifa desde importación',
    component: PricingRateFormDrawer,
    size: 'full',
    props: { sourceImport: row, onSaved: load },
  })
}

function openEmailInbox() {
  router.push('/pricing/email-imports')
}

function openPreview(row: ImportRateDto) {
  drawerStore.open({
    title: 'Detalle de tarifa importada',
    component: PricingImportPreviewDrawer,
    size: 'xl',
    props: {
      importRate: row,
      canApprove: canApprove.value,
      canReject: canReject.value,
      canCreateRate: canCreateRate.value,
      canAssignPoe: canApprove.value,
      onApproved: load,
      onPoeAssigned: load,
      onReject: (current: ImportRateDto) => {
        drawerStore.close()
        reject(current)
      },
      onCreateRate: openConvert,
    },
  })
}

function reject(row: ImportRateDto) {
  if (!canReject.value || row.status !== 'Pending') return

  modalStore.open({
    title: 'Rechazar importación',
    component: PricingReasonModal,
    props: { target: 'import', id: row.id, onSaved: load },
  })
}

function confirmDelete() {
  if (!selectedIds.value.length) return
  modalStore.open({
    title: 'Eliminar importaciones',
    component: DhConfirmDialog,
    props: {
      title: 'Eliminar importaciones',
      message: `¿Desea eliminar ${selectedIds.value.length} tarifa${selectedIds.value.length === 1 ? '' : 's'} importada${selectedIds.value.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await PricingService.deleteImportRates(selectedIds.value)
        selectedIds.value = []
        modalStore.close()
        toastStore.success('Importaciones eliminadas')
        await load()
      },
      onCancel: modalStore.close,
    },
  })
}

watch([page, pageSize], () => load())
watch(
  () => route.query.importBatchId,
  (value) => {
    const next = typeof value === 'string' ? value : ''
    if (next === batchFilter.value) return
    batchFilter.value = next
    page.value = 1
    load()
  },
)
useViewShortcuts({
  create: () => {
    if (canUpload.value) openUpload()
  },
  save: load,
  refresh: load,
})
onMounted(async () => {
  await catalogs.loadAll()
  await load()
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) load(true)
  }, 30_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Revisar importaciones"
      subtitle="Complete los datos pendientes, apruebe el lote y continúe hacia la decisión comercial."
      :icon="Import"
    >
      <template #actions>
        <DhButton
          label="Correos de tarifas"
          :icon="Mail"
          variant="secondary"
          @click="openEmailInbox"
        />
        <DhButton
          v-if="canUpload"
          label="Importar tarifario"
          :icon="FileSpreadsheet"
          @click="openUpload"
        />
      </template>
    </DhPageHeader>

    <PricingWorkflowGuide current="review" />

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        type="button"
        class="rounded-[24px] border p-4 text-left transition"
        :class="filters.status === 'Pending' ? 'border-amber-500/40 bg-amber-500/12' : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-amber-500/30'"
        @click="setStatus('Pending')"
      >
        <p class="text-xs font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">Pendientes</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ pagePendingCount }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Requieren revisión o aprobación</p>
      </button>
      <button
        type="button"
        class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-left transition hover:border-red-500/30"
        @click="setStatus('Pending')"
      >
        <p class="text-xs font-black uppercase tracking-[0.12em] text-red-600">Datos faltantes</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ pageMissingPoeCount }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Sin POE válido en la página</p>
      </button>
      <button
        type="button"
        class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-left transition hover:border-emerald-500/30"
        @click="setStatus('Pending')"
      >
        <p class="text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Listas para aprobar</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ pageReadyCount }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Completas en la página actual</p>
      </button>
      <button
        type="button"
        class="rounded-[24px] border p-4 text-left transition"
        :class="filters.status === 'Approved' ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.10)]' : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[rgb(var(--dh-primary-rgb)/0.35)]'"
        @click="setStatus('Approved')"
      >
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Aprobadas</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ pageApprovedCount }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Disponibles para crear tarifa</p>
      </button>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div
        v-if="batchFilter"
        class="mb-5 flex flex-col gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="font-black text-emerald-700 dark:text-emerald-300">
            Revisión lista para continuar
          </p>
          <p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ batchFilter }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Abrir pantalla de revisión" size="sm" @click="openBatchReview" />
          <DhButton label="Ver todas" variant="secondary" size="sm" @click="clearBatchFilter" />
        </div>
      </div>

      <DhCrudToolbar
        v-model:search="filters.search"
        title="Importaciones detectadas"
        create-label="Importar tarifario"
        :show-create="canUpload"
        @create="openUpload"
        @refresh="load"
        @search="applyFilters"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} registros · Abra una fila para corregirla o use la pantalla del lote para revisar en secuencia.
          </p></template
        >
      </DhCrudToolbar>

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
            v-model="filters.sourceType"
            label="Origen"
            :options="sourceOptions"
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
            v-model="filters.containerTypeId"
            label="Contenedor"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.containerOptions.value]"
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
            v-model="filters.currencyId"
            label="Moneda"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.currencyOptions.value]"
            placeholder=""
          />
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
        v-if="rows.length"
        class="mt-5 flex flex-col gap-3 rounded-[22px] border border-[var(--dh-border)] bg-black/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.03]"
      >
        <DhCheckbox
          :model-value="allSelected"
          label="Seleccionar todo"
          description="Selecciona todos los registros visibles en esta página."
          @update:model-value="toggleAll"
        />
        <DhButton
          v-if="selectedIds.length"
          label="Limpiar selección"
          variant="ghost"
          size="sm"
          @click="clearSelection"
        />
      </div>

      <div
        v-if="selectedIds.length"
        class="mt-3 flex flex-col gap-3 rounded-[22px] dh-bg-primary-soft px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <p class="text-sm font-black text-[var(--dh-primary)]">
            {{ selectedIds.length }} seleccionada{{ selectedIds.length === 1 ? '' : 's' }}
          </p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ selectedPendingIds.length }} pendiente{{
              selectedPendingIds.length === 1 ? '' : 's'
            }}. {{ selectedApprovableIds.length }} con POE asignado{{
              selectedApprovableIds.length === 1 ? '' : 's'
            }}
            para aprobar.
            <span v-if="selectedUnassignedPoeCount" class="text-amber-700 dark:text-amber-300">
              {{ selectedUnassignedPoeCount }} con POE no asignado.
            </span>
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton
            v-if="canApprove && selectedApprovableIds.length"
            :label="`Aprobar (${selectedApprovableIds.length})`"
            :icon="Check"
            size="sm"
            :loading="bulkApproving"
            @click="approveSelected"
          />
          <DhButton
            v-if="canReject && selectedPendingIds.length"
            :label="`Rechazar (${selectedPendingIds.length})`"
            :icon="X"
            variant="danger"
            size="sm"
            @click="rejectSelected"
          />
          <DhButton
            v-if="canDelete"
            label="Eliminar seleccionadas"
            :icon="Trash2"
            variant="danger"
            size="sm"
            @click="confirmDelete"
          />
        </div>
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="rows"
          :loading="loading"
          empty-text="No hay tarifas importadas que coincidan con los filtros."
          @row-click="openPreview"
        >
          <template #cell-selected="{ row }"
            ><div class="flex justify-center" @click.stop>
              <DhCheckbox
                :model-value="selectedIds.includes(row.id)"
                @update:model-value="toggleSelection(row.id)"
              /></div
          ></template>
          <template #cell-carrier="{ row }"
            ><div>
              <p class="font-black text-[var(--dh-text)]">{{ carrierLabel(row) }}</p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ sourceLabel(row.sourceType) }}
              </p>
            </div></template
          >
          <template #cell-agent="{ row }">
            <span
              class="font-bold"
              :class="agentLabel(row) === 'Por asignar' ? 'text-amber-600 dark:text-amber-400' : ''"
            >
              {{ agentLabel(row) }}
            </span>
          </template>
          <template #cell-route="{ row }"
            ><p
              class="whitespace-nowrap font-black"
              :class="!isPoeAssigned(row) ? 'text-amber-600 dark:text-amber-400' : ''"
            >
              {{ routeLabel(row) }}
            </p></template
          >
          <template #cell-containerType="{ row }"
            ><DhBadge :label="containerLabel(row)" variant="neutral"
          /></template>
          <template #cell-freight="{ row }"
            ><span class="font-black">{{
              formatMoney(row.freight, currencyName(row))
            }}</span></template
          >
          <template #cell-freeDays="{ row }"
            ><span class="font-black">{{ row.freeDays }}</span></template
          >
          <template #cell-validity="{ row }"
            ><div class="text-xs font-semibold">
              <p>{{ formatDate(row.validFrom) }}</p>
              <p class="text-[var(--dh-text-muted)]">hasta {{ formatDate(row.validTo) }}</p>
            </div></template
          >
          <template #cell-status="{ row }"
            ><DhBadge :label="statusLabel(row.status)" :variant="statusTone(row.status)"
          /></template>
          <template #cell-usedAsRateCount="{ row }"
            ><DhBadge
              :label="
                row.usedAsRateCount ? `Disponible · ${row.usedAsRateCount} usos` : 'Disponible'
              "
              variant="success"
          /></template>
          <template #cell-actions="{ row }">
            <div class="flex flex-wrap justify-end gap-2" @click.stop>
              <DhButton
                v-if="row.status === 'Pending'"
                :label="isPoeAssigned(row) ? 'Revisar / aprobar' : 'Completar datos'"
                :icon="Eye"
                size="sm"
                variant="secondary"
                @click="openPreview(row)"
              />
              <DhButton
                v-else
                label="Ver detalle"
                :icon="Eye"
                size="sm"
                variant="ghost"
                @click="openPreview(row)"
              />
              <DhButton
                v-if="canApprove && row.status === 'Pending' && isPoeAssigned(row)"
                label="Aprobar"
                :icon="Check"
                size="sm"
                :loading="processingId === row.id"
                @click="approveOne(row)"
              />
              <DhButton
                v-if="canCreateRate && row.status === 'Approved'"
                label="Crear tarifa"
                :icon="Ship"
                size="sm"
                @click="openConvert(row)"
              />
              <DhButton
                v-if="canReject && row.status === 'Pending'"
                label="Rechazar"
                :icon="X"
                size="sm"
                variant="ghost"
                :disabled="processingId === row.id"
                @click="reject(row)"
              />
            </div>
          </template>
        </DhDataTable>
      </div>
      <div class="mt-5">
        <DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </section>
  </section>
</template>
