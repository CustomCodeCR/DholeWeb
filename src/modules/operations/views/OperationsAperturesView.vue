<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClipboardList, Plus, RefreshCw, UsersRound, ShieldCheck, Clock3, FolderOpen } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type ApertureRow, type CrmAccountOption, type OperationsAudit, type OperationsUser, type ValidationPair } from '../services/operationsApi'
import OperationsAuditTimeline from '../components/OperationsAuditTimeline.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const canCreate = computed(() => auth.hasScope('operations.case.create'))
const canAssign = computed(() => auth.hasScope('operations.aperture.validation.assign') && auth.hasScope('operations.team.manage'))
const canAudit = computed(() => auth.hasScope('operations.audit.read'))
const rows = ref<ApertureRow[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(total.value / 50)))
const columns = computed<DhTableColumn<ApertureRow>[]>(() => [
  { key: 'idtra', label: t('operations.validation.record') },
  { key: 'apertureType', label: 'Origen' },
  { key: 'sourceQuoteId', label: 'QUO' },
  { key: 'modalityCode', label: t('operations.validation.modality') },
  { key: 'status', label: t('operations.validation.status') },
  { key: 'validators', label: t('operations.validation.reviews') },
  { key: 'createdAtUtc', label: t('operations.validation.created') },
  { key: 'actions', label: '', align: 'right' },
 ])
const filteredRows = computed(() => rows.value)
const typeFilter = ref('')
const typeOptions = [
  { label: 'Todas las aperturas', value: '' },
  { label: 'Manuales', value: 'MANUAL' },
  { label: 'Automáticas desde Pricing', value: 'AUTOMATIC' },
]
const statusOptions = computed(() => [
  { label: t('operations.validation.allStatuses'), value: '' },
  ...['DRAFT', 'PENDING_VALIDATION', 'APERTURA_VALIDADA', 'APERTURA_REQUIERE_CAMBIOS', 'ACTIVE', 'COMPLETED', 'CANCELLED']
    .map(value => ({ label: stateLabel(value), value })),
])
const unassigned = computed(() => rows.value.filter(row => !row.validators?.length).length)
const inReview = computed(() => rows.value.filter(row => row.validators?.some(v => v.status === 'PENDING')).length)
const approved = computed(() => rows.value.filter(row => row.validators?.length >= 2 && row.validators.every(v => v.status === 'APPROVED')).length)
const modalityOptions = computed(() => [
  { label: t('operations.validation.modalityFcl'), value: 'FCL' }, { label: t('operations.validation.modalityLcl'), value: 'LCL' },
  { label: t('operations.validation.modalityFtl'), value: 'FTL' }, { label: t('operations.validation.modalityLtl'), value: 'LTL' },
  { label: t('operations.validation.modalityAir'), value: 'AIR' }, { label: t('operations.validation.modalityMultimodal'), value: 'MULTIMODAL' },
 ])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validOpening = computed(() => uuidPattern.test(opening.value.companyId.trim()) && uuidPattern.test(opening.value.accountId.trim()) && /^[0-9]{5}$/.test(opening.value.seriesCode.trim()) && Number.isInteger(Number(opening.value.priority)) && Number(opening.value.priority) >= 1 && Number(opening.value.priority) <= 5 && Number(opening.value.complexityPoints) >= 0.5 && Number(opening.value.complexityPoints) <= 1000)
function approvalCount(row: ApertureRow) { return row.validators?.filter(v => v.status === 'APPROVED').length ?? 0 }
function stateLabel(value: string) {
  const keys: Record<string, string> = {
    APPROVED: 'statusApproved', REJECTED: 'statusRejected', PENDING: 'statusPending',
    PENDING_VALIDATION: 'statusReview', COMPLETED: 'statusCompleted', OPEN: 'statusOpen',
  }
  return keys[value] ? t('operations.validation.' + keys[value]) : value.replaceAll('_', ' ')
}
function stateVariant(value: string): 'success' | 'warning' | 'danger' | 'neutral' { return ['APPROVED', 'COMPLETED'].includes(value) ? 'success' : value === 'REJECTED' ? 'danger' : value.includes('PENDING') ? 'warning' : 'neutral' }

