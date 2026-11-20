<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, RefreshCw, Plus, ArrowUpRight, ClipboardList, Layers3 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import { operationsApi, type OperationsCaseRow, type OperationsCaseDetail, type OperationsCaseWorkspace } from '../services/operationsApi'
import OperationsManualCreateModal from '../components/OperationsManualCreateModal.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const page = ref(1)
const total = ref(0)
const rows = ref<OperationsCaseRow[]>([])
const selected = ref<OperationsCaseDetail | null>(null)
const selectedWorkspace = ref<OperationsCaseWorkspace | null>(null)
const clientName = ref('')
const showCreate = ref(false)
const search = ref('')
const status = ref('')
const apertureType = ref('')
const loading = ref(false)
const loadingDetail = ref(false)
const error = ref('')
const detailError = ref('')
const pages = computed(() => Math.max(1, Math.ceil(total.value / 25)))
const columns = computed<DhTableColumn<OperationsCaseRow>[]>(() => [
  { key: 'idtra', label: 'IDTRA' },
  { key: 'accountId', label: 'Cliente' },
  { key: 'sourceQuoteId', label: 'Cotización' },
  { key: 'modalityCode', label: 'Modalidad' },
  { key: 'departmentCode', label: 'Departamento' },
  { key: 'status', label: 'Estado' },
  { key: 'updatedAtUtc', label: 'Actualizado' },
  { key: 'actions', label: '', align: 'right' },
])
const typeOptions = [
  { label: 'Todas las procedencias', value: '' },
  { label: 'Apertura manual', value: 'MANUAL' },
  { label: 'Desde Pricing', value: 'AUTOMATIC' },
]
const statusOptions = [
  { label: 'Todos los estados', value: '' },
  ...['DRAFT','PENDING_VALIDATION','APERTURA_VALIDADA','APERTURA_REQUIERE_CAMBIOS','ACTIVE','ON_HOLD','COMPLETED','CANCELLED']
    .map(value => ({ label: formatStatus(value), value })),
]
function formatStatus(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ') : 'Sin asignar'
}
function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale.value === 'es' ? 'es-CR' : 'en-US')
}
function short(value: string | null | undefined) {
  return value ? value.slice(0, 8) : '—'
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await operationsApi.cases(page.value, {
      q: search.value, status: status.value, apertureType: apertureType.value,
    })
    rows.value = result.items
    total.value = result.total
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron consultar los trámites.'
  } finally { loading.value = false }
}
let detailSequence = 0
async function openCase(id: string) {
  const sequence = ++detailSequence
  loadingDetail.value = true
  detailError.value = ''
  clientName.value = ''
  selectedWorkspace.value = null
  selected.value = null
  try {
    const [detail, workspace] = await Promise.all([
      operationsApi.caseDetail(id), operationsApi.caseWorkspace(id),
    ])
    if (sequence !== detailSequence) return
    selected.value = detail
    selectedWorkspace.value = workspace
    try {
      const account = await crmRequest<Record<string, unknown>>(crmPath('accounts', detail.accountId))
      if (sequence === detailSequence) clientName.value = String(account.displayName ?? account.name ?? account.legalName ?? '')
    } catch { /* CRM may be outside this user's scopes; never block the IDTRA. */ }
  } catch (cause) {
    if (sequence === detailSequence)
      detailError.value = cause instanceof Error ? cause.message : 'No se pudo cargar el expediente.'
  } finally { if (sequence === detailSequence) loadingDetail.value = false }
}
function closeDrawer() {
  detailSequence++
  selected.value = null
  selectedWorkspace.value = null
  loadingDetail.value = false
  detailError.value = ''
}
async function onCreated(value: { id: string; idtra: string }) {
  page.value = 1
  await load()
  await openCase(value.id)
}
async function changePage(next: number) {
  page.value = Math.min(pages.value, Math.max(1, next))
  await load()
}
let filterTimer: ReturnType<typeof setTimeout> | undefined
watch([search, status, apertureType], () => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => { page.value = 1; void load() }, 250)
})
onMounted(load)
onUnmounted(() => { clearTimeout(filterTimer); detailSequence++ })
</script>

