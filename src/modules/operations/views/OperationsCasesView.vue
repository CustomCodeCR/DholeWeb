<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { FolderOpen, RefreshCw, Plus, ArrowUpRight } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect, DhInput, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhPagination, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import { operationsApi, type OperationsCaseRow, type OperationsCaseDetail, type OperationsCaseWorkspace, type CrmAccountOption } from '../services/operationsApi'
import { useOperationsCaseRealtime, useOperationsDashboardRealtime } from '../composables/useOperationsCaseRealtime'
import { useRealtimeListRefresh } from '@/core/realtime/useRealtimeListRefresh'
import { departmentStatusLabel, operationsLabel } from '../utils/caseOverview'

import { mergeCommercialOpening, useCommercialLabels, sameRevisionCommercialData, readable } from '../utils/commercialPresentation'

const { locale } = useI18n()
const route = useRoute()
const { openingField, serviceLabels } = useCommercialLabels()
const supplemental = ref<Record<string, unknown>>({})
const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const canConfigureIdtra = computed(() => ['SuperAdmin', 'SuperUsuario', 'SuperUser'].some(role => auth.hasRole(role)))
const sequenceOpen = ref(false)
const sequenceBusy = ref(false)
const sequenceCurrent = ref<number | null>(null)
const sequenceNext = ref('')
const sequenceReason = ref('')
const sequenceError = ref('')
const sequenceSuccess = ref('')
const validSequence = computed(() => sequenceCurrent.value !== null
  && /^[0-9]+$/.test(sequenceNext.value)
  && Number.isSafeInteger(Number(sequenceNext.value))
  && Number(sequenceNext.value) >= sequenceCurrent.value
  && Number(sequenceNext.value) <= 999999999999
  && sequenceReason.value.trim().length >= 3
  && sequenceReason.value.trim().length <= 500)
async function openSequence() {
  if (!canConfigureIdtra.value) return
  sequenceOpen.value = true
  sequenceBusy.value = true
  sequenceError.value = ''
  sequenceSuccess.value = ''
  sequenceCurrent.value = null
  sequenceNext.value = ''
  sequenceReason.value = ''
  try {
    const result = await operationsApi.idtraSequence()
    sequenceCurrent.value = result.nextNumber
    sequenceNext.value = String(result.nextNumber)
  } catch { sequenceError.value = 'No se pudo consultar el consecutivo. Verifique Operations.' }
  finally { sequenceBusy.value = false }
}
async function saveSequence() {
  if (!canConfigureIdtra.value || !validSequence.value || sequenceBusy.value || sequenceCurrent.value === null) return
  sequenceBusy.value = true
  sequenceError.value = ''
  sequenceSuccess.value = ''
  try {
    const result = await operationsApi.configureIdtraSequence(Number(sequenceNext.value), sequenceCurrent.value, sequenceReason.value.trim())
    sequenceCurrent.value = result.nextNumber
    sequenceNext.value = String(result.nextNumber)
    sequenceReason.value = ''
    sequenceSuccess.value = 'Próximo IDTRA confirmado por Operations.'
  } catch { sequenceError.value = 'No se guardó el consecutivo. Es posible que se haya creado un trámite o que otro administrador lo haya cambiado. Consulte el valor actual.' }
  finally { sequenceBusy.value = false }
}
const page = ref(1)
const total = ref(0)
const rows = ref<OperationsCaseRow[]>([])
const selected = ref<OperationsCaseDetail | null>(null)
const selectedWorkspace = ref<OperationsCaseWorkspace | null>(null)
const selectedCaseId = computed(() => selected.value?.id || '')
const selectedStage = computed(() => selectedWorkspace.value?.stages.find(s => s.status === 'IN_PROGRESS')
  || selectedWorkspace.value?.stages.find(s => s.status === 'READY')
  || selectedWorkspace.value?.stages.find(s => !['COMPLETED', 'SKIPPED'].includes(s.status))
  || selectedWorkspace.value?.stages[0])
