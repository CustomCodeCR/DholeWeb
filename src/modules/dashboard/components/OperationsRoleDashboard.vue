<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClipboardList, RefreshCw, FolderOpen, Clock3, ShieldCheck, UsersRound, ArrowUpRight } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { useAuthStore } from '@/core/stores/authStore'
import { operationsApi, type OperationsDashboard } from '@/modules/operations/services/operationsApi'

const { t, locale } = useI18n()
const auth = useAuthStore()
const data = ref<OperationsDashboard | null>(null)
const selectedTeamId = ref('')
const loading = ref(false)
const error = ref('')
let requestId = 0

const options = computed(() => [
  { value: '', label: t('operations.dashboard.allAccessible') },
  ...(data.value?.teams ?? []).map(team => ({
    value: team.id,
    label: team.name + ' · ' + t('operations.departments.' + team.departmentCode),
  })),
])
const roleLabel = computed(() =>
  auth.hasScope('operations.case.read-all')
  || data.value?.teams.some(team => team.isSupervisor)
    ? t('operations.dashboard.supervisor')
    : t('operations.dashboard.operator'))
const stats = computed(() => data.value?.stats ?? {
  total: 0, awaitingAssignment: 0, inReview: 0, approved: 0,
})
const cards = computed(() => [
  { key: 'total', label: t('operations.dashboard.total'), value: stats.value.total, icon: FolderOpen },
  { key: 'awaiting', label: t('operations.dashboard.awaiting'), value: stats.value.awaitingAssignment, icon: UsersRound },
  { key: 'review', label: t('operations.dashboard.inReview'), value: stats.value.inReview, icon: Clock3 },
  { key: 'approved', label: t('operations.dashboard.approved'), value: stats.value.approved, icon: ShieldCheck },
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
    locale.value === 'en' ? 'en-US' : 'es-CR', { day: '2-digit', month: 'short', year: 'numeric' }
  ).format(parsed)
}
async function load() {
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await operationsApi.dashboard(selectedTeamId.value || undefined)
    if (current !== requestId) return
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
  <section class="space-y-4" :aria-label="t('operations.dashboard.heading')">
    <DhCard padding="md">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]">
            <ClipboardList class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-[var(--dh-primary)]">{{ roleLabel }}</p>
            <h2 class="text-xl font-black text-[var(--dh-text)]">{{ t('operations.dashboard.heading') }}</h2>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ t('operations.dashboard.subtitle') }}</p>
          </div>
        </div>
        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-end xl:w-auto">
          <div class="w-full sm:min-w-64">
            <DhSelect v-model="selectedTeamId" :label="t('operations.dashboard.team')" :options="options" :placeholder="''" />
          </div>
          <DhButton variant="secondary" :icon="RefreshCw" :loading="loading" :label="t('operations.refresh')" @click="load" />
          <RouterLink to="/operations/apertures"><DhButton :icon="ArrowUpRight" :label="t('operations.dashboard.openQueue')" /></RouterLink>
        </div>
      </div>
    </DhCard>

    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ error }}
    </div>

    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DhCard v-for="card in cards" :key="card.key" padding="sm">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-bold leading-5 text-[var(--dh-text-muted)]">{{ card.label }}</p>
          <component :is="card.icon" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-2 text-3xl font-black tabular-nums text-[var(--dh-text)]">{{ card.value }}</p>
      </DhCard>
    </div>

    <DhCard :title="t('operations.dashboard.recent')" :subtitle="t('operations.dashboard.recentHint')" :icon="ClipboardList">
      <div v-if="loading && !data" class="py-10 text-center text-sm text-[var(--dh-text-muted)]">{{ t('operations.dashboard.loading') }}</div>
      <div v-else-if="!data?.items.length" class="py-10 text-center text-sm text-[var(--dh-text-muted)]">{{ t('operations.dashboard.empty') }}</div>
      <div v-else class="overflow-hidden rounded-2xl border border-[var(--dh-border)]">
        <div class="hidden grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-3 border-b border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)] md:grid">
          <span>{{ t('operations.validation.record') }}</span>
          <span>{{ t('operations.validation.modality') }}</span>
          <span>{{ t('operations.validation.status') }}</span>
          <span>{{ t('operations.validation.reviews') }}</span>
          <span>{{ t('operations.validation.created') }}</span>
        </div>
        <RouterLink v-for="item in data.items" :key="item.id" to="/operations/apertures"
          class="grid gap-2 border-b border-[var(--dh-border)] px-4 py-3 last:border-0 hover:bg-[var(--dh-input)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)] md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] md:items-center md:gap-3">
          <strong class="truncate text-sm font-bold text-[var(--dh-text)]">{{ item.idtra }}</strong>
          <span class="text-sm text-[var(--dh-text-soft)]">{{ item.modalityCode }}</span>
          <span><DhBadge :variant="item.approvedReviews >= 2 ? 'success' : item.pendingReviews ? 'warning' : 'neutral'">{{ statusLabel(item.status) }}</DhBadge></span>
          <span class="text-sm tabular-nums text-[var(--dh-text-soft)]">{{ item.approvedReviews }} / 2</span>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ dateLabel(item.createdAtUtc) }}</span>
        </RouterLink>
      </div>
      <p v-if="data && data.stats.total > data.items.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">{{ t('operations.dashboard.showingRecent') }}</p>
    </DhCard>
  </section>
</template>