<template>
  <div class="mx-auto w-full max-w-[1680px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader title="Trámites" subtitle="Crea, busca y administra todos los expedientes operativos IDTRA a los que tienes acceso." :icon="FolderOpen" :hide-excel-export="true">
      <template #actions>
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <DhButton v-if="canCreate" :icon="Plus" label="Nuevo trámite" @click="showCreate = true" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>

    <DhCard :icon="FolderOpen" title="Todos los trámites" subtitle="Consulta los IDTRA creados manualmente y los provenientes de Pricing. Selecciona una fila para ver el resumen.">
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_210px]">
        <DhSearchInput v-model="search" placeholder="Buscar IDTRA, QUO o modalidad…" />
        <DhSelect v-model="apertureType" :options="typeOptions" />
        <DhSelect v-model="status" :options="statusOptions" />
      </div>
      <DhDataTable :columns="columns" :rows="rows" :loading="loading" empty-text="No hay trámites para los filtros seleccionados." @row-click="openCase($event.id)">
        <template #cell-idtra="{ row }">
          <strong class="text-sm font-black text-[var(--dh-primary)]">{{ row.idtra }}</strong>
        </template>
        <template #cell-accountId="{ row }">
          <span class="text-xs" :title="row.accountId">Cuenta CRM · {{ short(row.accountId) }}</span>
        </template>
        <template #cell-sourceQuoteId="{ row }">
          <RouterLink v-if="row.sourceQuoteId" :to="`/pricing/rates/${row.sourceQuoteId}/wizard?mode=view`" class="font-semibold text-[var(--dh-primary)] hover:underline" @click.stop>Ver QUO</RouterLink>
          <DhBadge v-else variant="neutral">Sin QUO</DhBadge>
        </template>
        <template #cell-modalityCode="{ row }"><DhBadge variant="neutral">{{ row.modalityCode }}</DhBadge></template>
        <template #cell-departmentCode="{ row }">{{ formatStatus(row.departmentCode) }}</template>
        <template #cell-status="{ row }">
          <DhBadge :variant="row.status === 'COMPLETED' ? 'success' : row.status.includes('PENDING') ? 'warning' : 'primary'">{{ formatStatus(row.status) }}</DhBadge>
        </template>
        <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc) }}</template>
        <template #cell-actions="{ row }">
          <DhButton variant="secondary" size="sm" label="Resumen" @click.stop="openCase(row.id)" />
        </template>
      </DhDataTable>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ total }} trámites · Página {{ page }} de {{ pages }}</p>
        <div class="flex gap-2">
          <DhButton variant="secondary" size="sm" label="Anterior" :disabled="page <= 1 || loading" @click="changePage(page - 1)" />
          <DhButton variant="secondary" size="sm" label="Siguiente" :disabled="page >= pages || loading" @click="changePage(page + 1)" />
        </div>
      </div>
    </DhCard>

    <OperationsManualCreateModal :open="showCreate && canCreate" @close="showCreate = false" @created="onCreated" />
    <DhDrawer :open="Boolean(selected) || loadingDetail || Boolean(detailError)" :title="selected ? 'Resumen · ' + selected.idtra : 'Resumen de trámite'" size="lg" @close="closeDrawer">
      <div v-if="loadingDetail" class="py-16 text-center text-sm text-[var(--dh-text-muted)]">Cargando expediente…</div>
      <div v-else-if="detailError" role="alert" class="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">{{ detailError }}</div>
      <div v-else-if="selected" class="space-y-5">
        <div class="flex flex-wrap gap-2">
          <DhBadge :variant="selected.apertureType === 'AUTOMATIC' ? 'primary' : 'neutral'">{{ selected.apertureType === 'AUTOMATIC' ? 'Desde Pricing' : 'Apertura manual' }}</DhBadge>
          <DhBadge variant="primary">{{ formatStatus(selected.status) }}</DhBadge>
          <DhBadge variant="neutral">{{ selected.modalityCode }}</DhBadge>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Cliente</p>
            <p class="break-words font-bold">{{ clientName || 'Cuenta de CRM' }}</p>
            <RouterLink :to="`/crm/accounts/${selected.accountId}`" class="mt-1 block text-xs text-[var(--dh-primary)] hover:underline">Consultar en CRM</RouterLink>
          </div>
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">QUO vinculada</p>
            <RouterLink v-if="selected.sourceQuoteId" :to="`/pricing/rates/${selected.sourceQuoteId}/wizard?mode=view`" class="font-bold text-[var(--dh-primary)] hover:underline">Abrir cotización</RouterLink>
            <p v-else class="font-bold">Sin QUO</p>
          </div>
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Ruta · países</p>
            <p class="font-bold">{{ selected.originCountryCode || 'Pendiente' }} → {{ selected.destinationCountryCode || 'Pendiente' }}</p>
          </div>
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Actualizado</p>
            <p class="font-bold">{{ formatDate(selected.updatedAtUtc) }}</p>
          </div>
        </div>
        <section>
          <h3 class="mb-3 text-sm font-black">Equipos y etapas</h3>
          <div v-if="selectedWorkspace?.stages.length" class="space-y-2">
            <div v-for="stage in selectedWorkspace.stages" :key="stage.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3">
              <div>
                <p class="text-sm font-bold">{{ formatStatus(stage.departmentCode) }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ stage.teamName || 'Equipo por asignar' }}</p>
              </div>
              <DhBadge variant="neutral">{{ formatStatus(stage.status) }}</DhBadge>
            </div>
          </div>
          <p v-else class="text-sm text-[var(--dh-text-muted)]">El expediente todavía no tiene etapas asignadas.</p>
        </section>
        <section v-if="selectedWorkspace?.tasks.length">
          <h3 class="mb-2 text-sm font-black">Pendientes</h3>
          <p v-for="task in selectedWorkspace.tasks.slice(0, 5)" :key="task.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3 text-sm">{{ task.title }} · {{ formatStatus(task.status) }}</p>
        </section>
      </div>
      <template #footer>
        <div v-if="selected" class="flex justify-end gap-2">
          <DhButton variant="secondary" label="Cerrar" @click="closeDrawer" />
          <RouterLink :to="{ name: 'operations-case-detail', params: { id: selected.id } }" @click="closeDrawer">
            <DhButton :icon="ArrowUpRight" label="Abrir expediente completo" />
          </RouterLink>
        </div>
      </template>
    </DhDrawer>
  </div>
</template>
