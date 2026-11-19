<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowUpRight, ClipboardList, Clock3, FolderOpen, Inbox, RefreshCw,
  ShieldCheck, UsersRound,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { useAuthStore } from '@/core/stores/authStore'
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
  auth.hasScope('operations.case.read-all') ||
  accessibleTeams.value.some(team => team.isSupervisor)
    ? t('operations.dashboard.supervisor')
    : t('operations.dashboard.operator'))
const cards = computed(() => [
  {
    key: 'total',
    label: t('operations.dashboard.total'),
    hint: t('operations.dashboard.totalHint'),
    value: data.value?.stats.total,
    icon: FolderOpen,
  },
  {
    key: 'awaiting',
    label: t('operations.dashboard.awaiting'),
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
async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  data.value = null
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
            {{ t('operations.dashboard.heading') }}
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
            to="/operations/apertures"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-black text-[var(--dh-on-primary)] shadow-[var(--dh-glow)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
          >
            {{ t('operations.dashboard.openQueue') }}
            <ArrowUpRight aria-hidden="true" class="h-4 w-4 shrink-0" />
          </RouterLink>
        </div>
      </div>
    </DhCard>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300">
      {{ error }}
      <DhButton class="mt-2" variant="secondary" size="sm" :label="t('operations.refresh')" :icon="RefreshCw" @click="load" />
    </div>

    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4" :aria-busy="loading">
      <DhCard v-for="card in cards" :key="card.key" padding="sm">
        <div class="flex min-w-0 items-start justify-between gap-2">
          <p class="max-w-[22ch] text-xs font-bold leading-5 text-[var(--dh-text-muted)]">
            {{ card.label }}
          </p>
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-input)] text-[var(--dh-text-soft)]">
            <component :is="card.icon" class="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p class="mt-1 text-3xl font-black tabular-nums tracking-tight text-[var(--dh-text)] sm:text-4xl">
          {{ card.value ?? '—' }}
        </p>
        <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ card.hint }}</p>
      </DhCard>
    </div>

    <DhCard padding="md">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-base font-black text-[var(--dh-text)]">{{ t('operations.dashboard.recent') }}</h2>
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
      <div v-else class="overflow-hidden rounded-xl border border-[var(--dh-border)]">
        <div class="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.85fr)] gap-3 border-b border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-[var(--dh-text-muted)] md:grid">
          <span>{{ t('operations.validation.record') }}</span>
          <span>{{ t('operations.validation.modality') }}</span>
          <span>{{ t('operations.validation.status') }}</span>
          <span>{{ t('operations.validation.reviews') }}</span>
          <span>{{ t('operations.validation.created') }}</span>
        </div>
        <RouterLink v-for="item in data.items" :key="item.id" to="/operations/apertures"
          class="grid min-w-0 gap-2 border-b border-[var(--dh-border)] px-4 py-3 last:border-0 transition-colors hover:bg-[var(--dh-input)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)] md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.65fr)_minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.85fr)] md:items-center md:gap-3">
          <strong class="truncate text-sm font-bold text-[var(--dh-text)]">{{ item.idtra }}</strong>
          <span class="text-sm text-[var(--dh-text-soft)]">{{ item.modalityCode }}</span>
          <span><DhBadge :variant="item.approvedReviews >= 2 ? 'success' : item.pendingReviews ? 'warning' : 'neutral'">{{ statusLabel(item.status) }}</DhBadge></span>
          <span class="text-sm tabular-nums text-[var(--dh-text-soft)]">{{ item.approvedReviews }} / 2</span>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ dateLabel(item.createdAtUtc) }}</span>
        </RouterLink>
      </div>
      <p v-if="data && data.stats.total > data.items.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">
        {{ t('operations.dashboard.showingRecent') }}
      </p>
    </DhCard>
  </section>
</template>