const selectedStatusLabel = computed(() => departmentStatusLabel(
  selectedStage.value?.departmentCode, selectedStage.value?.status, selected.value?.status,
  rows.value.find(x => x.id === selected.value?.id)?.originStatusCode,
))
const clientName = ref('')
const accountDetails = ref<Record<string, unknown>>({})
const clientContacts = ref<import('../services/operationsApi').OperationsContact[]>([])
const contactsUnavailable = ref(false)
const contactsLoading = ref(false)
let drawerReadSequence = 0
async function loadCaseCommercialAndContacts(id: string, sequence: number) {
  contactsLoading.value = true
  const requestSequence = ++drawerReadSequence
  try {
    const contacts = await operationsApi.caseContacts(id)
    if (sequence !== detailSequence || requestSequence !== drawerReadSequence || selectedCaseId.value !== id) return
    clientContacts.value = Array.isArray(contacts) ? contacts : []
    contactsUnavailable.value = false
  } catch {
    if (sequence === detailSequence && requestSequence === drawerReadSequence && selectedCaseId.value === id) contactsUnavailable.value = true
  } finally {
    if (sequence === detailSequence && requestSequence === drawerReadSequence && selectedCaseId.value === id) contactsLoading.value = false
  }
}
const clientExecutiveName = ref('')
const resolvedAccounts = ref<Record<string, string>>({})
const caseClientNames = ref<Record<string, string | null>>({})
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
      ? selected.value?.apertureType === 'MANUAL' ? value as Record<string, unknown> : mergeCommercialOpening(value as Record<string, unknown>, selectedWorkspace.value?.commercialData, supplemental.value) : {}
  } catch { return {} }
})
function openingText(key: string) { return openingField(key, opening.value) }
const openingServices = computed(() => serviceLabels(opening.value))

