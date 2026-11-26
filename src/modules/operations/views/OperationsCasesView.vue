<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { FolderOpen, RefreshCw, Plus, ArrowUpRight, Route, Package, UsersRound, FileText, CheckCircle2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect, DhInput, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhPagination, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import { operationsApi, type OperationsCaseRow, type OperationsCaseDetail, type OperationsCaseWorkspace, type CrmAccountOption } from '../services/operationsApi'
import { useOperationsCaseRealtime, useOperationsDashboardRealtime } from '../composables/useOperationsCaseRealtime'
import { useRealtimeListRefresh } from '@/core/realtime/useRealtimeListRefresh'
import { departmentStatusLabel, operationsLabel, summaryMeasure, isPendingOperationsTask } from '../utils/caseOverview'
import { openingFieldLabel, openingStatusLabel, openingStatusVariant } from '../utils/openingFieldValidation'

import { mergeCommercialOpening, useCommercialLabels, sameRevisionCommercialData, readable, useOpeningDocuments } from '../utils/commercialPresentation'

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
const clientContacts = ref<import('../services/operationsApi').OperationsContact[]>([])
const contactsUnavailable = ref(false)
const contactsLoading = ref(false)
const drawerComparison = ref<import('../services/operationsApi').OperationsQuoteComparison | null>(null)
const drawerCompleteness = ref<import('../services/operationsApi').OpeningCompleteness | null>(null)
const drawerCompletenessUnavailable = ref(false)
const drawerPendingFields = computed(() => (drawerCompleteness.value?.fields || []).filter(x => ['PENDIENTE_BLOQUEANTE', 'PENDIENTE_PERMITIDO'].includes(x.completionStatus)).sort((a, b) => Number(b.completionStatus === 'PENDIENTE_BLOQUEANTE') - Number(a.completionStatus === 'PENDIENTE_BLOQUEANTE')))
const drawerPendingTasks = computed(() => (selectedWorkspace.value?.tasks || []).filter(isPendingOperationsTask))
let drawerReadSequence = 0
async function loadCaseCommercialAndContacts(id: string, sequence: number) {
  contactsLoading.value = true
  const requestSequence = ++drawerReadSequence
  const [contacts, comparison, completeness] = await Promise.allSettled([operationsApi.caseContacts(id), operationsApi.caseQuoteComparison(id), operationsApi.openingCompleteness(id)])
  if (sequence !== detailSequence || requestSequence !== drawerReadSequence || selectedCaseId.value !== id) return
  drawerCompleteness.value = completeness.status === 'fulfilled' ? completeness.value : null
  drawerCompletenessUnavailable.value = completeness.status === 'rejected'
  clientContacts.value = contacts.status === 'fulfilled' && Array.isArray(contacts.value) ? contacts.value : []
  contactsUnavailable.value = contacts.status === 'rejected'
  drawerComparison.value = comparison.status === 'fulfilled' ? comparison.value : null
  contactsLoading.value = false
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
const { openingDocuments, downloadDocument, documentError } = useOpeningDocuments(() => opening.value.supportDocuments)
const drawerEstimatedWeight = computed(() => summaryMeasure(
  openingText('estimatedWeightValue') || openingText('quotedWeightKg') || (selected.value?.apertureType === 'AUTOMATIC' ? openingText('weightValue') : ''),
  openingText('estimatedWeightUnit') || (openingText('quotedWeightKg') ? 'KG' : openingText('weightUnit')),
))
const drawerActualWeight = computed(() => summaryMeasure(openingText('actualWeightValue'), openingText('actualWeightUnit')))
const drawerVolume = computed(() => summaryMeasure(openingText('volumeValue'), openingText('volumeUnit')))
const drawerInapplicable = computed(() => new Set((drawerCompleteness.value?.fields || []).filter(x => x.completionStatus === 'NO_APLICA').map(x => x.fieldCode)))
const openingServices = computed(() => serviceLabels(opening.value))
const openingFlags = computed(() => [
  opening.value.isImo === true ? 'IMO / peligrosa' : '',
  opening.value.overweight === true ? 'Sobrepeso' : '',
  ['LCL','LTL'].includes(openingText('shipmentType').toUpperCase()) ?
    opening.value.stackable === true ? 'Estibable' : opening.value.stackable === false ? 'No estibable' : '' : '',
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
  clientExecutiveName.value = ''
  selectedWorkspace.value = null
  clientContacts.value = []
  contactsUnavailable.value = false
  drawerComparison.value = null
  drawerCompleteness.value = null
  drawerCompletenessUnavailable.value = false
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
        <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><p class="text-[10px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">Expediente operativo</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-primary)]">{{ selected.idtra }}</p></div>
            <DhBadge :variant="selectedStage?.status === 'COMPLETED' ? 'success' : selectedStage?.status === 'PENDING' ? 'warning' : 'primary'">{{ selectedStatusLabel }}</DhBadge>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <DhBadge variant="neutral">{{ selected.apertureType === 'MANUAL' ? 'Manual' : 'Desde Pricing' }}</DhBadge>
            <DhBadge variant="primary">{{ openingText('shipmentType') || selected.modalityCode }}</DhBadge>
            <DhBadge v-if="openingText('incoterm')" variant="neutral">{{ openingText('incoterm') }}</DhBadge>
            <DhBadge v-if="openingText('transportType')" variant="neutral">{{ openingText('transportType') }}</DhBadge>
          </div>
          <div class="mt-3 grid gap-2 border-t border-[var(--dh-border)] pt-3 sm:grid-cols-2">
            <div><p class="text-xs text-[var(--dh-text-muted)]">Operativo responsable</p><p class="break-words text-sm font-semibold">{{ personName(selectedStage?.assignedUserId) }}</p><p class="text-xs text-[var(--dh-text-muted)]">{{ selectedStage?.teamName || 'Equipo por asignar' }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Servicios</p><div class="mt-1 flex flex-wrap gap-1"><DhBadge v-for="service in openingServices" :key="service" variant="neutral">{{ service }}</DhBadge><span v-if="!openingServices.length" class="text-xs text-[var(--dh-text-muted)]">Sin servicios registrados</span></div></div>
          </div>
        </div>

        <DhCard padding="sm">
          <div class="mb-3 flex items-center gap-2"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Cliente y comercial</h3></div>
          <p class="break-words text-base font-black">{{ clientName || readable(opening.clientName) || accountLabel(selected.accountId) }}</p>
          <RouterLink :to="'/crm/accounts/' + selected.accountId" class="mt-1 inline-block text-xs font-semibold text-[var(--dh-primary)] hover:underline">Consultar cliente</RouterLink>
          <div class="mt-3 grid gap-3 border-t border-[var(--dh-border)] pt-3 sm:grid-cols-2">
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Ejecutivo comercial</p><p class="mt-1 text-sm font-semibold">{{ clientExecutiveName || openingText('executiveName') || personName(selected.executiveUserId) }}</p></div>
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Cotización vinculada</p>
              <RouterLink v-if="selected.sourceQuoteId" :to="'/pricing/rates/' + (selected.sourceQuoteOptionId || selected.sourceQuoteId) + '/wizard?mode=view'" class="mt-1 inline-block text-sm font-bold text-[var(--dh-primary)]" >{{ selectedWorkspace?.quotes.find(q => q.isPrimary)?.quoteNumber || selectedWorkspace?.quotes[0]?.quoteNumber || 'Número pendiente de consulta' }}</RouterLink>
              <p v-else class="mt-1 text-sm font-semibold">Sin cotización</p></div>
            <div v-if="openingText('clientPoReference')"><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">PO / referencia</p><p class="mt-1 break-words text-sm font-semibold">{{ openingText('clientPoReference') }}</p></div>
            <div v-if="openingText('crmDivisionName')"><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">División CRM</p><p class="mt-1 break-words text-sm font-semibold">{{ openingText('crmDivisionName') }}</p></div>
            <div><p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Fecha de apertura</p><p class="mt-1 text-sm font-semibold">{{ formatDate(selected.createdAtUtc) }}</p></div>
          </div>
          <div v-if="drawerComparison?.hasSnapshot" class="mt-3">
            <DhBadge :variant="drawerComparison.severity === 'RED' ? 'danger' : drawerComparison.severity === 'YELLOW' ? 'warning' : drawerComparison.severity === 'GREEN' ? 'success' : 'neutral'">{{ drawerComparison.rows.filter(x => x.status === 'CHANGED').length }} diferencias con QUO</DhBadge>
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
            <DhBadge v-if="drawerEstimatedWeight" variant="neutral">Estimado: {{ drawerEstimatedWeight }}</DhBadge>
            <DhBadge v-if="drawerActualWeight" variant="neutral">Real: {{ drawerActualWeight }}</DhBadge>
            <DhBadge v-else-if="!drawerInapplicable.has('actualWeight')" variant="warning">Peso real pendiente</DhBadge>
            <span v-if="openingText('cabysCode')" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">CABYS {{ openingText('cabysCode') }}</span>
            <span v-if="openingText('packageCount')" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">{{ openingText('packageCount') }} {{ openingText('packageType') || 'bultos' }}</span>
            <DhBadge v-if="drawerVolume" variant="neutral">{{ drawerVolume }}</DhBadge>
            <span v-for="(item, i) in openingEquipment" :key="i" class="rounded-lg border border-[var(--dh-primary)]/25 px-2.5 py-1 text-xs font-bold">{{ item.quantity }} × {{ item.label }}</span>
          </div>
          <div v-if="openingFlags.length" class="mt-3 flex flex-wrap gap-2 border-t border-[var(--dh-border)] pt-3"><DhBadge v-for="flag in openingFlags" :key="flag" variant="neutral">{{ flag }}</DhBadge></div>
          <div class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <div class="flex items-center gap-2"><FileText class="h-4 w-4 text-[var(--dh-primary)]" /><p class="text-xs font-black">Documentos ({{ openingDocuments.length }})</p></div>
            <p v-if="!openingDocuments.length" class="mt-1 text-xs text-[var(--dh-text-muted)]">Sin documentos registrados.</p>
            <div v-else class="mt-2 space-y-1.5">
              <div v-for="doc in openingDocuments" :key="doc.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--dh-input)] p-2 text-xs">
                <span class="break-words"><strong>{{ doc.label }}</strong> · {{ doc.fileName }}</span>
                <DhButton v-if="doc.storageId" size="sm" variant="secondary" label="Descargar" @click="downloadDocument(doc)" />
              </div>
              <p v-if="documentError" role="alert" class="text-xs text-[var(--dh-text-muted)]">{{ documentError }}</p>
            </div>
          </div>
        </DhCard>

        <DhCard padding="sm" title="Validación y pendientes">
          <p v-if="drawerCompletenessUnavailable" class="text-xs text-[var(--dh-text-muted)]">No se pudo consultar la validación.</p>
          <p v-else-if="!drawerCompleteness" class="text-xs text-[var(--dh-text-muted)]">Consultando validación…</p>
          <template v-else>
            <div class="flex flex-wrap gap-2">
              <DhBadge :variant="drawerCompleteness.missingFields.length ? 'danger' : 'success'">{{ drawerCompleteness.missingFields.length ? drawerCompleteness.missingFields.length + ' bloqueantes' : 'Sin campos bloqueantes' }}</DhBadge>
              <DhBadge variant="neutral">{{ drawerPendingFields.filter(x => x.completionStatus === 'PENDIENTE_PERMITIDO').length }} pendientes permitidos</DhBadge>
            </div>
            <div v-if="drawerPendingFields.length" class="mt-2 space-y-1">
              <div v-for="field in drawerPendingFields.slice(0, 5)" :key="field.fieldCode" class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dh-border)] py-2">
                <span class="text-xs font-medium">{{ openingFieldLabel(field.fieldCode) }}</span><DhBadge :variant="openingStatusVariant(field.completionStatus)">{{ openingStatusLabel(field.completionStatus) }}</DhBadge>
              </div>
              <p v-if="drawerPendingFields.length > 5" class="text-xs text-[var(--dh-text-muted)]">+{{ drawerPendingFields.length - 5 }} campos en el expediente completo.</p>
            </div>
          </template>
          <div class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="text-xs font-bold">Tareas pendientes ({{ drawerPendingTasks.length }})</p>
            <p v-for="task in drawerPendingTasks.slice(0, 3)" :key="task.id" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ task.title }}</p>
            <p v-if="drawerPendingTasks.length > 3" class="text-xs text-[var(--dh-text-muted)]">Ver todas en el expediente.</p>
          </div>
        </DhCard>
        <DhCard padding="sm" title="Contactos del cliente">
          <p v-if="contactsLoading" class="text-xs text-[var(--dh-text-muted)]">Consultando CRM…</p>
          <p v-else-if="contactsUnavailable" class="text-xs text-[var(--dh-text-muted)]">No se pudieron consultar los contactos de CRM.</p>
          <p v-else-if="!clientContacts.length" class="text-xs text-[var(--dh-text-muted)]">Sin contactos operativos activos registrados.</p>
          <div v-for="contact in clientContacts" :key="contact.id" class="border-b border-[var(--dh-border)] py-2">
            <p class="text-sm font-semibold">{{ contact.name || 'Nombre no registrado' }}</p>
            <p class="break-all text-xs">{{ contact.email || 'Correo no registrado' }}</p>
            <p class="text-xs text-[var(--dh-text-muted)]">{{ contact.phone || 'Teléfono no registrado' }}</p>
          </div>
        </DhCard>
        <DhCard padding="sm">
          <div class="mb-3 flex items-center gap-2"><CheckCircle2 class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Responsables y validación</h3></div>
          <div v-if="selectedWorkspace?.stages.length" class="space-y-2">
            <div v-for="stage in selectedWorkspace.stages" :key="stage.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--dh-input)]/45 p-3">
              <div class="min-w-0"><p class="text-xs font-bold">{{ formatStatus(stage.departmentCode) }}</p><p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ stage.teamName || 'Equipo por asignar' }}</p>
                <p v-if="stage.departmentCode !== 'APERTURAS'" class="mt-1 text-xs font-semibold">Operativo: {{ personName(stage.assignedUserId) }}</p>
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
            ].filter(item => !drawerInapplicable.has(({ Recolecta: 'pickupAddress', WHS: 'whsName', Entrega: 'destinationAddress', Naviera: 'carrierReference', Consolidado: 'consolidation', Merchant: 'merchantReference' } as Record<string, string>)[item.label] || ''))" :key="item.label" class="min-w-0">
              <p class="text-xs text-[var(--dh-text-muted)]">{{ item.label }}</p>
              <p class="mt-0.5 break-words text-sm font-semibold">{{ item.value || 'Por confirmar' }}</p>
            </div>
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
