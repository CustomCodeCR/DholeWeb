<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, RefreshCw, Plus, ArrowUpRight, Route, Package, UsersRound, FileText, CheckCircle2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import { operationsApi, type OperationsCaseRow, type OperationsCaseDetail, type OperationsCaseWorkspace, type CrmAccountOption } from '../services/operationsApi'
import { useOperationsCaseRealtime } from '../composables/useOperationsCaseRealtime'
import { useRealtimeListRefresh } from '@/core/realtime/useRealtimeListRefresh'

const { locale } = useI18n()
const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const page = ref(1)
const total = ref(0)
const rows = ref<OperationsCaseRow[]>([])
const selected = ref<OperationsCaseDetail | null>(null)
const selectedWorkspace = ref<OperationsCaseWorkspace | null>(null)
const selectedCaseId = computed(() => selected.value?.id || '')
const clientName = ref('')
const opening = computed<Record<string, unknown>>(() => {
  try {
    const value: unknown = JSON.parse(selected.value?.openingDataJson || '{}')
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {}
  } catch { return {} }
})
function openingText(key: string) {
  const value = opening.value[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}
const openingEquipment = computed(() => {
  const values = opening.value.equipment
  if (!Array.isArray(values)) return [] as Array<{ label: string; quantity: number }>
  return values.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const equipment = item as Record<string, unknown>
    const label = String(equipment.equipmentType || '').trim()
    return label ? [{ label, quantity: Math.max(0, Number(equipment.quantity) || 0) }] : []
  })
})
const openingDocuments = computed(() => {
  const values = opening.value.supportDocuments
  if (!Array.isArray(values)) return [] as Array<{ id: string; label: string; fileName: string }>
  return values.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const document = item as Record<string, unknown>
    const fileName = String(document.fileName || '').trim()
    return fileName ? [{ id: String(document.id || fileName), label: String(document.categoryLabel || 'Documento'), fileName }] : []
  })
})
const openingFlags = computed(() => [
  opening.value.isImo === true ? 'IMO / peligrosa' : '',
  opening.value.overweight === true ? 'Sobrepeso' : '',
  ['LCL','LTL'].includes(openingText('shipmentType').toUpperCase()) ?
    opening.value.stackable === true ? 'Estibable' : 'No estibable' : '',
  openingText('portHandlingMode'),
].filter(Boolean))

const search = ref('')
const status = ref('')
const apertureType = ref('')
const accountId = ref('')
const clientSearch = ref('')
const crmOptions = ref<CrmAccountOption[]>([])
const fetchingClients = ref(false)
const clientChoices = computed(() => [
  { label: 'Todos los clientes', value: '' },
  ...crmOptions.value.map(x => ({ label: x.displayName || x.legalName || x.id, value: x.id })),
])
function accountLabel(id: string) { return crmOptions.value.find(x => x.id === id)?.displayName || 'Cuenta CRM · ' + short(id) }
async function loadClients() {
  fetchingClients.value = true
  try { crmOptions.value = (await operationsApi.crmAccounts(clientSearch.value)).items }
  catch { /* CRM account lookup may not be authorized; IDTRA search remains available. */ }
  finally { fetchingClients.value = false }
}
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
      q: search.value, status: status.value, apertureType: apertureType.value, accountId: accountId.value,
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
      if (sequence === detailSequence) {
        clientName.value = String(account.displayName ?? account.name ?? account.legalName ?? '')
        if (clientName.value && !crmOptions.value.some(x => x.id === detail.accountId))
          crmOptions.value.push({ id: detail.accountId, displayName: clientName.value })
      }
    } catch { /* CRM may be outside this user's scopes; never block the IDTRA. */ }
  } catch (cause) {
    if (sequence === detailSequence)
      detailError.value = cause instanceof Error ? cause.message : 'No se pudo cargar el expediente.'
  } finally { if (sequence === detailSequence) loadingDetail.value = false }
}
async function refreshSelected() {
  const id = selectedCaseId.value
  if (!id) return
  try {
    const [detail, work] = await Promise.all([
      operationsApi.caseDetail(id), operationsApi.caseWorkspace(id),
    ])
    if (selectedCaseId.value === id) {
      selected.value = detail
      selectedWorkspace.value = work
    }
  } catch { /* Keep the current drawer visible; the next manual refresh can retry. */ }
}
useOperationsCaseRealtime(selectedCaseId, () => {
  void load()
  void refreshSelected()
})
useRealtimeListRefresh({
  prefixes: ['/api/operations'],
  refresh: load,
  isEditing: () => false,
})
function closeDrawer() {
  detailSequence++
  selected.value = null
  selectedWorkspace.value = null
  loadingDetail.value = false
  detailError.value = ''
}
async function changePage(next: number) {
  page.value = Math.min(pages.value, Math.max(1, next))
  await load()
}
let filterTimer: ReturnType<typeof setTimeout> | undefined
watch([search, status, apertureType, accountId], () => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => { page.value = 1; void load() }, 250)
})
let crmTimer: ReturnType<typeof setTimeout> | undefined
watch(clientSearch, () => {
  clearTimeout(crmTimer)
  crmTimer = setTimeout(() => { void loadClients() }, 250)
})
onMounted(() => { void load(); void loadClients() })
onUnmounted(() => { clearTimeout(filterTimer); clearTimeout(crmTimer); detailSequence++ })
</script>

