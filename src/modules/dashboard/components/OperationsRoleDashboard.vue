<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowUpRight, ClipboardList, Clock3, FolderOpen, Inbox, RefreshCw,
  ShieldCheck, UsersRound,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhCard, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { useAuthStore } from '@/core/stores/authStore'
import { useRealtimeListRefresh } from '@/core/realtime/useRealtimeListRefresh'
import { useOperationsDashboardRealtime } from '@/modules/operations/composables/useOperationsCaseRealtime'
import { operationsApi, type OperationsDashboard } from '@/modules/operations/services/operationsApi'

const { t, locale } = useI18n()
const auth = useAuthStore()
const data = ref<OperationsDashboard | null>(null)
// Preserve the selector while loading a different team: the current result
// must not remain on screen under the newly selected team's label.
const accessibleTeams = ref<OperationsDashboard['teams']>([])
const selectedTeamId = ref('')
const loading = ref(false)
const error = ref('')
let requestId = 0

const options = computed(() => [
  { value: '', label: t('operations.dashboard.allAccessible') },
  ...accessibleTeams.value.map(team => ({
    value: team.id,
    label: team.name + ' · ' + t('operations.departments.' + team.departmentCode),
  })),
])
const roleLabel = computed(() =>
  auth.hasScope('operations.case.read-all') && !['SuperAdmin', 'SuperUsuario', 'SuperUser'].some(role => auth.hasRole(role))
    ? t('operations.dashboard.supervisor')
    : auth.hasScope('operations.origin.read-all') && !['SuperAdmin', 'SuperUsuario', 'SuperUser'].some(role => auth.hasRole(role))
      ? t('operations.teamRoles.ORIGIN_SUPERVISOR')
      : ['SuperAdmin', 'SuperUsuario', 'SuperUser'].some(role => auth.hasRole(role)) ||
  accessibleTeams.value.some(team => team.isSupervisor)
    ? t('operations.dashboard.supervisor')
    : t('operations.dashboard.operator'))
const isAperturas = computed(() => selectedTeamId.value
  ? accessibleTeams.value.some(team => team.id === selectedTeamId.value && team.departmentCode === 'APERTURAS')
  : accessibleTeams.value.some(team => team.departmentCode === 'APERTURAS'))
const cards = computed(() => [
  {
    key: 'total',
    label: t('operations.dashboard.total'),
    hint: t('operations.dashboard.totalHint'),
    value: data.value?.stats.total,
    icon: FolderOpen,
  },
  {
    key: 'manual',
    label: 'Trámites manuales',
    hint: 'Expedientes manuales registrados por Operaciones.',
    value: data.value?.stats.manual,
    icon: ClipboardList,
  },
  {
    key: 'automatic',
    label: 'Desde Pricing',
    hint: 'Expedientes vinculados a una QUO aceptada por el cliente.',
    value: data.value?.stats.automatic,
    icon: FolderOpen,
  },
  {
    key: 'awaiting',
    label: 'Sin operativo asignado',
    hint: t('operations.dashboard.awaitingHint'),
    value: data.value?.stats.awaitingAssignment,
    icon: UsersRound,
  },
  {
    key: 'review',
    label: t('operations.dashboard.inReview'),
    hint: t('operations.dashboard.inReviewHint'),
    value: data.value?.stats.inReview,
    icon: Clock3,
  },
  {
    key: 'approved',
    label: t('operations.dashboard.approved'),
    hint: t('operations.dashboard.approvedHint'),
    value: data.value?.stats.approved,
    icon: ShieldCheck,
  },
].filter(card => isAperturas.value || !['review', 'approved'].includes(card.key)))

