<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeft, RefreshCw, Pencil, Save, FolderOpen, ClipboardList,
  FileText, LockKeyhole, MessageSquareText, Plus, Layers3,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhTabs, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import {
  operationsApi, type OperationsCaseDetail, type OperationsCaseWorkspace,
  type OperationsCaseCost, type OperationsSnapshotCost, type OperationsCaseTab, type OperationsTabCode,
  type OperationsTabLevel, type OperationsAudit, type OperationsUser,
  type OperationsInternalNote, type OperationsOriginProgress,
  type OperationsOpeningEdit, type OperationsServiceReviewDashboard,
} from '../services/operationsApi'
import OperationsAuditTimeline from '../components/OperationsAuditTimeline.vue'
import OperationsApertureValidationPanel from '../components/OperationsApertureValidationPanel.vue'
import { useOperationsCaseRealtime } from '../composables/useOperationsCaseRealtime'
import { departmentStatusLabel, operationsLabel } from '../utils/caseOverview'

import { mergeCommercialOpening, useCommercialLabels, sameRevisionCommercialData, readable, countryLabel } from '../utils/commercialPresentation'

const route = useRoute()
const { openingField, currency } = useCommercialLabels()
const supplemental = ref<Record<string, unknown>>({})
const auth = useAuthStore()
const caseId = computed(() => String(route.params.id ?? ''))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const record = ref<OperationsCaseDetail | null>(null)
const openingData = computed<Record<string, unknown>>(() => {
  try {
    const value = JSON.parse(record.value?.openingDataJson || '{}') as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? mergeCommercialOpening(value as Record<string, unknown>, workspace.value?.commercialData, supplemental.value) : {}
  } catch { return {} }
})
const openingSections = computed(() => {
  const data = openingData.value
  const sections: Array<{ title: string; rows: Array<{ label: string; key: string }> }> = [
    { title: 'Ruta y transporte', rows: [
      { label: 'Tipo de embarque', key: 'shipmentType' },
      { label: 'Transporte', key: 'transportType' },
      { label: 'Incoterm', key: 'incoterm' },
      { label: 'POL · Salida', key: 'pol' },
      { label: 'POE · Entrada', key: 'poe' },
      { label: 'POD · Destino', key: 'pod' },
      { label: 'ETD', key: 'etm' }, { label: 'ETA', key: 'eta' },
      { label: 'Operación', key: 'provenance' }, { label: 'Tránsito cotizado', key: 'transitTime' },
      { label: 'Días libres cotizados', key: 'freeDays' }, { label: 'Referencias de QUO', key: 'quoteReferences' },
      { label: 'Válida desde', key: 'validFrom' }, { label: 'Válida hasta', key: 'validTo' },
    ] },
    { title: 'Mercancía', rows: [
      { label: 'Descripción', key: 'cargoDescription' },
      { label: 'CABYS', key: 'cabysCode' },
      { label: 'Naturaleza de carga', key: 'cargoNature' },
      { label: 'Bultos', key: 'packageCount' },
      { label: 'Tipo de bulto', key: 'packageType' },
      { label: 'Peso', key: 'weightValue' },
      { label: 'Unidad de peso', key: 'weightUnit' },
      { label: 'Volumen', key: 'volumeValue' },
      { label: 'Unidad de volumen', key: 'volumeUnit' },
    ] },
    { title: 'Coordinación y proveedores', rows: [
      { label: 'Consolidado', key: 'consolidationReference' },
      { label: 'Dirección de recolecta', key: 'pickupAddress' },
      { label: 'WHS', key: 'whsName' },
      { label: 'Dirección de entrega', key: 'destinationAddress' },
      { label: 'Naviera', key: 'carrierReference' },
      { label: 'Agente', key: 'agentReference' },
      { label: 'Merchant', key: 'merchantReference' },
      { label: 'Observaciones', key: 'observations' },
    ] },
  ]
  return sections.map(section => ({
    title: section.title,
    rows: section.rows.map(row => {
      const value = openingField(row.key, data)
      return { label: row.label, value: value || (
        row.key === 'weightValue' ? 'Pendiente de Coordinación Origen' : 'Por confirmar'
      ) }
    }),
  }))
})

const workspace = ref<OperationsCaseWorkspace | null>(null)
const access = ref<OperationsCaseTab[]>([])
const costs = ref<OperationsCaseCost[]>([])
const snapshotCosts = ref<OperationsSnapshotCost[]>([])
const costError = ref(false)
const costRows = computed(() => snapshotCosts.value.length ? snapshotCosts.value : costs.value.map(cost => ({ ...cost, currencyName: null, quantity: null, unitCost: null })))
function amountLabel(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : 'Por confirmar'
}
const costColumns = computed<DhTableColumn<(typeof costRows.value)[number]>[]>(() => [
  { key: 'description', label: 'Rubro' },
  { key: 'quantity', label: 'Cantidad', align: 'right' },
  { key: 'unitCost', label: 'Costo unitario', align: 'right' },
  { key: 'supplierName', label: 'Proveedor' },
  { key: 'currencyCode', label: 'Moneda' },
  { key: 'costAmount', label: 'Costo', align: 'right' },
  ...(auth.hasScope('operations.finance.manage') ? [{ key: 'saleAmount' as const, label: 'Venta', align: 'right' as const }] : []),
])
const missingCostProviders = computed(() => costRows.value.filter(cost => !readable(cost.supplierName)).length)
const commercialReviews = ref<OperationsServiceReviewDashboard | null>(null)
const newService = ref({ serviceCode: '', serviceName: '', reason: '' })
const addingService = ref(false)
const addServiceKey = ref(crypto.randomUUID())
const pendingCommercialAlerts = computed(() =>
  commercialReviews.value?.alerts.filter(x =>
    x.severity !== 'GREEN' && x.status !== 'RESOLVED') ?? [])