<template>
  <div class="mx-auto w-full max-w-[1680px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader title="Trámites" subtitle="Crea, busca y administra todos los expedientes operativos IDTRA a los que tienes acceso." :icon="FolderOpen" :hide-excel-export="true">
      <template #actions>
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <RouterLink v-if="canCreate" :to="{ name: 'operations-case-create' }"><DhButton :icon="Plus" label="Nuevo trámite" /></RouterLink>
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>

    <DhCard :icon="FolderOpen" title="Todos los trámites" subtitle="Consulta los IDTRA creados manualmente y los provenientes de Pricing. Selecciona una fila para ver el resumen.">
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_210px]">
        <DhSearchInput v-model="search" placeholder="Buscar IDTRA, QUO o modalidad…" />
        <DhSelect v-model="apertureType" :options="typeOptions" />
        <DhSelect v-model="status" :options="statusOptions" />
      </div>
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(190px,250px)]">
        <DhSearchInput v-model="clientSearch" placeholder="Buscar cliente en CRM…" />
        <DhSelect v-model="accountId" :options="clientChoices" :disabled="fetchingClients" />
      </div>
      <DhDataTable :columns="columns" :rows="rows" :loading="loading" empty-text="No hay trámites para los filtros seleccionados." @row-click="openCase($event.id)">
        <template #cell-idtra="{ row }">
          <strong class="text-sm font-black text-[var(--dh-primary)]">{{ row.idtra }}</strong>
        </template>
        <template #cell-accountId="{ row }">
          <span class="text-xs" :title="row.accountId">{{ accountLabel(row.accountId) }}</span>
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

    <DhDrawer :open="Boolean(selected) || loadingDetail || Boolean(detailError)" :title="selected ? 'Resumen · ' + selected.idtra : 'Resumen de trámite'" size="lg" @close="closeDrawer">
      <div v-if="loadingDetail" class="py-16 text-center text-sm text-[var(--dh-text-muted)]">Cargando expediente…</div>
      <div v-else-if="detailError" role="alert" class="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">{{ detailError }}</div>
      <div v-else-if="selected" class="space-y-4 pb-2">
        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><p class="text-[10px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">Expediente operativo</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-primary)]">{{ selected.idtra }}</p></div>
            <DhBadge :variant="selected.status === 'DRAFT' ? 'warning' : selected.status === 'COMPLETED' ? 'success' : 'primary'">{{ formatStatus(selected.status) }}</DhBadge>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <DhBadge variant="neutral">{{ selected.apertureType === 'MANUAL' ? 'Manual' : 'Desde Pricing' }}</DhBadge>
            <DhBadge variant="primary">{{ openingText('shipmentType') || selected.modalityCode }}</DhBadge>
            <DhBadge v-if="openingText('incoterm')" variant="neutral">{{ openingText('incoterm') }}</DhBadge>
          </div>
        </div>

        <section class="rounded-[20px] border border-[var(--dh-border)] p-4">
          <div class="mb-3 flex items-center gap-2"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Cliente y comercial</h3></div>
          <p class="break-words text-base font-black">{{ clientName || 'Cuenta de CRM' }}</p>
          <RouterLink :to="'/crm/accounts/' + selected.accountId" class="mt-1 inline-block text-xs font-semibold text-[var(--dh-primary)] hover:underline">Consultar cliente</RouterLink>
          <div class="mt-3 grid gap-3 border-t border-[var(--dh-border)] pt-3 sm:grid-cols-2">
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Ejecutivo comercial</p><p class="mt-1 text-sm font-semibold">{{ openingText('executiveName') || (selected.executiveUserId ? 'Responsable asignado en CRM' : 'Pendiente') }}</p></div>
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Cotización vinculada</p>
              <RouterLink v-if="selected.sourceQuoteId" :to="'/pricing/rates/' + selected.sourceQuoteId + '/wizard?mode=view'" class="mt-1 inline-block text-sm font-bold text-[var(--dh-primary)]">Abrir QUO</RouterLink>
              <p v-else class="mt-1 text-sm font-semibold">SIN_QUO</p></div>
            <div v-if="openingText('clientPoReference')"><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">PO / referencia</p><p class="mt-1 break-words text-sm font-semibold">{{ openingText('clientPoReference') }}</p></div>
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Fecha de apertura</p><p class="mt-1 text-sm font-semibold">{{ formatDate(selected.createdAtUtc) }}</p></div>
          </div>
        </section>

        <section class="rounded-[20px] border border-[var(--dh-border)] p-4">
          <div class="mb-3 flex items-center gap-2"><Route class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Ruta del embarque</h3></div>
          <div class="space-y-0">
            <div v-for="(stop, i) in [{ label: 'Origen / POL', place: openingText('pol') }, { label: 'Entrada / POE', place: openingText('poe') }, { label: 'Destino / POD', place: openingText('pod') }]" :key="stop.label" class="flex gap-3">
              <div class="flex w-3 flex-col items-center"><span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--dh-primary)]"></span><span v-if="i !== 2" class="min-h-8 w-px grow bg-[var(--dh-border)]"></span></div>
              <div class="min-w-0 pb-3"><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">{{ stop.label }}</p><p class="mt-0.5 break-words text-sm font-black">{{ stop.place || 'Por definir' }}</p></div>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 border-t border-[var(--dh-border)] pt-3 text-xs">
            <span>ETD <strong>{{ openingText('etm') || 'Por confirmar' }}</strong></span>
            <span>ETA <strong>{{ openingText('eta') || 'Por confirmar' }}</strong></span>
          </div>
        </section>

        <section class="rounded-[20px] border border-[var(--dh-border)] p-4">
          <div class="mb-3 flex items-center gap-2"><Package class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Mercancía y equipos</h3></div>
          <p class="break-words text-sm font-semibold">{{ openingText('cargoDescription') || 'Mercancía pendiente' }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-if="openingText('cabysCode')" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">CABYS {{ openingText('cabysCode') }}</span>
            <span v-if="openingText('packageCount')" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">{{ openingText('packageCount') }} {{ openingText('packageType') || 'bultos' }}</span>
            <span v-if="openingText('volumeValue')" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">{{ openingText('volumeValue') }} {{ openingText('volumeUnit') }}</span>
            <span v-for="(item, i) in openingEquipment" :key="i" class="rounded-lg border border-[var(--dh-primary)]/25 px-2.5 py-1 text-xs font-bold">{{ item.quantity }} × {{ item.label }}</span>
          </div>
          <div v-if="openingFlags.length" class="mt-3 flex flex-wrap gap-2 border-t border-[var(--dh-border)] pt-3"><DhBadge v-for="flag in openingFlags" :key="flag" variant="neutral">{{ flag }}</DhBadge></div>
          <div class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <div class="flex items-center gap-2"><FileText class="h-4 w-4 text-[var(--dh-primary)]" /><p class="text-xs font-black">Documentos ({{ openingDocuments.length }})</p></div>
            <p v-if="!openingDocuments.length" class="mt-1 text-xs text-[var(--dh-text-muted)]">Sin documentos registrados.</p>
            <div v-else class="mt-2 space-y-1.5">
              <p v-for="doc in openingDocuments" :key="doc.id" class="break-words rounded-lg bg-[var(--dh-input)] p-2 text-xs"><strong>{{ doc.label }}</strong> · {{ doc.fileName }}</p>
            </div>
          </div>
        </section>

        <section class="rounded-[20px] border border-[var(--dh-border)] p-4">
          <div class="mb-3 flex items-center gap-2"><CheckCircle2 class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Responsables y validación</h3></div>
          <div v-if="selectedWorkspace?.stages.length" class="space-y-2">
            <div v-for="stage in selectedWorkspace.stages" :key="stage.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--dh-input)]/45 p-3">
              <div class="min-w-0"><p class="text-xs font-bold">{{ formatStatus(stage.departmentCode) }}</p><p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ stage.teamName || 'Equipo por asignar' }}</p></div>
              <DhBadge :variant="stage.status === 'PENDING_VALIDATION' ? 'warning' : 'neutral'">{{ formatStatus(stage.status) }}</DhBadge>
            </div>
          </div>
          <p v-else class="text-xs text-[var(--dh-text-muted)]">Sin etapas activas.</p>
          <div v-if="selectedWorkspace?.tasks.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="mb-2 text-xs font-black">Tareas pendientes</p>
            <p v-for="task in selectedWorkspace.tasks.slice(0, 4)" :key="task.id" class="mb-1 text-xs text-[var(--dh-text-muted)]">{{ task.title }}</p>
          </div>
          <p class="mt-3 text-[11px] text-[var(--dh-text-muted)]">Actualizado: {{ formatDate(selected.updatedAtUtc) }}</p>
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