const recentRows = computed(() => data.value?.items ?? [])
const recentColumns = computed<DhTableColumn<OperationsDashboard['items'][number]>[]>(() => [
  { key: 'idtra', label: t('operations.validation.record') },
  { key: 'modalityCode', label: t('operations.validation.modality') },
  { key: 'departmentCode', label: 'Departamento' },
  { key: 'status', label: t('operations.validation.status') },
  ...(isAperturas.value ? [{ key: 'approvedReviews', label: t('operations.validation.reviews'), align: 'center' as const }] : []),
  { key: 'actions', label: '' },
  { key: 'createdAtUtc', label: t('operations.validation.created') },
])
function statusLabel(status: string): string {
  const keys: Record<string, string> = {
    PENDING_VALIDATION: 'statusReview', COMPLETED: 'statusCompleted',
    APERTURA_VALIDADA: 'statusApproved', OPEN: 'statusOpen',
    APPROVED: 'statusApproved', REJECTED: 'statusRejected', PENDING: 'statusPending',
  }
  return keys[status] ? t('operations.validation.' + keys[status]) : status.replaceAll('_', ' ')
}
function dateLabel(utc: string) {
  const parsed = new Date(utc)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(
    locale.value === 'en' ? 'en-US' : 'es-CR',
    { day: '2-digit', month: 'short', year: 'numeric' },
  ).format(parsed)
}
async function load() { await loadDashboard(false) }
async function loadDashboard(background: boolean) {
  const current = ++requestId
  loading.value = !background || !data.value
  error.value = ''
  if (!background) data.value = null
  try {
    const result = await operationsApi.dashboard(selectedTeamId.value || undefined)
    if (current !== requestId) return
    accessibleTeams.value = result.teams
    data.value = result
  } catch (cause) {
    if (current !== requestId) return
    error.value = cause instanceof Error ? cause.message : t('operations.dashboard.loadError')
  } finally {
    if (current === requestId) loading.value = false
  }
}
watch(selectedTeamId, load)
watch(() => auth.userId, () => { selectedTeamId.value = ''; accessibleTeams.value = []; void load() })
useRealtimeListRefresh({ prefixes: ['/api/operations'], refresh: () => loadDashboard(true) })
useOperationsDashboardRealtime(() => {
  // Reuse the shared debounced invalidation mechanism; no full page reload.
  window.dispatchEvent(new CustomEvent('dhole:data:changed', {
    detail: { endpoint: '/api/operations/dashboard', method: 'SIGNALR' },
  }))
})
onMounted(load)
</script>

