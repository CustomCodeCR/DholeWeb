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
import { departmentStatusLabel, operationsLabel } from '../utils/caseOverview'

const { locale } = useI18n()
const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const page = ref(1)
const total = ref(0)
const rows = ref<OperationsCaseRow[]>([])
const selected = ref<OperationsCaseDetail | null>(null)
const selectedWorkspace = ref<OperationsCaseWorkspace | null>(null)
const selectedCaseId = computed(() => selected.value?.id || '')
const selectedStage = computed(() => selectedWorkspace.value?.stages.find(s => s.status === 'IN_PROGRESS')
  || selectedWorkspace.value?.stages.find(s => s.status === 'READY')
  || selectedWorkspace.value?.stages[0])
const selectedStatusLabel = computed(() => departmentStatusLabel(
  selectedStage.value?.departmentCode, selectedStage.value?.status, selected.value?.status,
  rows.value.find(x => x.id === selected.value?.id)?.originStatusCode,
))
const clientName = ref('')
const clientExecutiveName = ref('')
const resolvedAccounts = ref<Record<string, string>>({})
const resolvedPeople = ref<Record<string, string>>({})
const accountsChecked = new Set<string>()
function personName(id: string | null | undefined) {
  return id ? resolvedPeople.value[id] || 'Nombre pendiente de consulta' : 'Sin operativo asignado'
}
async function resolvePeople(ids: Array<string | null | undefined>) {
  const needed = [...new Set(ids.filter((id): id is string => Boolean(id && !resolvedPeople.value[id])))]
  if (!needed.length || !auth.hasScope('operations.audit.read')) return
  try {
    const result = await operationsApi.auditActors(needed)
    resolvedPeople.value = { ...resolvedPeople.value,
      ...Object.fromEntries(result.items.map(p => [p.id, p.displayName || p.userName])) }
  } catch { /* Case remains readable even if Auth names are temporarily unavailable. */ }
}
async function resolveAccountNames(ids: string[]) {
  const missing = [...new Set(ids)].filter(id => id && !resolvedAccounts.value[id] && !accountsChecked.has(id))
  if (!missing.length) return
  try {
    // CRM applies the caller's account ACL in one SQL query: no per-row account requests.
    const result = await crmRequest<{ items: Array<{
      id: string; displayName?: string; legalName?: string
    }> }>(crmPath('accounts', 'labels') + '?' + new URLSearchParams({ ids: missing.join(',') }))
    for (const item of result.items) {
      const name = String(item.displayName || item.legalName || '').trim()
      if (name) resolvedAccounts.value = { ...resolvedAccounts.value, [item.id]: name }
    }
    missing.forEach(id => accountsChecked.add(id))
  } catch {
    // During coordinated staging rollout, older CRM versions can still serve individual
    // authorized reads. Remove this compatibility fallback only after UAT confirms bulk.
    for (let i = 0; i < missing.length; i += 4) {
      await Promise.all(missing.slice(i, i + 4).map(async id => {
        accountsChecked.add(id)
        try {
          const account = await crmRequest<{ displayName?: string; legalName?: string; name?: string }>(crmPath('accounts', id))
          const name = String(account.displayName || account.legalName || account.name || '').trim()
          if (name) resolvedAccounts.value = { ...resolvedAccounts.value, [id]: name }
        } catch { /* Never display an unverified UUID as a customer name. */ }
      }))
    }
  }
}
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
const openingMissing = computed(() => {
  const items = opening.value.missingFields
  return Array.isArray(items) ? items.filter((v): v is string => typeof v === 'string') : []
})
const openingServices = computed(() => {
  const values = opening.value.services
  if (!Array.isArray(values)) return []
  return values.map(value => typeof value === 'string' ? value :
    value && typeof value === 'object' ? String((value as Record<string, unknown>).name ||
      (value as Record<string, unknown>).label ||
      (value as Record<string, unknown>).serviceCode || '') : '').filter(Boolean)
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
function accountLabel(id: string) { return resolvedAccounts.value[id] ||
  crmOptions.value.find(x => x.id === id)?.displayName || 'Cliente pendiente de consulta' }
async function loadClients() {
  fetchingClients.value = true
  try {
    crmOptions.value = (await operationsApi.crmAccounts(clientSearch.value)).items
    resolvedAccounts.value = { ...resolvedAccounts.value,
      ...Object.fromEntries(crmOptions.value.filter(x => x.displayName).map(x => [x.id, x.displayName])) }
  }
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
  { key: 'teamName', label: 'Equipo' },
  { key: 'assignedUserId', label: 'Operativo' },
  { key: 'departmentStatus', label: 'Estado de etapa' },
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
    void resolveAccountNames(result.items.map(x => x.accountId))
    void resolvePeople(result.items.map(x => x.assignedUserId))
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
  clientExecutiveName.value = ''
  selectedWorkspace.value = null
  selected.value = null
  try {
    const [detail, workspace] = await Promise.all([
      operationsApi.caseDetail(id), operationsApi.caseWorkspace(id),
    ])
    if (sequence !== detailSequence) return
    selected.value = detail
    selectedWorkspace.value = workspace
    clientName.value = accountLabel(detail.accountId)
    void resolvePeople([
      detail.createdBy, detail.executiveUserId,
      ...workspace.stages.map(s => s.assignedUserId),
      ...workspace.stages.flatMap(s => s.supervisorUserIds || []),
      ...(workspace.validators || []).map(v => v.userId),
    ])
    try {
      const account = await crmRequest<Record<string, unknown>>(crmPath('accounts', detail.accountId))
      if (sequence === detailSequence) {
        clientName.value = String(account.displayName || account.legalName || account.name || '').trim()
        clientExecutiveName.value = String(account.executiveName || '').trim()
        if (clientName.value) resolvedAccounts.value = { ...resolvedAccounts.value,
          [detail.accountId]: clientName.value }
        if (clientName.value && !crmOptions.value.some(x => x.id === detail.accountId))
          crmOptions.value.push({ id: detail.accountId, displayName: clientName.value })
      }
    } catch { /* CRM may be outside this user's scopes; never block the IDTRA. */ }
    if (!clientExecutiveName.value && detail.accountId) {
      try {
        const executive = await crmRequest<{ displayName?: string | null }>(
          crmPath('accounts', detail.accountId, 'assigned-executive'))
        if (sequence === detailSequence)
          clientExecutiveName.value = executive.displayName?.trim() || ''
      } catch { /* CRM is authoritative; the opening snapshot is the fallback. */ }
    }
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
      void resolvePeople([
        detail.createdBy, detail.executiveUserId,
        ...work.stages.map(s => s.assignedUserId),
        ...work.stages.flatMap(s => s.supervisorUserIds || []),
        ...(work.validators || []).map(v => v.userId),
      ])
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
        <template #cell-departmentCode="{ row }">{{ operationsLabel(row.departmentCode) }}</template>
        <template #cell-teamName="{ row }">{{ row.teamName || 'Sin equipo' }}</template>
        <template #cell-assignedUserId="{ row }">{{ personName(row.assignedUserId) }}</template>
        <template #cell-departmentStatus="{ row }">
          <DhBadge :variant="row.departmentStatus === 'COMPLETED' ? 'success' : row.departmentStatus === 'PENDING' ? 'warning' : 'primary'">{{ departmentStatusLabel(row.departmentCode, row.departmentStatus, row.status, row.originStatusCode) }}</DhBadge>
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
            <DhBadge :variant="selectedStage?.status === 'COMPLETED' ? 'success' : selectedStage?.status === 'PENDING' ? 'warning' : 'primary'">{{ selectedStatusLabel }}</DhBadge>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <DhBadge variant="neutral">{{ selected.apertureType === 'MANUAL' ? 'Manual' : 'Desde Pricing' }}</DhBadge>
            <DhBadge variant="primary">{{ openingText('shipmentType') || selected.modalityCode }}</DhBadge>
            <DhBadge v-if="openingText('incoterm')" variant="neutral">{{ openingText('incoterm') }}</DhBadge>
          </div>
        </div>

        <DhCard padding="sm">
          <div class="mb-3 flex items-center gap-2"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Cliente y comercial</h3></div>
          <p class="break-words text-base font-black">{{ clientName || accountLabel(selected.accountId) }}</p>
          <RouterLink :to="'/crm/accounts/' + selected.accountId" class="mt-1 inline-block text-xs font-semibold text-[var(--dh-primary)] hover:underline">Consultar cliente</RouterLink>
          <div class="mt-3 grid gap-3 border-t border-[var(--dh-border)] pt-3 sm:grid-cols-2">
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Ejecutivo comercial</p><p class="mt-1 text-sm font-semibold">{{ clientExecutiveName || openingText('executiveName') || personName(selected.executiveUserId) }}</p></div>
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Cotización vinculada</p>
              <RouterLink v-if="selected.sourceQuoteId" :to="'/pricing/rates/' + selected.sourceQuoteId + '/wizard?mode=view'" class="mt-1 inline-block text-sm font-bold text-[var(--dh-primary)]">Abrir QUO</RouterLink>
              <p v-else class="mt-1 text-sm font-semibold">SIN_QUO</p></div>
            <div v-if="openingText('clientPoReference')"><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">PO / referencia</p><p class="mt-1 break-words text-sm font-semibold">{{ openingText('clientPoReference') }}</p></div>
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Fecha de apertura</p><p class="mt-1 text-sm font-semibold">{{ formatDate(selected.createdAtUtc) }}</p></div>
          </div>
        </DhCard>

        <DhCard padding="sm">
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
        </DhCard>

        <DhCard padding="sm">
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
        </DhCard>

        <DhCard padding="sm">
          <div class="mb-3 flex items-center gap-2"><CheckCircle2 class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Responsables y validación</h3></div>
          <div v-if="selectedWorkspace?.stages.length" class="space-y-2">
            <div v-for="stage in selectedWorkspace.stages" :key="stage.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--dh-input)]/45 p-3">
              <div class="min-w-0"><p class="text-xs font-bold">{{ formatStatus(stage.departmentCode) }}</p><p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ stage.teamName || 'Equipo por asignar' }}</p>
                <p class="mt-1 text-xs font-semibold">Operativo: {{ personName(stage.assignedUserId) }}</p>
                <p v-if="stage.supervisorUserIds?.length" class="mt-1 text-xs text-[var(--dh-text-soft)]">
                  Supervisión: {{ stage.supervisorUserIds.map(id => personName(id)).join(', ') }}
                </p>
                <p v-if="stage.assignedAtUtc" class="mt-1 text-xs text-[var(--dh-text-muted)]">Asignación: {{ formatDate(stage.assignedAtUtc) }}</p>
                <p v-for="validator in (selectedWorkspace.validators || []).filter(v => v.caseStageId === stage.id)" :key="validator.userId" class="mt-1 text-xs text-[var(--dh-text-soft)]">
                  Validador {{ validator.slot }}: {{ personName(validator.userId) }} · {{ operationsLabel(validator.status) }}
                  <span v-if="validator.reviewedAtUtc">· {{ formatDate(validator.reviewedAtUtc) }}</span>
                </p>
                </div>
              <DhBadge :variant="stage.status === 'PENDING' ? 'warning' : 'neutral'">{{ departmentStatusLabel(stage.departmentCode, stage.status, selected.status, stage.departmentCode === 'COORDINACION_ORIGEN' ? rows.find(x => x.id === selected?.id)?.originStatusCode : null) }}</DhBadge>
            </div>
          </div>
          <p v-else class="text-xs text-[var(--dh-text-muted)]">Sin etapas activas.</p>
          <div v-if="selectedWorkspace?.tasks.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="mb-2 text-xs font-black">Tareas pendientes</p>
            <p v-for="task in selectedWorkspace.tasks.slice(0, 4)" :key="task.id" class="mb-1 text-xs text-[var(--dh-text-muted)]">{{ task.title }}</p>
          </div>
          <div class="mt-3 grid gap-2 border-t border-[var(--dh-border)] pt-3 text-xs sm:grid-cols-2">
            <p>Creado por: <strong>{{ personName(selected.createdBy) }}</strong></p>
            <p>Fecha: <strong>{{ formatDate(selected.createdAtUtc) }}</strong></p>
          </div>
          <p class="mt-3 text-[11px] text-[var(--dh-text-muted)]">Actualizado: {{ formatDate(selected.updatedAtUtc) }}</p>
        </DhCard>
        <DhCard padding="sm">
          <div class="flex items-center gap-2"><FileText class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-bold">Condiciones y datos complementarios</h3></div>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div v-for="item in [
              { label: 'Procedencia', value: openingText('provenance') },
              { label: 'Tipo de transporte', value: openingText('transportType') },
              { label: 'Tipo de embarque', value: openingText('shipmentType') },
              { label: 'Recolecta', value: openingText('pickupAddress') },
              { label: 'WHS', value: openingText('whsName') },
              { label: 'Entrega', value: openingText('destinationAddress') },
              { label: 'Naviera', value: openingText('carrierReference') },
              { label: 'Agente', value: openingText('agentReference') },
              { label: 'Merchant', value: openingText('merchantReference') },
              { label: 'Consolidado', value: openingText('consolidationReference') },
              { label: 'Observaciones', value: openingText('observations') },
            ]" :key="item.label" class="min-w-0">
              <p class="text-xs text-[var(--dh-text-muted)]">{{ item.label }}</p>
              <p class="mt-0.5 break-words text-sm font-semibold">{{ item.value || 'Pendiente / no aplica' }}</p>
            </div>
          </div>
          <div v-if="openingServices.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="text-xs font-bold">Servicios</p>
            <div class="mt-2 flex flex-wrap gap-2"><DhBadge v-for="service in openingServices" :key="service" variant="neutral">{{ service }}</DhBadge></div>
          </div>
          <div v-if="openingMissing.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="mb-2 text-xs font-bold">Campos por completar ({{ openingMissing.length }})</p>
            <p v-for="field in openingMissing" :key="field" class="text-xs text-[var(--dh-text-muted)]">{{ operationsLabel(field) }}</p>
          </div>
        </DhCard>
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