const selectedId = ref('')
const selected = computed(() => rows.value.find(x => x.id === selectedId.value))
const pair = ref<ValidationPair | null>(null)
const audit = ref<OperationsAudit[]>([])
const auditPeople = ref<OperationsUser[]>([])
const error = ref('')
const message = ref('')
const busy = ref(false)
const comment = ref('')
const showCreate = ref(false)
const crmSearch = ref('')
const crmAccounts = ref<CrmAccountOption[]>([])
const loadingCrm = ref(false)
const crmOptions = computed(() => [
  { label: 'Seleccione una cuenta de CRM', value: '' },
  ...crmAccounts.value.map(a => ({ label: a.displayName, value: a.id })),
])
const opening = ref({
  companyId: '', accountId: '', seriesCode: '',
  modalityCode: 'FCL', priority: 1, complexityPoints: 1,
})
function label(date: string) { return new Date(date).toLocaleString(locale.value === 'es' ? 'es-CR' : 'en-US') }
function short(id: string) { return id.slice(0, 8) }
function report(value: unknown) { error.value = value instanceof Error ? value.message : t('operations.validation.error') }
async function load() {
  error.value = ''
  loading.value = true
  try {
    const data = await operationsApi.apertures(page.value, {
      q: search.value, status: statusFilter.value, apertureType: typeFilter.value,
    })
    rows.value = data.items
    total.value = data.total
    if (selectedId.value && !rows.value.some(x => x.id === selectedId.value)) selectedId.value = ''
    if (!selectedId.value && rows.value.length) selectedId.value = rows.value[0]?.id ?? ''
    await loadDetail()
  } catch (e) { report(e) }
  finally { loading.value = false }
}
async function changePage(next: number) { page.value = Math.min(pages.value, Math.max(1, next)); await load() }
let filterTimer: ReturnType<typeof setTimeout> | undefined
watch([search, statusFilter, typeFilter], () => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => { page.value = 1; void load() }, 250)
})
async function loadCrmAccounts() {
  loadingCrm.value = true
  try {
    const response = await operationsApi.crmAccounts(crmSearch.value)
    crmAccounts.value = response.items
  } catch (e) { report(e) }
  finally { loadingCrm.value = false }
}
let crmTimer: ReturnType<typeof setTimeout> | undefined
watch(crmSearch, () => {
  clearTimeout(crmTimer)
  crmTimer = setTimeout(() => { void loadCrmAccounts() }, 250)
})
async function openCreate() {
  error.value = ''
  try {
    const context = await operationsApi.createContext()
    if (context.companyId) opening.value.companyId = context.companyId
    await loadCrmAccounts()
    showCreate.value = true
  } catch (e) { report(e) }
}
async function choose(id: string) { selectedId.value = id; await loadDetail() }
async function loadDetail() {
  const caseId = selectedId.value
  pair.value = null
  audit.value = []
  auditPeople.value = []
  if (!caseId) return
  try {
    const currentPair = await operationsApi.validations(caseId)
    if (selectedId.value !== caseId) return
    pair.value = currentPair
    if (canAudit.value) {
      const events = await operationsApi.caseAudit(caseId)
      if (selectedId.value !== caseId) return
      audit.value = events
      const people = await operationsApi.auditActors(events.map(event => event.actorUserId))
      if (selectedId.value === caseId) auditPeople.value = people.items
    }
  } catch (e) { report(e) }
}
async function createOpening() {
  if (busy.value || !canCreate.value || !validOpening.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    const created = await operationsApi.createAperture(opening.value)
    message.value = t('operations.validation.createdMessage', { idtra: created.idtra })
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
    message.value = t('operations.validation.assignedMessage')
    await load()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
  if (!selected.value || busy.value || !pair.value?.validators.some(v => v.id === id && v.canReview === true)) return
  if (decision === 'REJECTED' && !comment.value.trim()) {
    error.value = t('operations.validation.requiredReason'); return
  }
  busy.value = true; error.value = ''; message.value = ''
  try {
    await operationsApi.decide(selected.value.id, id, decision, comment.value.trim())
    comment.value = ''
    message.value = decision === 'APPROVED'
      ? t('operations.validation.approvedMessage')
      : t('operations.validation.rejectedMessage')
    await load()
  } catch (e) { report(e) }
  finally { busy.value = false }
}
onMounted(load)
</script>


<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader :title="t('operations.validation.title')" :subtitle="t('operations.validation.subtitle')" :icon="ClipboardList" :hide-excel-export="false">
      <template #actions>
        <RouterLink v-if="auth.hasScope('operations.team.manage')" to="/operations/teams">
          <DhButton :label="t('operations.teams')" :icon="UsersRound" variant="secondary" />
        </RouterLink>
        <DhButton :label="t('operations.refresh')" :icon="RefreshCw" variant="secondary" :loading="loading" @click="load" />
        <DhButton v-if="canCreate" :label="t('operations.validation.new')" :icon="Plus" @click="openCreate" />
      </template>
    </DhPageHeader>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">{{ error }}</div>
    <div v-if="message" role="status" class="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-700 dark:text-green-300">{{ message }}</div>

    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ t('operations.validation.total') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ total }}</p></div><FolderOpen class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ t('operations.validation.unassignedPage') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ unassigned }}</p></div><UsersRound class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ t('operations.validation.reviewPage') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ inReview }}</p></div><Clock3 class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
      <DhCard padding="sm"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ t('operations.validation.approvedPage') }}</p><p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ approved }}</p></div><ShieldCheck class="h-5 w-5 text-[var(--dh-primary)]" /></div></DhCard>
    </div>

    <DhCard :icon="ClipboardList" :title="t('operations.validation.queue')" :subtitle="t('operations.validation.queueHintDetail')">
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_240px]">
        <DhSearchInput v-model="search" placeholder="Buscar IDTRA" />
        <DhSelect v-model="typeFilter" :options="typeOptions" placeholder="" />
        <DhSelect v-model="statusFilter" :options="statusOptions" placeholder="" />
      </div>
      <DhDataTable :columns="columns" :rows="filteredRows" :loading="loading" :empty-text="t('operations.validation.noCases')" @row-click="choose($event.id)">
        <template #cell-idtra="{ row }"><strong class="text-[var(--dh-text)]">{{ row.idtra }}</strong></template>
        <template #cell-apertureType="{ row }"><DhBadge :variant="row.apertureType === 'AUTOMATIC' ? 'primary' : 'neutral'">{{ row.apertureType === 'AUTOMATIC' ? 'Pricing' : 'Manual' }}</DhBadge></template>
        <template #cell-sourceQuoteId="{ row }"><RouterLink v-if="row.sourceQuoteId" :to="`/pricing/rates/${row.sourceQuoteId}/wizard?mode=view`" class="font-semibold text-[var(--dh-primary)] hover:underline" @click.stop>Ver QUO</RouterLink><span v-else class="text-[var(--dh-text-muted)]">Sin QUO</span></template>
        <template #cell-modalityCode="{ row }"><DhBadge variant="neutral">{{ row.modalityCode }}</DhBadge></template>
        <template #cell-status="{ row }"><DhBadge :variant="stateVariant(row.status)">{{ stateLabel(row.status) }}</DhBadge></template>
        <template #cell-validators="{ row }"><span class="font-bold">{{ approvalCount(row) }} / 2</span></template>
        <template #cell-createdAtUtc="{ row }">{{ label(row.createdAtUtc) }}</template>
        <template #cell-actions="{ row }"><DhButton size="sm" variant="secondary" :label="selectedId === row.id ? t('operations.validation.selectedStatus') : t('operations.validation.viewDetail')" @click="choose(row.id)" /></template>
      </DhDataTable>
      <div class="mt-4 flex items-center justify-between gap-3">
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('operations.validation.pageOf', { page, pages, total }) }}</p>
        <div class="flex gap-2">
          <DhButton size="sm" variant="secondary" :label="t('operations.validation.previous')" :disabled="page <= 1 || loading" @click="changePage(page - 1)" />
          <DhButton size="sm" variant="secondary" :label="t('operations.validation.next')" :disabled="page >= pages || loading" @click="changePage(page + 1)" />
        </div>
      </div>
    </DhCard>

    <div v-if="selected" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
      <DhCard :icon="ShieldCheck" :title="t('operations.validation.reviewTitle', { idtra: selected.idtra })" :subtitle="t('operations.validation.reviewHint')">
        <template #actions>
          <DhButton v-if="canAssign && pair && pair.validators.length === 0" :label="t('operations.validation.assignTwo')" :icon="UsersRound" :loading="busy" @click="assign" />
        </template>
        <div class="flex flex-wrap gap-2">
          <DhBadge variant="primary">{{ selected.modalityCode }}</DhBadge>
          <DhBadge :variant="stateVariant(selected.status)">{{ stateLabel(selected.status) }}</DhBadge>
          <DhBadge v-if="pair" :variant="stateVariant(pair.stage.status)">{{ stateLabel(pair.stage.status) }}</DhBadge>
        </div>
        <div v-if="pair && pair.validators.length === 0" class="mt-5">
          <DhEmptyState :icon="UsersRound" :title="t('operations.validation.awaitingAssignment')" :description="t('operations.validation.awaitingHint')" />
        </div>
        <div v-else class="mt-5 grid gap-3 md:grid-cols-2">
          <div v-for="validator in pair?.validators ?? []" :key="validator.id" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm text-[var(--dh-text)]">{{ t('operations.validation.reviewer', { slot: validator.slot }) }}</strong><DhBadge :variant="stateVariant(validator.status)">{{ stateLabel(validator.status) }}</DhBadge></div>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ t('operations.validation.personId', { id: short(validator.userId) }) }}</p>
            <p v-if="validator.reviewedAtUtc" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ label(validator.reviewedAtUtc) }}</p>
            <p v-if="validator.comment" class="mt-3 whitespace-pre-wrap text-sm text-[var(--dh-text-soft)]">{{ validator.comment }}</p>
            <template v-if="validator.canReview === true">
              <DhTextarea v-model="comment" class="mt-4" :label="t('operations.validation.comment')" :placeholder="t('operations.validation.commentRequired')" :rows="3" />
              <div class="mt-3 flex flex-wrap gap-2">
                <DhButton size="sm" :label="t('operations.validation.approve')" :loading="busy" @click="decide(validator.id, 'APPROVED')" />
                <DhButton size="sm" variant="danger" :label="t('operations.validation.requestChanges')" :disabled="busy || !comment.trim()" @click="decide(validator.id, 'REJECTED')" />
              </div>
            </template>
          </div>
        </div>
      </DhCard>
      <DhCard v-if="canAudit" :title="t('operations.validation.audit')" :subtitle="t('operations.validation.auditHint')">
        <OperationsAuditTimeline :events="audit" :users="auditPeople" :empty-title="t('operations.validation.noAudit')" :empty-description="t('operations.validation.noAuditDescription')" />
      </DhCard>
    </div>
    <DhEmptyState v-else-if="!loading" :icon="FolderOpen" :title="t('operations.validation.noSelection')" :description="t('operations.validation.noSelectionHint')" :action-label="canCreate ? t('operations.validation.new') : undefined" @action="openCreate" />

    <DhModal :open="showCreate && canCreate" :title="t('operations.validation.formTitle')" size="lg" @close="showCreate = false">
      <form class="space-y-5" @submit.prevent="createOpening">
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('operations.validation.formHint') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <DhInput v-model="opening.companyId" :label="t('operations.validation.company')" placeholder="UUID de empresa" :error="opening.companyId && !uuidPattern.test(opening.companyId.trim()) ? t('operations.validation.uuidError') : undefined" />
          <div class="space-y-2">
            <DhSearchInput v-model="crmSearch" placeholder="Buscar cliente por nombre o cédula en CRM" />
            <DhSelect v-model="opening.accountId" :label="t('operations.validation.account')" :options="crmOptions" :disabled="loadingCrm" placeholder="Seleccione un cliente" />
            <p class="text-xs text-[var(--dh-text-muted)]">El ejecutivo responsable se consulta automáticamente desde CRM.</p>
          </div>
          <DhInput v-model="opening.seriesCode" :label="t('operations.validation.series')" placeholder="00000" :error="opening.seriesCode && !/^[0-9]{5}$/.test(opening.seriesCode) ? t('operations.validation.seriesError') : undefined" />
          <DhSelect v-model="opening.modalityCode" :label="t('operations.validation.modality')" :options="modalityOptions" placeholder="" />
          <DhInput :model-value="opening.priority" :label="t('operations.validation.priority')" type="number" :min="1" :max="5" :step="1" @update:model-value="opening.priority = Number($event)" />
          <DhInput :model-value="opening.complexityPoints" :label="t('operations.validation.complexity')" type="number" :min="0.5" :max="1000" :step="0.5" @update:model-value="opening.complexityPoints = Number($event)" />
        </div>
        <p class="rounded-2xl bg-[var(--dh-input)] p-3 text-xs text-[var(--dh-text-muted)]">{{ t('operations.validation.formNote') }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton :label="t('operations.cancel')" variant="secondary" @click="showCreate = false" />
          <DhButton type="submit" :label="t('operations.validation.create')" :icon="Plus" :loading="busy" :disabled="!validOpening" />
        </div>
      </form>
    </DhModal>
  </div>
</template>