<template>
  <section class="space-y-3 sm:space-y-4" :aria-label="t('operations.dashboard.heading')">
    <DhCard padding="md">
      <div class="flex min-w-0 items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]">
          <ClipboardList class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p class="text-[11px] font-black uppercase tracking-widest text-[var(--dh-primary)]">
              {{ t('operations.dashboard.workspace') }}
            </p>
            <span class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ roleLabel }}</span>
          </div>
          <h1 class="mt-1 text-xl font-black tracking-tight text-[var(--dh-text)] sm:text-2xl">
            {{ isAperturas ? t('operations.dashboard.heading') : 'Mis trámites operativos' }}
          </h1>
          <p class="mt-1 max-w-3xl text-sm leading-5 text-[var(--dh-text-muted)]">
            {{ t('operations.dashboard.subtitle') }}
          </p>
        </div>
      </div>

      <div class="mt-5 flex flex-col gap-3 border-t border-[var(--dh-border)] pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <slot name="role-selector" />
          <div class="min-w-0 w-full sm:max-w-[320px]">
            <DhSelect v-model="selectedTeamId" :label="t('operations.dashboard.team')" :options="options" :placeholder="''" />
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <DhButton variant="secondary" :icon="RefreshCw" :loading="loading" :label="t('operations.refresh')" @click="load" />
          <RouterLink
            to="/operations/cases"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-black text-[var(--dh-on-primary)] shadow-[var(--dh-glow)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
          >
            Ver trámites
            <ArrowUpRight aria-hidden="true" class="h-4 w-4 shrink-0" />
          </RouterLink>
        </div>
      </div>
    </DhCard>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">
      {{ error }}
      <DhButton class="mt-2" variant="secondary" size="sm" :label="t('operations.refresh')" :icon="RefreshCw" @click="load" />
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6" :aria-busy="loading">
      <DhCard v-for="card in cards" :key="card.key" padding="sm">
        <div class="flex min-w-0 items-start justify-between gap-2">
          <p class="max-w-[22ch] text-xs font-bold leading-5 text-[var(--dh-text-muted)]">
            {{ card.label }}
          </p>
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-input)] text-[var(--dh-text-soft)]">
            <component :is="card.icon" class="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[var(--dh-text)] sm:text-3xl">
          {{ card.value ?? '—' }}
        </p>
        <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ card.hint }}</p>
      </DhCard>
    </div>

    <DhCard v-if="!error" padding="md">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-base font-black text-[var(--dh-text)]">{{ isAperturas ? t('operations.dashboard.recent') : 'Trámites recientes' }}</h2>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ t('operations.dashboard.recentHint') }}</p>
        </div>
        <RouterLink to="/operations/cases" class="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-[var(--dh-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)]">
          {{ t('operations.dashboard.viewCases') }}
          <ArrowUpRight class="h-4 w-4" aria-hidden="true" />
        </RouterLink>
      </div>

      <div v-if="loading" role="status" class="flex items-center gap-3 rounded-xl border border-[var(--dh-border)] px-4 py-5 text-sm text-[var(--dh-text-muted)]">
        <RefreshCw class="h-4 w-4 animate-spin text-[var(--dh-primary)]" aria-hidden="true" />
        {{ t('operations.dashboard.loading') }}
      </div>
      <div v-else-if="!data?.items.length" class="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--dh-border)] px-4 py-5 sm:flex-row sm:items-center sm:gap-4">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-input)] text-[var(--dh-text-soft)]">
          <Inbox class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-black text-[var(--dh-text)]">{{ t('operations.dashboard.emptyTitle') }}</h3>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ t('operations.dashboard.empty') }}</p>
        </div>
      </div>
      <DhDataTable v-else :columns="recentColumns" :rows="recentRows">
        <template #cell-idtra="{ row }">
          <RouterLink :to="{ name: 'operations-case-detail', params: { id: row.id } }" class="flex flex-wrap items-center gap-2 font-semibold text-[var(--dh-primary)] hover:underline">
            {{ row.idtra }} <DhBadge :variant="row.apertureType === 'AUTOMATIC' ? 'primary' : 'neutral'">{{ row.apertureType === 'AUTOMATIC' ? 'Pricing' : 'Manual' }}</DhBadge>
          </RouterLink>
        </template>
        <template #cell-status="{ row }"><DhBadge :variant="row.approvedReviews >= 1 ? 'success' : row.pendingReviews ? 'warning' : 'neutral'">{{ statusLabel(row.status) }}</DhBadge></template>
        <template #cell-departmentCode="{ row }">{{ row.departmentCode ? t('operations.departments.' + row.departmentCode) : 'Pendiente' }}</template>
        <template #cell-approvedReviews="{ row }"><span class="tabular-nums">{{ row.apertureType === 'MANUAL' ? 'No aplica' : Math.min(1, row.approvedReviews) + ' / 1' }}</span></template>
        <template #cell-actions="{ row }"><RouterLink :to="{ name: 'operations-case-detail', params: { id: row.id } }"><DhButton size="sm" variant="secondary" :label="row.canReview && auth.hasScope('operations.aperture.validation.review') ? 'Revisar apertura' : 'Abrir expediente'" /></RouterLink></template>
        <template #cell-createdAtUtc="{ row }">{{ dateLabel(row.createdAtUtc) }}</template>
      </DhDataTable>
      <p v-if="data && data.stats.total > data.items.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">
        {{ t('operations.dashboard.showingRecent') }}
      </p>
    </DhCard>
  </section>
</template>