const origin = ref<OperationsOriginProgress | null>(null)
const notes = ref<OperationsInternalNote[]>([])
const noteText = ref('')
const originStatus = ref('ORIGIN_COORDINATION')
const savingOrigin = ref(false)
const originStatusChoices = computed(() => {
  switch (record.value?.modalityCode) {
    case 'FCL': case 'LCL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      { label: 'Booking listo', value: 'BOOKING_READY' },
      { label: 'Carga en puerto de salida', value: 'PORT_OF_LOADING' },
    ]
    case 'AIR': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      { label: 'Carga WHS Origen', value: 'ORIGIN_WAREHOUSE' },
      { label: 'Carga en aeropuerto salida', value: 'DEPARTURE_AIRPORT' },
    ]
    case 'FTL': case 'MULTIMODAL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      { label: 'Preparando envío', value: 'PREPARING_DISPATCH' },
    ]
    case 'LTL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      { label: 'Carga WHS Origen', value: 'ORIGIN_WAREHOUSE' },
      { label: 'Preparando envío', value: 'PREPARING_DISPATCH' },
    ]
    default: return [{ label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' }]
  }
})
const postingNote = ref(false)
const audit = ref<OperationsAudit[]>([])
const actors = ref<OperationsUser[]>([])
const accountName = ref('')
const clientExecutiveName = ref('')
const responsibleNames = ref<Record<string, string>>({})
const currentResponsibility = computed(() => workspace.value?.stages.find(s =>
  s.status === 'IN_PROGRESS') || workspace.value?.stages.find(s =>
  s.status === 'READY') || workspace.value?.stages.find(s => !['COMPLETED', 'SKIPPED'].includes(s.status)) || workspace.value?.stages[0])
const currentDepartmentStatus = computed(() => departmentStatusLabel(
  currentResponsibility.value?.departmentCode, currentResponsibility.value?.status,
  record.value?.status,
  currentResponsibility.value?.departmentCode === 'COORDINACION_ORIGEN'
    ? origin.value?.progress?.statusCode : null,
))
function responsibleName(id: string | null | undefined): string {
  return id ? responsibleNames.value[id] || 'Nombre pendiente de consulta' : 'Sin operativo asignado'
}
const openingDocuments = computed(() => Array.isArray(openingData.value.supportDocuments)
  ? (openingData.value.supportDocuments as Array<Record<string, unknown>>) : [])
const pendingFields = computed(() => Array.isArray(openingData.value.missingFields)
  ? (openingData.value.missingFields as unknown[]).filter((x): x is string => typeof x === 'string') : [])
const openingServices = computed(() => Array.isArray(openingData.value.services)
  ? (openingData.value.services as unknown[]).map(x => typeof x === 'string' ? x :
      x && typeof x === 'object' ? String((x as Record<string, unknown>).name ||
        (x as Record<string, unknown>).label || '') : '').filter(Boolean) : [])
async function loadResponsibleNames(ids: Array<string | null | undefined>, current: number) {
  const uniques = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  if (!uniques.length || !auth.hasScope('operations.audit.read')) return
  try {
    const found = await operationsApi.auditActors(uniques)
    if (current === sequence) responsibleNames.value = {
      ...responsibleNames.value,
      ...Object.fromEntries(found.items.map(p => [p.id, p.displayName || p.userName])),
    }
  } catch { /* A missing Auth display name must not hide the expediente. */ }
}
const selectedTab = ref<OperationsTabCode>('RESUMEN')
const editing = ref(false)
const serverChangedWhileEditing = ref(false)
const edit = ref<OperationsOpeningEdit>({
  expectedVersion: 0, modalityCode: 'FCL', priority: 1,
  complexityPoints: 1, originCountryCode: null, destinationCountryCode: null,
})
const tabs: Array<{ code: OperationsTabCode; label: string }> = [
  { code: 'RESUMEN', label: 'Resumen' },
  { code: 'QUO', label: 'QUO' },
  { code: 'COORDINACION_ORIGEN', label: 'Coordinación Origen' },
  { code: 'DOCUMENTACION', label: 'Documentación' },
  { code: 'TRANSITO', label: 'Tránsito' },
  { code: 'PANAMA', label: 'Panamá' },
  { code: 'COSTA_RICA', label: 'Costa Rica' },
  { code: 'FINANZAS', label: 'Finanzas' },
]
const modalityOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const level = (code: OperationsTabCode): OperationsTabLevel =>
  access.value.find(tab => tab.code === code)?.accessLevel ?? 'LOCKED'
const caseTabItems = computed(() => tabs.map(tab => ({
  key: tab.code,
  label: tab.label,
  disabled: level(tab.code) === 'LOCKED' || level(tab.code) === 'NOT_APPLICABLE',
  title: level(tab.code) === 'EDITABLE' ? 'Editable según permisos' : level(tab.code) === 'READ_ONLY' ? 'Solo lectura' : level(tab.code) === 'NOT_APPLICABLE' ? 'No aplica' : 'Aún no habilitado',
})))
function selectCaseTab(key: string) {
  const tab = tabs.find(item => item.code === key)
  if (!tab || level(tab.code) === 'LOCKED' || level(tab.code) === 'NOT_APPLICABLE') return
  selectedTab.value = tab.code
  editing.value = false
}
const canEditSummary = computed(() => level('RESUMEN') === 'EDITABLE')
const canAddService = computed(() =>
  (level('RESUMEN') === 'EDITABLE' ||
    level('COORDINACION_ORIGEN') === 'EDITABLE') &&
  (auth.hasScope('operations.case.update') ||
    auth.hasScope('operations.origin.update') ||
    auth.hasScope('operations.aperture.update')))