const search = ref('')
const status = ref('')
const apertureType = ref('')
const accountId = ref('')
const clientSearch = ref('')
const crmOptions = ref<CrmAccountOption[]>([])
const fetchingClients = ref(false)
const clientChoices = computed(() => [
  { label: 'Todos los clientes', value: '' },
  ...crmOptions.value.map(x => ({ label: x.displayName || x.legalName || 'Nombre pendiente de CRM', value: x.id })),
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
const pageSize = ref(25)
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const columns = computed<DhTableColumn<OperationsCaseRow>[]>(() => [
  { key: 'idtra', label: 'IDTRA' },
  { key: 'accountId', label: 'Cliente', width: '240px' },
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
    .map(value => ({ label: operationsLabel(value), value })),
]
function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale.value === 'es' ? 'es-CR' : 'en-US')
}
function short(value: string | null | undefined) {
  return value ? value.slice(0, 8) : '—'
}
let listSequence = 0
async function load() {
  const current = ++listSequence
  loading.value = true
  error.value = ''
  try {
    const result = await operationsApi.cases(page.value, {
      q: search.value, status: status.value, apertureType: apertureType.value, accountId: accountId.value,
    }, pageSize.value)
    if (current !== listSequence) return
    rows.value = result.items
    total.value = result.total
    if (page.value > pages.value) { page.value = pages.value; await load(); return }
    caseClientNames.value = result.clientNames || {}
    resolvedPeople.value = { ...resolvedPeople.value, ...(result.people || {}) }
    void resolveAccountNames(result.items.map(x => x.accountId))
    void resolvePeople(result.items.flatMap(x => [x.assignedUserId, ...(x.pendingValidatorIds || [])]))
  } catch (cause) {
    if (current !== listSequence) return
    rows.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudieron consultar los trámites.'
  } finally { if (current === listSequence) loading.value = false }
}
let detailSequence = 0
async function openCase(id: string) {
  const sequence = ++detailSequence
  loadingDetail.value = true
  detailError.value = ''
  clientName.value = ''
  accountDetails.value = {}
  clientExecutiveName.value = ''
  selectedWorkspace.value = null
  clientContacts.value = []
  contactsUnavailable.value = false
  supplemental.value = {}
  selected.value = null
  try {
    const [detail, workspace] = await Promise.all([
      operationsApi.caseDetail(id), operationsApi.caseWorkspace(id),
    ])
    if (sequence !== detailSequence) return
    selected.value = detail
    selectedWorkspace.value = workspace
    void loadCaseCommercialAndContacts(id, sequence)
    resolvedPeople.value = { ...resolvedPeople.value, ...(workspace.people || {}) }
    void sameRevisionCommercialData(workspace).then(x => { if (sequence === detailSequence) supplemental.value = x })
    clientName.value = resolvedAccounts.value[detail.accountId] || readable(workspace.commercialData?.clientName) || readable(caseClientNames.value[detail.id])
    void resolvePeople([
      detail.createdBy, detail.executiveUserId,
      ...workspace.stages.map(s => s.assignedUserId),
      ...workspace.stages.flatMap(s => s.supervisorUserIds || []),
      ...(workspace.validators || []).map(v => v.userId),
    ])
    try {
      const account = await crmRequest<Record<string, unknown>>(crmPath('operations/accounts', detail.accountId))
      if (sequence === detailSequence) {
        accountDetails.value = account
        clientName.value = String(account.displayName || account.legalName || account.name || '').trim() || clientName.value
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
      void loadCaseCommercialAndContacts(id, detailSequence)
      resolvedPeople.value = { ...resolvedPeople.value, ...(work.people || {}) }
      void resolvePeople([
        detail.createdBy, detail.executiveUserId,
        ...work.stages.map(s => s.assignedUserId),
        ...work.stages.flatMap(s => s.supervisorUserIds || []),
        ...(work.validators || []).map(v => v.userId),
      ])
    }
  } catch { if (selectedCaseId.value === id) closeDrawer() }
}
useOperationsCaseRealtime(selectedCaseId, () => {
  void load()
  void refreshSelected()
})
useOperationsDashboardRealtime(() => {
  window.dispatchEvent(new CustomEvent('dhole:data:changed', {
    detail: { endpoint: '/api/operations/cases', method: 'SIGNALR' },
  }))
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
async function changePageSize(next: number) {
  pageSize.value = next
  page.value = 1
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
watch(() => auth.userId, () => { closeDrawer(); rows.value = []; total.value = 0; page.value = 1; void load() })
onMounted(() => { void load(); void loadClients() })
onUnmounted(() => { clearTimeout(filterTimer); clearTimeout(crmTimer); detailSequence++ })
</script>

<template>
  <div class="mx-auto w-full max-w-[1680px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader title="Trámites" subtitle="Crea, busca y administra todos los expedientes operativos IDTRA a los que tienes acceso." :icon="FolderOpen" :hide-excel-export="true">
      <template #actions>
        <DhButton v-if="canConfigureIdtra" variant="secondary" label="Consecutivo IDTRA" @click="openSequence" />
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <RouterLink v-if="canCreate" :to="{ name: 'operations-case-create' }"><DhButton :icon="Plus" label="Nuevo trámite" /></RouterLink>
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>

    <DhDrawer :open="sequenceOpen && canConfigureIdtra" title="Configuración de consecutivo IDTRA" size="lg" @close="sequenceOpen = false">
      <div class="space-y-4">
        <DhCard padding="sm" title="Migración y continuidad">
          <p class="text-sm text-[var(--dh-text-muted)]">El número ingresado corresponde al siguiente IDTRA nuevo. Los expedientes históricos conservan su identificador original. Nunca se reutilizan números emitidos ni se disminuye el consecutivo.</p>
          <div v-if="sequenceCurrent !== null" class="mt-3 space-y-1">
            <p class="text-xs text-[var(--dh-text-muted)]">Siguiente número confirmado</p>
            <p class="text-xl font-bold tabular-nums">IDTRA{{ sequenceCurrent }}</p>
          </div>
        </DhCard>
        <DhInput v-model="sequenceNext" type="number" label="Primer número / siguiente IDTRA" :min="sequenceCurrent || 1" :max="999999999999" :step="1" :disabled="sequenceBusy || sequenceCurrent === null" />
        <DhTextarea v-model="sequenceReason" label="Motivo del cambio" placeholder="Ej. nueva fecha de corte de migración" :disabled="sequenceBusy" />
        <p v-if="validSequence" class="text-sm text-[var(--dh-text-muted)]">Los próximos números serán IDTRA{{ Number(sequenceNext) }} e IDTRA{{ Number(sequenceNext) + 1 }} si no hay otra asignación concurrente.</p>
        <p v-if="sequenceError" role="alert" class="text-sm text-red-500">{{ sequenceError }}</p>
        <DhBadge v-if="sequenceSuccess" variant="success">{{ sequenceSuccess }}</DhBadge>
        <DhButton variant="secondary" label="Consultar valor actual" :loading="sequenceBusy" @click="openSequence" />
      </div>
      <template #footer>
        <DhButton variant="secondary" label="Cerrar" @click="sequenceOpen = false" />
        <DhButton label="Guardar próximo IDTRA" :disabled="!validSequence" :loading="sequenceBusy" @click="saveSequence" />
      </template>
    </DhDrawer>

    <DhCard v-if="route.query.manualSubmitted === '1'" padding="sm">Trámite manual registrado para Coordinación Origen. El pool realizará o recuperará la asignación sin doble aprobación.</DhCard>
    <DhCard padding="sm" title="Mis trámites asignados" subtitle="Selecciona un expediente autorizado para consultar su resumen.">
      <div class="mb-3 grid gap-3 sm:grid-cols-2">
        <DhSearchInput v-model="search" placeholder="Buscar IDTRA, QUO o modalidad…" />
        <DhSearchInput v-model="clientSearch" placeholder="Buscar cliente en CRM…" />
      </div>
      <div class="mb-4 grid gap-3 sm:grid-cols-3">
        <DhSelect v-model="accountId" label="Cliente" :options="clientChoices" :disabled="fetchingClients" />
        <DhSelect v-model="apertureType" label="Procedencia" :options="typeOptions" />
        <DhSelect v-model="status" label="Estado" :options="statusOptions" />
      </div>
      <DhDataTable :columns="columns" :rows="rows" :loading="loading" empty-text="No hay trámites para los filtros seleccionados." @row-click="openCase($event.id)">
        <template #cell-idtra="{ row }">
          <strong class="text-sm font-black text-[var(--dh-primary)]">{{ row.idtra }}</strong>
        </template>
        <template #cell-accountId="{ row }">
          <span class="inline-block min-w-[12rem] break-normal text-sm font-semibold">{{ resolvedAccounts[row.accountId] || readable(caseClientNames[row.id]) || accountLabel(row.accountId) }}</span>
        </template>
        <template #cell-sourceQuoteId="{ row }">
          <RouterLink v-if="row.sourceQuoteId" :to="`/pricing/rates/${row.sourceQuoteOptionId || row.sourceQuoteId}/wizard?mode=view`" class="font-semibold text-[var(--dh-primary)] hover:underline" @click.stop>{{ row.quoteNumber || 'Número pendiente de consulta' }}</RouterLink>
          <DhBadge v-else variant="neutral">Sin QUO</DhBadge>
        </template>
        <template #cell-modalityCode="{ row }"><DhBadge variant="neutral">{{ row.modalityCode }}</DhBadge></template>
        <template #cell-departmentCode="{ row }">{{ operationsLabel(row.departmentCode) }}</template>
        <template #cell-teamName="{ row }">{{ row.teamName || 'Sin equipo' }}</template>
        <template #cell-assignedUserId="{ row }">
          <div v-if="row.pendingValidatorIds?.length" class="space-y-1 text-xs">
            <p v-for="id in row.pendingValidatorIds" :key="id" class="break-words">{{ personName(id) }}</p>
          </div>
          <span v-else>{{ personName(row.assignedUserId) }}</span>
        </template>
        <template #cell-departmentStatus="{ row }">
          <DhBadge :variant="row.departmentStatus === 'COMPLETED' ? 'success' : row.departmentStatus === 'PENDING' ? 'warning' : 'primary'">{{ departmentStatusLabel(row.departmentCode, row.departmentStatus, row.status, row.originStatusCode) }}</DhBadge>
        </template>
        <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc) }}</template>
        <template #cell-actions="{ row }">
          <RouterLink v-if="row.apertureType === 'AUTOMATIC' && row.pendingValidatorIds?.includes(auth.userId || '') && auth.hasScope('operations.aperture.validation.review')" :to="{ name: 'operations-case-detail', params: { id: row.id } }" @click.stop><DhButton size="sm" label="Revisar apertura" /></RouterLink>
          <DhButton v-else variant="secondary" size="sm" label="Resumen" @click.stop="openCase(row.id)" />
        </template>
      </DhDataTable>
      <DhPagination class="mt-4" :page="page" :page-size="pageSize" :total="total"
        @update:page="changePage" @update:page-size="changePageSize" />
    </DhCard>

    <DhDrawer :open="Boolean(selected) || loadingDetail || Boolean(detailError)" :title="selected ? 'Resumen · ' + selected.idtra : 'Resumen de trámite'" size="lg" @close="closeDrawer">
      <div v-if="loadingDetail" class="py-16 text-center text-sm text-[var(--dh-text-muted)]">Cargando expediente…</div>
      <div v-else-if="detailError" role="alert" class="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">{{ detailError }}</div>
      <div v-else-if="selected" class="space-y-3 pb-2">
        <DhCard padding="sm" title="Expediente operativo">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div><p class="text-xl font-bold">{{ selected.idtra }}</p><p class="text-xs text-[var(--dh-text-muted)]">{{ selected.apertureType === 'AUTOMATIC' ? 'Desde Pricing' : 'Manual' }}</p></div>
            <DhBadge :variant="['HOLD', 'ON_HOLD'].includes(selected.status) ? 'danger' : selectedStage?.status === 'COMPLETED' ? 'success' : selectedStage?.status === 'PENDING' ? 'warning' : 'primary'">{{ selectedStatusLabel }}</DhBadge>
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div><p class="text-xs text-[var(--dh-text-muted)]">QUO</p><p class="text-sm font-semibold">{{ selectedWorkspace?.quotes.find(q => q.isPrimary)?.quoteNumber || selectedWorkspace?.quotes[0]?.quoteNumber || (selected.sourceQuoteId ? 'Número pendiente de consulta' : 'Sin QUO') }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Referencia del cliente</p><p class="break-words text-sm font-semibold">{{ openingText('clientPoReference') || 'Sin referencia' }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Equipo</p><p class="text-sm font-semibold">{{ selectedStage?.teamName || 'Por asignar' }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Operativo</p><p class="text-sm font-semibold">{{ personName(selectedStage?.assignedUserId) }}</p></div>
          </div>
          <div class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="mb-2 text-xs text-[var(--dh-text-muted)]">Servicios</p>
            <div class="flex flex-wrap gap-2"><DhBadge v-for="service in openingServices" :key="service" variant="neutral">{{ service }}</DhBadge><span v-if="!openingServices.length" class="text-sm text-[var(--dh-text-muted)]">Sin servicios registrados</span></div>
          </div>
        </DhCard>
        <DhCard padding="sm" title="Cuenta y contactos">
          <p class="break-words text-base font-bold">{{ clientName || readable(opening.clientName) || accountLabel(selected.accountId) }}</p>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div><p class="text-xs text-[var(--dh-text-muted)]">Ejecutivo</p><p class="text-sm font-semibold">{{ clientExecutiveName || openingText('executiveName') || personName(selected.executiveUserId) }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">División</p><p class="text-sm font-semibold">{{ openingText('crmDivisionName') || 'Sin división' }}</p></div>
            <div v-for="field in [{label:'Razón social', value:readable(accountDetails.legalName)}, {label:'Identificación', value:readable(accountDetails.taxId)}, {label:'Teléfono', value:readable(accountDetails.phone)}, {label:'Correo', value:readable(accountDetails.email)}, {label:'Dirección', value:readable(accountDetails.address)}].filter(x => x.value)" :key="field.label"><p class="text-xs text-[var(--dh-text-muted)]">{{ field.label }}</p><p class="break-words text-sm">{{ field.value }}</p></div>
          </div>
          <div class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="mb-2 text-sm font-semibold">Contactos operativos</p>
            <p v-if="contactsLoading" class="text-sm text-[var(--dh-text-muted)]">Consultando CRM…</p>
            <p v-else-if="contactsUnavailable" class="text-sm text-[var(--dh-text-muted)]">No se pudieron consultar los contactos.</p>
            <p v-else-if="!clientContacts.length" class="text-sm text-[var(--dh-text-muted)]">Sin contactos operativos registrados.</p>
            <div v-for="contact in clientContacts" :key="contact.id" class="border-b border-[var(--dh-border)] py-2">
              <div class="flex flex-wrap items-center gap-2"><p class="text-sm font-semibold">{{ contact.name || 'Nombre no registrado' }}</p><DhBadge v-if="contact.isPrimary" variant="neutral">Principal</DhBadge></div>
              <p v-if="contact.jobTitle" class="text-xs text-[var(--dh-text-muted)]">{{ contact.jobTitle }}</p>
              <p class="break-all text-sm">{{ contact.email || 'Sin correo' }}</p><p class="text-xs text-[var(--dh-text-muted)]">{{ contact.phone || 'Sin teléfono' }}</p>
            </div>
          </div>
        </DhCard>
        <DhCard padding="sm" title="Trámites vinculados">
          <p v-if="!selectedWorkspace?.relatedCases" class="text-sm text-[var(--dh-text-muted)]">Consulta de vínculos no disponible.</p>
          <p v-else-if="!selectedWorkspace.relatedCases.length" class="text-sm text-[var(--dh-text-muted)]">No hay otros trámites vinculados visibles.</p>
          <div v-for="item in selectedWorkspace?.relatedCases || []" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dh-border)] py-2">
            <DhButton variant="secondary" size="sm" :label="item.idtra" @click="openCase(item.id)" />
            <span class="text-xs text-[var(--dh-text-muted)]">{{ item.modalityCode }}</span><DhBadge variant="neutral">{{ operationsLabel(item.status) }}</DhBadge>
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
