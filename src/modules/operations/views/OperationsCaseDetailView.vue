<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeft, RefreshCw, Pencil, Save, FolderOpen, ClipboardList,
  FileText, LockKeyhole, MessageSquareText, Plus,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import {
  operationsApi, type OperationsCaseDetail, type OperationsCaseWorkspace,
  type OperationsCaseCost, type OperationsCaseTab, type OperationsTabCode,
  type OperationsTabLevel, type OperationsAudit, type OperationsUser,
  type OperationsInternalNote, type OperationsOriginProgress,
  type OperationsOpeningEdit,
} from '../services/operationsApi'
import OperationsAuditTimeline from '../components/OperationsAuditTimeline.vue'

const route = useRoute()
const auth = useAuthStore()
const caseId = computed(() => String(route.params.id ?? ''))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const record = ref<OperationsCaseDetail | null>(null)
const workspace = ref<OperationsCaseWorkspace | null>(null)
const access = ref<OperationsCaseTab[]>([])
const costs = ref<OperationsCaseCost[]>([])
const origin = ref<OperationsOriginProgress | null>(null)
const notes = ref<OperationsInternalNote[]>([])
const noteText = ref('')
const postingNote = ref(false)
const audit = ref<OperationsAudit[]>([])
const actors = ref<OperationsUser[]>([])
const accountName = ref('')
const selectedTab = ref<OperationsTabCode>('RESUMEN')
const editing = ref(false)
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
const canEditSummary = computed(() => level('RESUMEN') === 'EDITABLE')
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
  return value ? value.replaceAll('_', ' ') : 'Pendiente'
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
    origin.value = null
    notes.value = []
    audit.value = []
    actors.value = []
    accountName.value = ''
    if (auth.hasScope('operations.cost.read')) optional.push(
      operationsApi.caseCosts(caseId.value).then(x => { if (current === sequence) costs.value = x.items }).catch(() => {}))
    if (auth.hasScope('operations.origin.read') &&
        work.stages.some(s => s.departmentCode === 'COORDINACION_ORIGEN')) optional.push(
      operationsApi.caseOriginProgress(caseId.value).then(x => { if (current === sequence) origin.value = x }).catch(() => {}))
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
      .then(x => { if (current === sequence) accountName.value = String(x.displayName ?? x.name ?? x.legalName ?? '') })
      .catch(() => {}))
    await Promise.all(optional)
  } catch (cause) {
    if (current === sequence) error.value = cause instanceof Error ? cause.message : 'No se pudo abrir el expediente.'
  } finally { if (current === sequence) loading.value = false }
}
async function saveEdit() {
  if (!record.value || !canEditSummary.value || !validEdit.value || saving.value) return
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
watch(caseId, () => { selectedTab.value = 'RESUMEN'; void load() }, { immediate: true })
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
        <DhBadge v-if="record" variant="primary">{{ statusLabel(record.status) }}</DhBadge>
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <DhButton v-if="record && canEditSummary && selectedTab === 'RESUMEN' && !editing" :icon="Pencil" label="Editar apertura" @click="editing = true" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>
    <div v-if="message" role="status" class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{{ message }}</div>
    <div v-if="loading" class="rounded-2xl bg-[var(--dh-input)] p-8 text-center text-[var(--dh-text-muted)]">Cargando expediente operativo…</div>

    <template v-if="record && workspace && !loading">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DhCard padding="sm">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Cliente</p>
          <p class="mt-2 truncate font-black">{{ accountName || 'Cuenta CRM' }}</p>
          <RouterLink :to="`/crm/accounts/${record.accountId}`" class="text-xs text-[var(--dh-primary)] hover:underline">Consultar cuenta CRM</RouterLink>
        </DhCard>
        <DhCard padding="sm">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Origen</p>
          <p class="mt-2 font-black">{{ record.apertureType === 'AUTOMATIC' ? 'Pricing · QUO aceptada' : 'Manual' }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">{{ record.modalityCode }} · {{ record.originCountryCode || '—' }} → {{ record.destinationCountryCode || '—' }}</p>
        </DhCard>
        <DhCard padding="sm">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Equipo actual</p>
          <p class="mt-2 font-black">{{ workspace.stages.find(s => s.status === 'IN_PROGRESS')?.teamName || workspace.stages.find(s => s.teamName)?.teamName || 'Pendiente de asignación' }}</p>
        </DhCard>
        <DhCard padding="sm">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Última actualización</p>
          <p class="mt-2 font-black">{{ dateLabel(record.updatedAtUtc) }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">Versión {{ record.version }}</p>
        </DhCard>
      </div>

      <div role="tablist" aria-label="Departamentos del expediente" class="flex flex-wrap gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2">
        <button v-for="tab in tabs" :key="tab.code" type="button" role="tab"
          :aria-selected="selectedTab === tab.code"
          :disabled="level(tab.code) === 'LOCKED' || level(tab.code) === 'NOT_APPLICABLE'"
          :title="level(tab.code) === 'EDITABLE' ? 'Editable según permisos' : level(tab.code) === 'READ_ONLY' ? 'Solo lectura' : level(tab.code) === 'NOT_APPLICABLE' ? 'No aplica' : 'Aún no habilitado'"
          class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :class="selectedTab === tab.code ? 'border-[var(--dh-primary)] bg-[var(--dh-input)] text-[var(--dh-primary)]' : 'border-transparent text-[var(--dh-text-soft)] hover:bg-[var(--dh-input)]'"
          @click="selectedTab = tab.code; editing = false">
          <LockKeyhole v-if="level(tab.code) === 'LOCKED'" class="h-3.5 w-3.5" />
          {{ tab.label }}
          <span v-if="level(tab.code) === 'NOT_APPLICABLE'" class="text-[10px]">N/A</span>
        </button>
      </div>

      <div v-if="selectedTab === 'RESUMEN'" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div class="space-y-4">
          <DhCard :icon="ClipboardList" title="Resumen y apertura" subtitle="La información comercial permanece bajo el control de Pricing.">
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
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <div v-for="item in [
                { key: 'IDTRA', value: record.idtra },
                { key: 'Modalidad', value: record.modalityCode },
                { key: 'Tipo de apertura', value: record.apertureType },
                { key: 'Estado operativo', value: statusLabel(record.status) },
                { key: 'País de origen', value: record.originCountryCode || 'Pendiente' },
                { key: 'País de destino', value: record.destinationCountryCode || 'Pendiente' },
                { key: 'Prioridad', value: record.priority },
                { key: 'Complejidad', value: record.complexityPoints },
                { key: 'Creado', value: dateLabel(record.createdAtUtc) },
                { key: 'Actualizado', value: dateLabel(record.updatedAtUtc) },
              ]" :key="item.key" class="rounded-xl bg-[var(--dh-input)] p-3">
                <p class="text-xs text-[var(--dh-text-muted)]">{{ item.key }}</p>
                <p class="mt-1 break-words text-sm font-bold">{{ item.value }}</p>
              </div>
            </div>
          </DhCard>
          <DhCard title="Departamentos y equipos" subtitle="Un único expediente compartido por las áreas autorizadas.">
            <div v-for="stage in workspace.stages" :key="stage.id" class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3 last:mb-0">
              <div>
                <p class="text-sm font-bold">{{ statusLabel(stage.departmentCode) }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ stage.teamName || 'Equipo sin asignar' }}</p>
              </div>
              <DhBadge variant="neutral">{{ statusLabel(stage.status) }}</DhBadge>
            </div>
            <p v-if="!workspace.stages.length" class="text-sm text-[var(--dh-text-muted)]">No hay departamentos asignados.</p>
          </DhCard>
          <DhCard title="Pendientes del expediente">
            <div v-for="task in workspace.tasks" :key="task.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3 text-sm last:mb-0">
              <p class="font-bold">{{ task.title }}</p><p class="text-xs text-[var(--dh-text-muted)]">{{ statusLabel(task.status) }} · {{ dateLabel(task.dueAtUtc) }}</p>
            </div>
            <p v-if="!workspace.tasks.length" class="text-sm text-[var(--dh-text-muted)]">No hay tareas registradas.</p>
          </DhCard>
        </div>
        <div class="space-y-4">
          <DhCard title="Cotización vinculada">
            <RouterLink v-if="record.sourceQuoteId" :to="`/pricing/rates/${record.sourceQuoteId}/wizard?mode=view`" class="font-bold text-[var(--dh-primary)] hover:underline">Abrir QUO en Pricing</RouterLink>
            <p v-else class="text-sm text-[var(--dh-text-muted)]">SIN_QUO · Apertura manual sin costos ni ventas simuladas.</p>
          </DhCard>
          <DhCard v-if="auth.hasScope('operations.audit.read')" title="Historial y trazabilidad">
            <OperationsAuditTimeline :events="audit" :users="actors" empty-title="Sin movimientos" empty-description="Todavía no hay eventos registrados." />
          </DhCard>
          <DhCard title="Permisos del expediente">
            <p class="text-sm text-[var(--dh-text-soft)]">{{ canEditSummary ? 'Puedes editar los datos de Aperturas mientras esté pendiente de validación.' : 'Esta sección es de consulta para tu perfil o ya fue validada.' }}</p>
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
              <RouterLink :to="`/pricing/rates/${quote.quoteId}/wizard?mode=view`" class="text-sm font-bold text-[var(--dh-primary)] hover:underline">Ver en Pricing</RouterLink>
            </div>
            <p v-if="quote.quoteOptionId" class="mt-2 text-xs text-[var(--dh-text-muted)]">Opción comercial aceptada: {{ quote.quoteOptionId }}</p>
          </div>
          <p v-if="!workspace.quotes.length" class="text-sm text-[var(--dh-text-muted)]">
            {{ record.sourceQuoteId ? 'La cotización aún no tiene un snapshot comercial disponible en Operations.' : 'SIN_QUO · La apertura fue creada sin cotización.' }}
          </p>
        </DhCard>
        <DhCard v-if="auth.hasScope('operations.cost.read')" title="Rubros y proveedores registrados" subtitle="Información histórica disponible; no se generan cargos ficticios.">
          <div v-for="cost in costs" :key="cost.id" class="mb-2 flex flex-wrap justify-between gap-3 rounded-xl bg-[var(--dh-input)] p-3 last:mb-0">
            <div>
              <p class="text-sm font-bold">{{ cost.description }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ cost.costCode }} · {{ cost.supplierName || 'Proveedor sin registrar' }}</p>
            </div>
            <strong class="text-sm">{{ cost.currencyCode }} {{ cost.costAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 }) }}</strong>
          </div>
          <p v-if="!costs.length" class="text-sm text-[var(--dh-text-muted)]">Sin rubros persistidos para esta cotización.</p>
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