const validNewService = computed(() =>
  /^[A-Za-z0-9_.-]{1,60}$/.test(newService.value.serviceCode.trim()) &&
  newService.value.serviceName.trim().length > 0 &&
  newService.value.serviceName.trim().length <= 200 &&
  newService.value.reason.trim().length >= 10 &&
  newService.value.reason.trim().length <= 2000)

const currentStage = computed(() =>
  workspace.value?.stages.find(s => s.departmentCode === selectedTab.value))
const currentTasks = computed(() =>
  workspace.value?.tasks.filter(t => currentStage.value && t.caseStageId === currentStage.value.id) ?? [])
const currentMilestones = computed(() =>
  workspace.value?.milestones.filter(m => currentStage.value && m.caseStageId === currentStage.value.id) ?? [])
const canWriteNote = computed(() =>
  level('COORDINACION_ORIGEN') === 'EDITABLE' &&
  auth.hasScope('operations.internal-note.create'))
const isoValid = (code: string | null) => !code?.trim() || /^[A-Z]{2}$/i.test(code.trim())
const validEdit = computed(() => (
  edit.value.modalityCode &&
  edit.value.priority >= 1 && edit.value.priority <= 5 &&
  Number.isInteger(edit.value.priority) &&
  edit.value.complexityPoints >= 0.5 && edit.value.complexityPoints <= 1000 &&
  isoValid(edit.value.originCountryCode) && isoValid(edit.value.destinationCountryCode)
))
function statusLabel(value: string | null | undefined) {
  return operationsLabel(value)
}
function dateLabel(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CR')
}
function captureEdit(detail: OperationsCaseDetail) {
  edit.value = {
    expectedVersion: detail.version, modalityCode: detail.modalityCode,
    priority: detail.priority, complexityPoints: detail.complexityPoints,
    originCountryCode: detail.originCountryCode,
    destinationCountryCode: detail.destinationCountryCode,
  }
}
let sequence = 0
async function load() {
  if (!caseId.value) return
  const current = ++sequence
  loading.value = true
  error.value = ''
  message.value = ''
  editing.value = false
  serverChangedWhileEditing.value = false
  try {
    const [detail, work, tabResponse] = await Promise.all([
      operationsApi.caseDetail(caseId.value),
      operationsApi.caseWorkspace(caseId.value),
      operationsApi.caseTabs(caseId.value),
    ])
    if (current !== sequence) return
    record.value = detail
    workspace.value = work
    access.value = tabResponse.tabs
    captureEdit(detail)
    if (level(selectedTab.value) === 'LOCKED' || level(selectedTab.value) === 'NOT_APPLICABLE')
      selectedTab.value = 'RESUMEN'

    // Optional reads are scoped individually; an unauthorized panel must not
    // prevent opening the whole expediente.
    const optional: Promise<unknown>[] = []
    costs.value = []
    snapshotCosts.value = []
    costError.value = false
    supplemental.value = {}
    optional.push(sameRevisionCommercialData(work).then(x => { if (current === sequence) supplemental.value = x }))
    commercialReviews.value = null
    origin.value = null
    notes.value = []
    audit.value = []
    actors.value = []
    accountName.value = ''
    clientExecutiveName.value = ''
    responsibleNames.value = { ...(work.people || {}) }
    optional.push(loadResponsibleNames([
      detail.createdBy, detail.executiveUserId,
      ...work.stages.map(s => s.assignedUserId),
      ...work.stages.flatMap(s => s.supervisorUserIds || []),
      ...(work.validators || []).map(v => v.userId),
      ...work.tasks.map(t => t.assignedUserId),
    ], current))
    optional.push(operationsApi.caseServicesAndReviews(caseId.value)
      .then(x => { if (current === sequence) commercialReviews.value = x })
      .catch(() => { /* Commercial panel has its own scope; no fake success. */ }))
    if (auth.hasScope('operations.cost.read')) optional.push(
      operationsApi.caseCosts(caseId.value).then(x => { if (current === sequence) { costs.value = x.items; snapshotCosts.value = x.snapshotItems || [] } }).catch(() => { if (current === sequence) costError.value = true }))
    if (auth.hasScope('operations.origin.read') &&
        work.stages.some(s => s.departmentCode === 'COORDINACION_ORIGEN')) optional.push(
      operationsApi.caseOriginProgress(caseId.value).then(x => { if (current === sequence) { origin.value = x; originStatus.value = x.progress?.statusCode || 'ORIGIN_COORDINATION' } }).catch(() => {}))
    if (auth.hasScope('operations.internal-note.read') &&
        work.stages.some(s => s.departmentCode === 'COORDINACION_ORIGEN')) optional.push(
      operationsApi.caseInternalNotes(caseId.value).then(x => { if (current === sequence) notes.value = x }).catch(() => {}))
    if (auth.hasScope('operations.audit.read')) optional.push(
      operationsApi.caseAudit(caseId.value).then(async x => {
        if (current !== sequence) return
        audit.value = x
        const people = await operationsApi.auditActors(x.map(e => e.actorUserId))
        if (current === sequence) actors.value = people.items
      }).catch(() => {}))
    optional.push(crmRequest<Record<string, unknown>>(crmPath('accounts', detail.accountId))
      .then(x => { if (current === sequence) {
        accountName.value = String(x.displayName || x.legalName || x.name || '').trim()
        clientExecutiveName.value = String(x.executiveName || '').trim()
      } }).catch(() => {}))
    optional.push(crmRequest<{ displayName?: string | null }>(
      crmPath('accounts', detail.accountId, 'assigned-executive'))
      .then(x => { if (current === sequence && x.displayName)
        clientExecutiveName.value = x.displayName.trim()
      }).catch(() => {}))
    await Promise.all(optional)
  } catch (cause) {
    if (current === sequence) {
      record.value = null
      workspace.value = null
      access.value = []
      commercialReviews.value = null
      error.value = cause instanceof Error ? cause.message : 'No se pudo abrir el expediente.'
    }
  } finally { if (current === sequence) loading.value = false }
}
async function saveEdit() {
  if (!record.value || !canEditSummary.value || !validEdit.value || saving.value) return
  if (serverChangedWhileEditing.value) { error.value = 'Primero recargue los cambios realizados por otro usuario.'; return }
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    await operationsApi.updateCase(record.value.id, {
      ...edit.value,
      originCountryCode: edit.value.originCountryCode?.trim().toUpperCase() || null,
      destinationCountryCode: edit.value.destinationCountryCode?.trim().toUpperCase() || null,
    })
    await load()
    message.value = 'Cambios de Aperturas guardados y auditados correctamente.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo actualizar el expediente. Actualice antes de volver a intentarlo.'
  } finally { saving.value = false }
}
async function saveOriginStatus() {
  if (!record.value || !origin.value || level('COORDINACION_ORIGEN') !== 'EDITABLE' || savingOrigin.value) return
  savingOrigin.value = true
  error.value = ''
  try {
    await operationsApi.updateOriginStatus(record.value.id, originStatus.value, origin.value.progress?.version ?? 0)
    await load()
    message.value = 'Estado de Coordinación Origen actualizado y auditado.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar el estado de Origen.'
  } finally { savingOrigin.value = false }
}
async function addOperationalService() {
  if (!record.value || !canAddService.value || !validNewService.value || addingService.value) return
  addingService.value = true
  error.value = ''
  try {
    await operationsApi.addCaseService(record.value.id, {
      idempotencyKey: addServiceKey.value,
      serviceCode: newService.value.serviceCode.trim().toUpperCase(),
      serviceName: newService.value.serviceName.trim(),
      reason: newService.value.reason.trim(),
    })
    newService.value = { serviceCode: '', serviceName: '', reason: '' }
    addServiceKey.value = crypto.randomUUID()
    await load()
    message.value = 'Servicio añadido. Se generó una alerta amarilla y una solicitud de revisión para Pricing.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message :
      'No se pudo registrar el servicio adicional. El motivo y los datos se conservaron.'
  } finally {
    addingService.value = false
  }
}
async function addNote() {
  if (!record.value || !canWriteNote.value || !noteText.value.trim() || postingNote.value) return
  postingNote.value = true
  error.value = ''
  try {
    await operationsApi.addCaseInternalNote(record.value.id, noteText.value.trim())
    notes.value = await operationsApi.caseInternalNotes(record.value.id)
    noteText.value = ''
    message.value = 'Nota privada registrada.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la nota.'
  } finally { postingNote.value = false }
}
useOperationsCaseRealtime(caseId, () => {
  if (editing.value || saving.value) {
    serverChangedWhileEditing.value = true
    return
  }
  void load()
})
watch([caseId, () => auth.userId], () => { record.value = null; workspace.value = null; selectedTab.value = 'RESUMEN'; void load() }, { immediate: true })
</script>

