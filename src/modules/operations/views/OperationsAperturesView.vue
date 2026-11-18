<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ClipboardList, Plus, RefreshCw, UsersRound, ShieldCheck, Clock3, FolderOpen } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type ApertureRow, type OperationsAudit, type ValidationPair } from '../services/operationsApi'

const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const canAssign = computed(() => auth.hasScope('operations.aperture.validation.assign') && auth.hasScope('operations.team.manage'))
const canReview = computed(() => auth.hasScope('operations.aperture.validation.review'))
const canAudit = computed(() => auth.hasScope('operations.audit.read'))
const rows = ref<ApertureRow[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(total.value / 50)))
const columns: DhTableColumn<ApertureRow>[] = [
  { key: 'idtra', label: 'Expediente' },
  { key: 'modalityCode', label: 'Modalidad' },
  { key: 'status', label: 'Estado' },
  { key: 'validators', label: 'Validaciones' },
  { key: 'createdAtUtc', label: 'Creado' },
  { key: 'actions', label: '', align: 'right' },
]
const filteredRows = computed(() => rows.value.filter(row =>
  (!statusFilter.value || row.status === statusFilter.value) &&
  (!search.value.trim() || [row.idtra, row.modalityCode, row.status].some(value => value.toLowerCase().includes(search.value.trim().toLowerCase()))),
))
const statusOptions = computed(() => [{ label: 'Todos los estados', value: '' }, ...[...new Set(rows.value.map(row => row.status))].map(value => ({ label: stateLabel(value), value }))])
const unassigned = computed(() => rows.value.filter(row => !row.validators?.length).length)
const inReview = computed(() => rows.value.filter(row => row.validators?.some(v => v.status === 'PENDING')).length)
const approved = computed(() => rows.value.filter(row => row.validators?.length >= 2 && row.validators.every(v => v.status === 'APPROVED')).length)
const modalityOptions = [
  { label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Carga consolidada', value: 'LCL' },
  { label: 'FTL · Camión completo', value: 'FTL' }, { label: 'LTL · Carga terrestre parcial', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validOpening = computed(() => uuidPattern.test(opening.value.companyId.trim()) && uuidPattern.test(opening.value.accountId.trim()) && /^[0-9]{5}$/.test(opening.value.seriesCode.trim()) && Number.isInteger(Number(opening.value.priority)) && Number(opening.value.priority) >= 1 && Number(opening.value.priority) <= 5 && Number(opening.value.complexityPoints) >= 0.5 && Number(opening.value.complexityPoints) <= 1000)
function approvalCount(row: ApertureRow) { return row.validators?.filter(v => v.status === 'APPROVED').length ?? 0 }
function stateLabel(value: string) { return ({ APPROVED: 'Aprobada', REJECTED: 'Cambios solicitados', PENDING: 'Pendiente', PENDING_VALIDATION: 'En validación', COMPLETED: 'Completada', OPEN: 'Abierta' } as Record<string, string>)[value] ?? value.replaceAll('_', ' ') }
function stateVariant(value: string): 'success' | 'warning' | 'danger' | 'neutral' { return ['APPROVED', 'COMPLETED'].includes(value) ? 'success' : value === 'REJECTED' ? 'danger' : value.includes('PENDING') ? 'warning' : 'neutral' }

const selectedId = ref('')
const selected = computed(() => rows.value.find(x => x.id === selectedId.value))
const pair = ref<ValidationPair | null>(null)
const audit = ref<OperationsAudit[]>([])
const error = ref('')
const message = ref('')
const busy = ref(false)
const comment = ref('')
const showCreate = ref(false)
const blankUser = '00000000-0000-0000-0000-000000000000'
const opening = ref({
  companyId: '', accountId: '', seriesCode: '',
  modalityCode: 'FCL', priority: 1, complexityPoints: 1,
})
function label(date: string) { return new Date(date).toLocaleString('es-CR') }
function short(id: string) { return id.slice(0, 8) }
function report(value: unknown) { error.value = value instanceof Error ? value.message : 'Ocurrió un error.' }
async function load() {
  error.value = ''
  loading.value = true
  try {
    const data = await operationsApi.apertures(page.value)
    rows.value = data.items
    total.value = data.total
    if (selectedId.value && !rows.value.some(x => x.id === selectedId.value)) selectedId.value = ''
    if (!selectedId.value && rows.value.length) selectedId.value = rows.value[0]?.id ?? ''
    await loadDetail()
  } catch (e) { report(e) }
  finally { loading.value = false }
}
async function changePage(next: number) { page.value = Math.min(pages.value, Math.max(1, next)); await load() }
async function choose(id: string) { selectedId.value = id; await loadDetail() }
async function loadDetail() {
  pair.value = null
  audit.value = []
  if (!selectedId.value) return
  try {
    pair.value = await operationsApi.validations(selectedId.value)
    if (canAudit.value) audit.value = await operationsApi.caseAudit(selectedId.value)
  } catch (e) { report(e) }
}
async function createOpening() {
  if (busy.value || !canCreate.value || !validOpening.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    const created = await operationsApi.createAperture({
      ...opening.value, executiveUserId: blankUser,
    })
    message.value = `Apertura ${created.idtra} creada. Queda pendiente su asignación a dos validadores.`
    showCreate.value = false
    page.value = 1
    await load()
    selectedId.value = created.id
    await loadDetail()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function assign() {
  if (!selected.value || busy.value || !canAssign.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    await operationsApi.assign(selected.value.id)
    message.value = 'Se asignaron dos revisores distintos del pool disponible.'
    await load()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
  if (!selected.value || busy.value || !canReview.value) return
  if (decision === 'REJECTED' && !comment.value.trim()) {
    error.value = 'Indica el motivo para solicitar cambios.'; return
  }
  busy.value = true; error.value = ''; message.value = ''
  try {
    await operationsApi.decide(selected.value.id, id, decision, comment.value.trim())
    comment.value = ''
    message.value = decision === 'APPROVED'
      ? 'Validación registrada. La apertura se completa únicamente con las dos aprobaciones.'
      : 'Se solicitaron cambios y la Apertura quedó bloqueada hasta corregirse.'
    await load()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
onMounted(load)
</script>


<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader title="Aperturas" subtitle="Expedientes, asignaciones y doble validación del pool operativo." :icon="ClipboardList" :hide-excel-export="false">
      <template #actions>
        <RouterLink v-if="auth.hasScope('operations.team.manage')" to="/operations/teams">
          <DhButton label="Equipos" :icon="UsersRound" variant="secondary" />
        </RouterLink>
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="loading" @click="load" />
        <DhButton v-if="canCreate" label="Nueva apertura" :icon="Plus" @click="showCreate = true" />
      </template>
    </DhPageHeader>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">{{ error }}</div>
    <div v-if="message" role="status" class="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-700 dark:text-green-300">{{ message }}</div>

    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Expedientes totales</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ total }}</p></div><FolderOpen class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Sin asignar · página</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ unassigned }}</p></div><UsersRound class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">En revisión · página</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ inReview }}</p></div><Clock3 class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Doble aprobación · página</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ approved }}</p></div><ShieldCheck class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
    </div>

    <DhCard :icon="ClipboardList" title="Bandeja de aperturas" subtitle="Selecciona un expediente para consultar las validaciones, acciones disponibles y auditoría.">
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
        <DhSearchInput v-model="search" placeholder="Buscar por IDTRA, modalidad o estado..." />
        <DhSelect v-model="statusFilter" :options="statusOptions" placeholder="" />
      </div>
      <DhDataTable :columns="columns" :rows="filteredRows" :loading="loading" empty-text="No hay aperturas para los filtros seleccionados." @row-click="choose($event.id)">
        <template #cell-idtra="{ row }"><strong class="text-[var(--dh-text)]">{{ row.idtra }}</strong></template>
        <template #cell-modalityCode="{ row }"><DhBadge variant="neutral">{{ row.modalityCode }}</DhBadge></template>
        <template #cell-status="{ row }"><DhBadge :variant="stateVariant(row.status)">{{ stateLabel(row.status) }}</DhBadge></template>
        <template #cell-validators="{ row }"><span class="font-bold">{{ approvalCount(row) }} / 2</span></template>
        <template #cell-createdAtUtc="{ row }">{{ label(row.createdAtUtc) }}</template>
        <template #cell-actions="{ row }"><DhButton size="sm" variant="secondary" :label="selectedId === row.id ? 'Seleccionada' : 'Ver detalle'" @click="choose(row.id)" /></template>
      </DhDataTable>
      <div class="mt-4 flex items-center justify-between gap-3">
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Página {{ page }} de {{ pages }} · {{ total }} expedientes</p>
        <div class="flex gap-2">
          <DhButton size="sm" variant="secondary" label="Anterior" :disabled="page <= 1 || loading" @click="changePage(page - 1)" />
          <DhButton size="sm" variant="secondary" label="Siguiente" :disabled="page >= pages || loading" @click="changePage(page + 1)" />
        </div>
      </div>
    </DhCard>

    <div v-if="selected" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
      <DhCard :icon="ShieldCheck" :title="'Validación · ' + selected.idtra" subtitle="Dos colaboradores distintos deben aprobar para completar la apertura.">
        <template #actions>
          <DhButton v-if="canAssign && pair && pair.validators.length === 0" label="Asignar 2 validadores" :icon="UsersRound" :loading="busy" @click="assign" />
        </template>
        <div class="flex flex-wrap gap-2">
          <DhBadge variant="primary">{{ selected.modalityCode }}</DhBadge>
          <DhBadge :variant="stateVariant(selected.status)">{{ stateLabel(selected.status) }}</DhBadge>
          <DhBadge v-if="pair" :variant="stateVariant(pair.stage.status)">{{ stateLabel(pair.stage.status) }}</DhBadge>
        </div>
        <div v-if="pair && pair.validators.length === 0" class="mt-5">
          <DhEmptyState :icon="UsersRound" title="Esperando asignación" description="Para iniciar las revisiones se requiere un equipo activo con dos personas diferentes y disponibles." />
        </div>
        <div v-else class="mt-5 grid gap-3 md:grid-cols-2">
          <div v-for="validator in pair?.validators ?? []" :key="validator.id" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm text-[var(--dh-text)]">Validador {{ validator.slot }}</strong><DhBadge :variant="stateVariant(validator.status)">{{ stateLabel(validator.status) }}</DhBadge></div>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Usuario {{ short(validator.userId) }}</p>
            <p v-if="validator.reviewedAtUtc" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ label(validator.reviewedAtUtc) }}</p>
            <p v-if="validator.comment" class="mt-3 whitespace-pre-wrap text-sm text-[var(--dh-text-soft)]">{{ validator.comment }}</p>
            <template v-if="canReview && validator.userId === auth.userId && validator.status === 'PENDING' && pair?.stage.status === 'PENDING_VALIDATION'">
              <DhTextarea v-model="comment" class="mt-4" label="Observación" placeholder="Obligatoria cuando solicites cambios" :rows="3" />
              <div class="mt-3 flex flex-wrap gap-2">
                <DhButton size="sm" label="Aprobar" :loading="busy" @click="decide(validator.id, 'APPROVED')" />
                <DhButton size="sm" variant="danger" label="Solicitar cambios" :disabled="busy || !comment.trim()" @click="decide(validator.id, 'REJECTED')" />
              </div>
            </template>
          </div>
        </div>
      </DhCard>
      <DhCard v-if="canAudit" title="Audit log" subtitle="Trazabilidad del expediente y sus decisiones.">
        <DhEmptyState v-if="!audit.length" :icon="Clock3" title="Sin eventos registrados" description="Las acciones auditadas se mostrarán aquí." />
        <ol v-else class="space-y-3">
          <li v-for="event in audit" :key="event.eventId" class="border-l-2 border-[var(--dh-primary)] py-1 pl-4">
            <p class="break-all text-sm font-bold text-[var(--dh-text)]">{{ event.actionCode }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ label(event.occurredAtUtc) }} · {{ short(event.actorUserId) }}</p>
          </li>
        </ol>
      </DhCard>
    </div>
    <DhEmptyState v-else-if="!loading" :icon="FolderOpen" title="No hay expediente seleccionado" description="Cuando se cree una apertura podrás consultar aquí su validación y trazabilidad." :action-label="canCreate ? 'Nueva apertura' : undefined" @action="showCreate = true" />

    <DhModal :open="showCreate && canCreate" title="Nueva apertura manual" size="lg" @close="showCreate = false">
      <form class="space-y-5" @submit.prevent="createOpening">
        <p class="text-sm text-[var(--dh-text-muted)]">Registra los datos iniciales del expediente. Los dos validadores se asignan después desde el pool operativo.</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <DhInput v-model="opening.companyId" label="Empresa · UUID *" placeholder="UUID de empresa" :error="opening.companyId && !uuidPattern.test(opening.companyId.trim()) ? 'Ingresa un UUID válido.' : undefined" />
          <DhInput v-model="opening.accountId" label="Cuenta CRM · UUID *" placeholder="UUID de cuenta" :error="opening.accountId && !uuidPattern.test(opening.accountId.trim()) ? 'Ingresa un UUID válido.' : undefined" />
          <DhInput v-model="opening.seriesCode" label="Serie IDTRA · 5 dígitos *" placeholder="00000" :error="opening.seriesCode && !/^[0-9]{5}$/.test(opening.seriesCode) ? 'Se requieren exactamente 5 dígitos.' : undefined" />
          <DhSelect v-model="opening.modalityCode" label="Modalidad" :options="modalityOptions" placeholder="" />
          <DhInput :model-value="opening.priority" label="Prioridad (1–5)" type="number" :min="1" :max="5" :step="1" @update:model-value="opening.priority = Number($event)" />
          <DhInput :model-value="opening.complexityPoints" label="Complejidad (puntos)" type="number" :min="0.5" :max="1000" :step="0.5" @update:model-value="opening.complexityPoints = Number($event)" />
        </div>
        <p class="rounded-2xl bg-[var(--dh-input)] p-3 text-xs text-[var(--dh-text-muted)]">El vendedor responsable se obtiene de CRM. Este formulario inicial utiliza los UUID hasta que esté disponible el selector de empresa y cuenta.</p>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton label="Cancelar" variant="secondary" @click="showCreate = false" />
          <DhButton type="submit" label="Crear apertura" :icon="Plus" :loading="busy" :disabled="!validOpening" />
        </div>
      </form>
    </DhModal>
  </div>
</template>