<template>
  <div class="mx-auto w-full max-w-[1700px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <div class="flex items-center">
      <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-sm font-bold text-[var(--dh-primary)] hover:underline">
        <ArrowLeft class="h-4 w-4" /> Todos los trámites
      </RouterLink>
    </div>
    <DhPageHeader :title="record?.idtra || 'Expediente operativo'" subtitle="Expediente IDTRA único · Gestión por departamentos y equipos" :icon="FolderOpen" :hide-excel-export="true">
      <template #actions>
        <DhBadge v-if="record" variant="primary">{{ currentDepartmentStatus }}</DhBadge>
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <RouterLink v-if="record && canEditSummary && selectedTab === 'RESUMEN'" :to="{ name: 'operations-case-edit', params: { id: record.id } }">
          <DhButton :icon="Pencil" label="Completar o modificar apertura" />
        </RouterLink>
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>
    <div v-if="serverChangedWhileEditing" role="alert" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
      Otro usuario modificó el trámite. Actualice para revisar la nueva versión antes de guardar.
      <DhButton size="sm" variant="secondary" label="Recargar" @click="serverChangedWhileEditing = false; load()" />
    </div>
    <div v-if="message" role="status" class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{{ message }}</div>
    <div v-if="pendingCommercialAlerts.length" role="alert" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
      <strong>Revisión comercial pendiente:</strong> {{ pendingCommercialAlerts.length }} servicio(s) o diferencia(s) requieren seguimiento en Pricing.
      <span class="ml-2">La QUO original permanece sin modificaciones.</span>
    </div>
    <div v-if="loading" class="rounded-2xl bg-[var(--dh-input)] p-8 text-center text-[var(--dh-text-muted)]">Cargando expediente operativo…</div>

    <template v-if="record && workspace && !loading">
      <DhCard padding="sm"><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Cliente</p>
          <p class="mt-1 break-words font-bold">{{ accountName || String(openingData.clientName || '') || 'Nombre pendiente de CRM' }}</p>
          <p class="mt-1 break-words text-xs text-[var(--dh-text-muted)]">Ejecutivo: {{ clientExecutiveName || String(openingData.executiveName || '') || responsibleName(record.executiveUserId) }}</p>
          <RouterLink :to="`/crm/accounts/${record.accountId}`" class="text-xs text-[var(--dh-primary)] hover:underline">Consultar cuenta CRM</RouterLink>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Ruta y procedencia</p>
          <p class="mt-1 font-bold">{{ record.apertureType === 'AUTOMATIC' ? 'Pricing · QUO aceptada' : 'Manual' }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">{{ record.modalityCode }} · {{ openingData.pol || countryLabel(record.originCountryCode, openingData.pol) || 'Pendiente' }} → {{ openingData.pod || countryLabel(record.destinationCountryCode, openingData.pod) || 'Pendiente' }}</p>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Departamento y responsable</p>
          <p class="mt-1 font-bold">{{ statusLabel(currentResponsibility?.departmentCode) }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ currentResponsibility?.teamName || 'Equipo por asignar' }}</p>
          <p class="mt-1 text-xs font-semibold">{{ responsibleName(currentResponsibility?.assignedUserId) }}</p>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Estado departamental</p>
          <p class="mt-1 font-bold">{{ currentDepartmentStatus }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Actualizado: {{ dateLabel(record.updatedAtUtc) }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">Versión {{ record.version }}</p>
        </div>
      </div></DhCard>

      <OperationsApertureValidationPanel
        v-if="record.apertureType === 'AUTOMATIC' && (record.status === 'PENDING_VALIDATION' || record.status === 'APERTURA_REQUIERE_CAMBIOS')"
        :case-id="record.id"
        @updated="load"
      />
      <DhTabs :model-value="selectedTab" :items="caseTabItems" aria-label="Departamentos del expediente" @update:model-value="selectCaseTab">
        <template #label="{ item }">
          <span class="inline-flex items-center gap-2">
            <LockKeyhole v-if="level(item.key as OperationsTabCode) === 'LOCKED'" class="h-3.5 w-3.5" />
            {{ item.label }}
            <span v-if="level(item.key as OperationsTabCode) === 'NOT_APPLICABLE'" class="text-xs">N/A</span>
          </span>
        </template>
      </DhTabs>

      <div v-if="selectedTab === 'RESUMEN'" class="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div class="space-y-4">
          <DhCard padding="sm" :icon="ClipboardList" title="Identificación y apertura">
            <div v-if="editing && canEditSummary" class="space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <DhSelect v-model="edit.modalityCode" label="Modalidad" :options="modalityOptions" />
                <DhInput :model-value="edit.priority" type="number" label="Prioridad" :min="1" :max="5" :step="1" @update:model-value="edit.priority = Number($event)" />
                <DhInput :model-value="edit.complexityPoints" type="number" label="Complejidad" :min="0.5" :max="1000" :step="0.5" @update:model-value="edit.complexityPoints = Number($event)" />
                <DhInput v-model="edit.originCountryCode" label="País de origen (ISO)" placeholder="CR" />
                <DhInput v-model="edit.destinationCountryCode" label="País de destino (ISO)" placeholder="HN" />
              </div>
              <p class="text-xs text-[var(--dh-text-muted)]">Los cambios se auditan y requieren la versión vigente. Cliente, ejecutivo y QUO aceptada no se modifican desde este formulario.</p>
              <div class="flex justify-end gap-2">
                <DhButton variant="secondary" label="Cancelar" @click="editing = false; captureEdit(record)" />
                <DhButton :icon="Save" label="Guardar cambios" :loading="saving" :disabled="!validEdit" @click="saveEdit" />
              </div>
            </div>
            <div v-else class="grid gap-x-5 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
              <div v-for="item in [
                { key: 'IDTRA', value: record.idtra },
                { key: 'Modalidad', value: record.modalityCode },
                { key: 'Tipo de apertura', value: record.apertureType === 'AUTOMATIC' ? 'Automática · Pricing' : 'Manual' },
                { key: 'Estado del departamento', value: currentDepartmentStatus },
                { key: 'Cliente', value: accountName || String(openingData.clientName || '') || 'Pendiente de CRM' },
                { key: 'Ejecutivo comercial', value: clientExecutiveName || String(openingData.executiveName || '') || responsibleName(record.executiveUserId) },
                { key: 'PO / referencia cliente', value: openingData.clientPoReference || 'Sin referencia' },
                { key: 'División CRM', value: openingData.crmDivisionName || 'No registrada' },
                { key: 'País de origen', value: countryLabel(record.originCountryCode, openingData.pol) || 'Pendiente' },
                { key: 'País de destino', value: countryLabel(record.destinationCountryCode, openingData.pod) || 'Pendiente' },
                { key: 'Prioridad', value: record.priority },
                { key: 'Complejidad', value: record.complexityPoints },
                { key: 'Creado', value: dateLabel(record.createdAtUtc) },
                { key: 'Actualizado', value: dateLabel(record.updatedAtUtc) },
                { key: 'Creado por', value: responsibleName(record.createdBy) },
              ]" :key="item.key" class="min-w-0 border-b border-[var(--dh-border)] py-2">
                <p class="text-xs text-[var(--dh-text-muted)]">{{ item.key }}</p>
                <p class="mt-1 break-words text-sm font-bold">{{ item.value }}</p>
              </div>
            </div>
          </DhCard>
          <DhCard title="Departamentos y responsables" subtitle="Etapas, equipos, operativos y validadores del expediente.">
            <div v-for="stage in workspace.stages" :key="stage.id" class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3 last:mb-0">
              <div>
                <p class="text-sm font-bold">{{ statusLabel(stage.departmentCode) }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">Equipo: {{ stage.teamName || 'Por asignar' }}</p>
                <p v-if="stage.departmentCode !== 'APERTURAS'" class="mt-1 text-xs font-semibold">Operativo: {{ responsibleName(stage.assignedUserId) }}</p>
                <p v-if="stage.supervisorUserIds?.length" class="mt-1 text-xs text-[var(--dh-text-soft)]">
                  Supervisión: {{ stage.supervisorUserIds.map(id => responsibleName(id)).join(', ') }}
                </p>
                <p v-if="stage.assignedAtUtc" class="mt-1 text-xs text-[var(--dh-text-muted)]">Asignación: {{ dateLabel(stage.assignedAtUtc) }}</p>
                <p v-for="reviewer in (workspace.validators || []).filter(v => v.caseStageId === stage.id)"
                  :key="reviewer.userId" class="mt-1 text-xs text-[var(--dh-text-soft)]">
                  Validador {{ reviewer.slot }}: {{ responsibleName(reviewer.userId) }} · {{ statusLabel(reviewer.status) }}
                  <span v-if="reviewer.reviewedAtUtc">· {{ dateLabel(reviewer.reviewedAtUtc) }}</span>
                </p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Inicio: {{ dateLabel(stage.startedAtUtc) }} · Finalización: {{ dateLabel(stage.completedAtUtc) }}</p>
              </div>
              <DhBadge variant="neutral">{{ departmentStatusLabel(stage.departmentCode, stage.status, record.status, stage.departmentCode === 'COORDINACION_ORIGEN' ? origin?.progress?.statusCode : null) }}</DhBadge>
            </div>
            <p v-if="!workspace.stages.length" class="text-sm text-[var(--dh-text-muted)]">No hay departamentos asignados.</p>
          </DhCard>
          <DhCard padding="sm" title="Ficha de apertura y mercancía">
            <div class="space-y-5">
              <section v-for="section in openingSections" :key="section.title">
                <h4 class="mb-2 text-sm font-bold">{{ section.title }}</h4>
                <div class="grid gap-x-5 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
                  <div v-for="field in section.rows" :key="field.label" class="min-w-0 border-b border-[var(--dh-border)] py-2">
                    <p class="text-xs text-[var(--dh-text-muted)]">{{ field.label }}</p>
                    <p class="mt-1 break-words text-sm font-semibold">{{ field.value }}</p>
                  </div>
                </div>
              </section>
            </div>
            <div v-if="Array.isArray(openingData.equipment) && openingData.equipment.length" class="mt-4">
              <h4 class="mb-2 text-sm font-semibold">Equipos</h4>
              <div v-for="(item, index) in openingData.equipment" :key="index" class="mb-1 rounded-lg bg-[var(--dh-input)] px-3 py-2 text-sm">
                {{ (item as { quantity: number; equipmentType: string }).quantity }} × {{ (item as { equipmentType: string }).equipmentType }}
              </div>
            </div>
            <div v-if="openingServices.length" class="mt-4 border-t border-[var(--dh-border)] pt-3">
              <h4 class="mb-2 text-sm font-semibold">Servicios contratados y operativos</h4>
              <div class="flex flex-wrap gap-2"><DhBadge v-for="service in openingServices" :key="service" variant="neutral">{{ service }}</DhBadge></div>
            </div>
            <div class="mt-4 border-t border-[var(--dh-border)] pt-3">
              <h4 class="mb-2 text-sm font-semibold">Documentación ({{ openingDocuments.length }})</h4>
              <p v-if="!openingDocuments.length" class="text-xs text-[var(--dh-text-muted)]">Sin adjuntos de apertura.</p>
              <p v-for="(document, index) in openingDocuments" :key="index" class="mb-1 break-words text-xs">
                {{ String(document.label || 'Documento') }} · {{ String(document.fileName || 'Archivo registrado') }}
              </p>
            </div>
            <div v-if="pendingFields.length || openingData.completionStatus === 'DRAFT_INCOMPLETE'" class="mt-4 border-t border-[var(--dh-border)] pt-3">
              <h4 class="mb-2 text-sm font-semibold">Información por completar</h4>
              <p v-for="field in pendingFields" :key="field" class="text-xs text-[var(--dh-text-muted)]">{{ statusLabel(field) }}</p>
              <p v-if="!pendingFields.length" class="text-xs text-[var(--dh-text-muted)]">Hay campos sin confirmar antes de validar.</p>
            </div>
          </DhCard>
        </div>
        <div class="space-y-4">
          <DhCard title="Pendientes del expediente">
            <div v-for="task in workspace.tasks" :key="task.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3 text-sm last:mb-0">
              <p class="font-bold">{{ task.title }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ statusLabel(task.status) }} · {{ dateLabel(task.dueAtUtc) }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">Responsable: {{ responsibleName(task.assignedUserId) }}</p>
            </div>
            <p v-if="!workspace.tasks.length" class="text-sm text-[var(--dh-text-muted)]">No hay tareas registradas.</p>
          </DhCard>
          <DhCard padding="sm" title="Cotización y seguimiento comercial">
            <RouterLink v-if="record.sourceQuoteId" :to="`/pricing/rates/${record.sourceQuoteOptionId || record.sourceQuoteId}/wizard?mode=view`" class="font-bold text-[var(--dh-primary)] hover:underline">{{ workspace.quotes.find(quote => quote.isPrimary)?.quoteNumber || workspace.quotes[0]?.quoteNumber || 'Abrir QUO en Pricing' }}</RouterLink>
            <p v-else class="text-sm text-[var(--dh-text-muted)]">Sin cotización · Apertura manual sin costos ni ventas simuladas.</p>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">Estado comercial y estado del cliente: consultar Pricing/CRM; no se derivan del estado operativo.</p>
          </DhCard>
          <DhCard v-if="auth.hasScope('operations.audit.read')" title="Historial y trazabilidad">
            <OperationsAuditTimeline :events="audit" :users="actors" empty-title="Sin movimientos" empty-description="Todavía no hay eventos registrados." />
          </DhCard>
          <DhCard title="Acceso del expediente">
            <p class="text-sm text-[var(--dh-text-soft)]">{{ canEditSummary ? 'Aperturas editable mientras esté pendiente de validación; el backend comprueba cada cambio.' : 'Consulta habilitada. La edición depende de la etapa, su estado y el permiso específico.' }}</p>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Un superusuario puede consultar todos los departamentos, incluso los que aún no han iniciado, sin generar etapas ficticias.</p>
          </DhCard>
        </div>
      </div>

      <div v-else-if="selectedTab === 'QUO'" class="space-y-4">
        <DhCard :icon="FileText" title="Condiciones comerciales vinculadas" subtitle="Las QUO, subQUO y versiones se consultan sin alterar los datos de Pricing.">
          <div v-for="quote in workspace.quotes" :key="quote.id" class="mb-3 rounded-xl border border-[var(--dh-border)] p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-black">{{ quote.quoteNumber || 'Cotización vinculada' }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">Versión {{ quote.snapshotVersion }} · {{ statusLabel(quote.status) }}</p>
              </div>
              <RouterLink :to="`/pricing/rates/${quote.quoteOptionId || quote.quoteId}/wizard?mode=view`" class="text-sm font-bold text-[var(--dh-primary)] hover:underline">Ver en Pricing</RouterLink>
            </div>
            <p v-if="quote.quoteOptionId" class="mt-2 text-xs text-[var(--dh-text-muted)]">Opción aceptada vinculada · Consultar detalle en Pricing</p>
          </div>
          <p v-if="!workspace.quotes.length" class="text-sm text-[var(--dh-text-muted)]">
            {{ record.sourceQuoteId ? 'La cotización aún no tiene un snapshot comercial disponible en Operations.' : 'Sin cotización · La apertura fue creada sin cotización.' }}
          </p>
        </DhCard>
        <DhCard v-if="auth.hasScope('operations.cost.read')" title="Rubros y proveedores registrados" subtitle="Información histórica disponible; no se generan cargos ficticios.">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-[var(--dh-text-muted)]">{{ costRows.length }} rubros {{ snapshotCosts.length ? 'de la QUO aceptada' : 'registrados' }}</p>
            <DhBadge v-if="missingCostProviders" variant="warning">{{ missingCostProviders }} rubros sin proveedor registrado</DhBadge>
          </div>
          <p v-if="costError" role="alert" class="text-sm text-[var(--dh-text-muted)]">No se pudo consultar la información comercial. Utiliza Actualizar.</p>
          <p v-else-if="snapshotCosts.length && costs.length !== snapshotCosts.length" class="mb-3 text-xs text-[var(--dh-text-muted)]">La tabla muestra el snapshot original completo. Los rubros pendientes de conciliación no se consideran costos operativos confirmados.</p>
          <DhDataTable :columns="costColumns" :rows="costRows" v-if="!costError" empty-text="No hay rubros disponibles en la cotización aceptada.">
            <template #cell-description="{ row }"><span class="font-semibold">{{ readable(row.description) || 'Rubro pendiente de identificar' }}</span></template>
            <template #cell-supplierName="{ row }"><span>{{ readable(row.supplierName) || 'Proveedor pendiente' }}</span></template>
            <template #cell-currencyCode="{ row }">{{ currency(row.currencyCode, row.currencyName) || 'Moneda pendiente' }}</template>
            <template #cell-quantity="{ row }">{{ row.quantity ?? 'Por confirmar' }}</template>
            <template #cell-unitCost="{ row }">{{ amountLabel(row.unitCost) }}</template>
            <template #cell-costAmount="{ row }"><span class="font-semibold tabular-nums">{{ amountLabel(row.costAmount) }}</span></template>
            <template #cell-saleAmount="{ row }">{{ amountLabel(row.saleAmount) }}</template>
          </DhDataTable>
        </DhCard>
        <DhCard title="Servicios del expediente y revisiones comerciales" subtitle="Los servicios cotizados se conservan. Los agregados por Operations requieren revisión en Pricing.">
          <div v-for="service in commercialReviews?.services || []" :key="service.id"
            class="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--dh-input)] p-3 text-sm">
            <span class="font-bold">{{ service.serviceName }}</span>
            <DhBadge variant="neutral">{{ service.source === 'QUOTED' ? 'Cotizado' : 'Agregado Operations' }}</DhBadge>
            <span v-if="service.requiresPricingReview" class="text-xs font-semibold text-amber-600 dark:text-amber-300">
              {{ statusLabel(service.reviewStatus) }}
            </span>
          </div>
          <p v-if="!commercialReviews?.services.length" class="text-sm text-[var(--dh-text-muted)]">No hay servicios registrados en este expediente.</p>
          <div v-for="review in commercialReviews?.reviews || []" :key="review.id"
            class="mt-2 rounded-xl border border-[var(--dh-border)] p-3">
            <p class="text-xs font-bold">{{ statusLabel(review.status) }} · {{ dateLabel(review.requestedAtUtc) }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ review.reason }}</p>
          </div>
          <div v-if="canAddService" class="mt-4 space-y-3 border-t border-[var(--dh-border)] pt-4">
            <p class="text-sm font-bold">Agregar servicio operativo no cotizado</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <DhInput v-model="newService.serviceCode" label="Código del servicio" placeholder="ALMACENAJE" />
              <DhInput v-model="newService.serviceName" label="Descripción del servicio" placeholder="Almacenaje adicional" />
            </div>
            <DhTextarea v-model="newService.reason" label="Motivo de revisión comercial" placeholder="Explique por qué se requiere este servicio adicional." />
            <div class="flex justify-end">
              <DhButton :icon="Plus" label="Agregar y solicitar revisión a Pricing"
                :loading="addingService" :disabled="!validNewService" @click="addOperationalService" />
            </div>
          </div>
        </DhCard>
      </div>

      <div v-else class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div class="space-y-4">
          <DhCard :icon="Layers3" :title="tabs.find(x => x.code === selectedTab)?.label || 'Departamento'" subtitle="Información de la etapa y trabajo de los equipos autorizados.">
            <div v-if="currentStage" class="space-y-3">
              <div class="flex flex-wrap gap-2"><DhBadge variant="primary">{{ statusLabel(currentStage.status) }}</DhBadge><DhBadge variant="neutral">{{ level(selectedTab) === 'EDITABLE' ? 'Editable según permisos' : 'Solo lectura' }}</DhBadge></div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl bg-[var(--dh-input)] p-3"><p class="text-xs text-[var(--dh-text-muted)]">Equipo</p><p class="font-bold">{{ currentStage.teamName || 'Pendiente' }}</p></div>
                <div class="rounded-xl bg-[var(--dh-input)] p-3"><p class="text-xs text-[var(--dh-text-muted)]">Inicio</p><p class="font-bold">{{ dateLabel(currentStage.startedAtUtc) }}</p></div>
              </div>
              <div v-if="selectedTab === 'COORDINACION_ORIGEN' && origin" class="rounded-xl border border-[var(--dh-border)] p-4">
                <p class="text-xs font-bold text-[var(--dh-text-muted)]">Estado específico de Origen</p>
                <p class="mt-2 font-black">{{ statusLabel(origin.progress?.statusCode || origin.stage.status) }}</p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Salida real: {{ dateLabel(origin.progress?.actualDepartureAtUtc) }}</p>
                <div v-if="level('COORDINACION_ORIGEN') === 'EDITABLE' && !origin.progress?.actualDepartureAtUtc" class="mt-4 space-y-2">
                  <DhSelect v-model="originStatus" label="Actualizar estado operativo" :options="originStatusChoices" />
                  <DhButton :icon="Save" label="Guardar estado de Origen" :loading="savingOrigin"
                    :disabled="originStatus === (origin.progress?.statusCode || 'ORIGIN_COORDINATION')" @click="saveOriginStatus" />
                  <p class="text-xs text-[var(--dh-text-muted)]">La transición a Tránsito requiere confirmación de salida real con evidencia. Este formulario no la simula.</p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-[var(--dh-text-muted)]">Esta etapa no está activa en el flujo del trámite.</p>
          </DhCard>
          <DhCard title="Hitos y seguimiento" subtitle="Fechas reales y planificadas registradas en Operations.">
            <div v-for="milestone in currentMilestones" :key="milestone.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3">
              <p class="text-sm font-bold">{{ milestone.title }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ statusLabel(milestone.status) }} · {{ dateLabel(milestone.actualAtUtc || milestone.plannedAtUtc) }}</p>
            </div>
            <p v-if="!currentMilestones.length" class="text-sm text-[var(--dh-text-muted)]">Todavía no hay hitos registrados para esta etapa.</p>
          </DhCard>
          <DhCard v-if="selectedTab === 'COORDINACION_ORIGEN' && auth.hasScope('operations.internal-note.read') && origin" :icon="MessageSquareText" title="Bitácora privada de Origen" subtitle="Solo perfiles autorizados. Estas notas no se envían al cliente.">
            <div v-if="canWriteNote" class="mb-4 space-y-2">
              <DhTextarea v-model="noteText" label="Nueva nota interna" :rows="3" placeholder="Registrar seguimiento operativo…" />
              <DhButton :icon="Plus" label="Agregar nota" :loading="postingNote" :disabled="!noteText.trim()" @click="addNote" />
            </div>
            <div v-for="note in notes" :key="note.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3">
              <p class="whitespace-pre-wrap text-sm">{{ note.body }}</p>
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ dateLabel(note.createdAtUtc) }}</p>
            </div>
            <p v-if="!notes.length" class="text-sm text-[var(--dh-text-muted)]">Sin notas internas.</p>
          </DhCard>
        </div>
        <div class="space-y-4">
          <DhCard title="Tareas del departamento">
            <div v-for="task in currentTasks" :key="task.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3">
              <p class="text-sm font-bold">{{ task.title }}</p>
              <p v-if="task.details" class="mt-1 whitespace-pre-wrap text-xs">{{ task.details }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ statusLabel(task.status) }} · {{ dateLabel(task.dueAtUtc) }}</p>
            </div>
            <p v-if="!currentTasks.length" class="text-sm text-[var(--dh-text-muted)]">No hay tareas registradas para esta etapa.</p>
          </DhCard>
          <DhCard title="Acceso y responsabilidad">
            <p class="text-sm text-[var(--dh-text-soft)]">
              {{ level(selectedTab) === 'EDITABLE' ? 'El backend ha autorizado acciones de esta etapa para tu equipo. Las modificaciones disponibles dependen del permiso específico de cada operación.' : 'Puedes consultar esta etapa, pero no modificarla con los permisos actuales.' }}
            </p>
          </DhCard>
        </div>
      </div>
    </template>
  </div>
</template>
