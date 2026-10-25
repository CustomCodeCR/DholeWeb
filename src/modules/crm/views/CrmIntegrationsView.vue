<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { useI18n } from 'vue-i18n'
import { crmEnabled, crmError, crmRequest, crmUuid } from '../services/crmApi'

interface DynamicsPreview {
  examined: number
  wouldCreate: number
  unchanged: number
  conflicts: number
  truncated: boolean
  metadataVersion: number
  reasons: Record<string, number>
}
interface SyncJob {
  id: string
  sourceSystem: string
  entityType: string
  status: string
  createdAt: string
  startedAt?: string | null
  finishedAt?: string | null
  processedCount: number
  createdCount: number
  unchangedCount: number
  conflictCount: number
  errorCount: number
  lastErrorCode?: string | null
}
interface SyncConflict {
  id: string
  entityType: string
  externalId: string
  existingEntityId?: string | null
  reasonCode: string
  resolution: string
}
interface ConflictPage { items: SyncConflict[]; total: number; page: number; pageSize: number }

const auth = useAuthStore()
const { t, locale } = useI18n()
const canRead = computed(() => crmEnabled() && auth.hasScope('crm.integration.read'))
const canManage = computed(() => canRead.value && auth.hasScope('crm.integration.manage'))
const jobs = ref<SyncJob[]>([])
const currentJob = ref<SyncJob | null>(null)
const conflicts = ref<SyncConflict[]>([])
const conflictPage = ref(1)
const conflictTotal = ref(0)
const preview = ref<DynamicsPreview | null>(null)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const pendingKey = ref(crmUuid())
const date = (value?: string | null) => value
  ? new Date(value).toLocaleString(locale.value === 'en' ? 'en-US' : 'es-CR')
  : '—'

async function refresh() {
  if (!canRead.value) return
  error.value = ''
  busy.value = true
  try {
    jobs.value = await crmRequest<SyncJob[]>('/api/crm/integrations/jobs')
    if (currentJob.value) {
      currentJob.value = jobs.value.find(x => x.id === currentJob.value?.id) ?? null
      if (currentJob.value) await loadConflicts(currentJob.value.id)
    }
  } catch (e) {
    error.value = crmError(e)
  } finally {
    busy.value = false
  }
}
async function dryRun() {
  if (!canManage.value || busy.value) return
  busy.value = true
  error.value = ''; notice.value = ''; preview.value = null
  try {
    preview.value = await crmRequest<DynamicsPreview>('/api/crm/integrations/dynamics/dry-run', 'POST')
  } catch (e) {
    error.value = crmError(e)
  } finally {
    busy.value = false
  }
}
async function enqueue() {
  if (!canManage.value || !preview.value || busy.value) return
  if (preview.value.truncated || preview.value.conflicts > 0) {
    error.value = t('crm.integration.reviewConflicts')
    return
  }
  if (!window.confirm(t('crm.integration.confirmImport'))) return
  busy.value = true
  error.value = ''; notice.value = ''
  try {
    await crmRequest('/api/crm/integrations/dynamics/run', 'POST', undefined, pendingKey.value)
    pendingKey.value = crmUuid()
    preview.value = null
    notice.value = t('crm.integration.queued')
    await refresh()
  } catch (e) {
    // Keep the same key if the POST may have committed before the connection failed.
    error.value = crmError(e)
  } finally {
    busy.value = false
  }
}
async function loadConflicts(id: string, page = 1) {
  if (!canRead.value) return
  error.value = ''
  try {
    const result = await crmRequest<ConflictPage>(
      '/api/crm/integrations/jobs/' + encodeURIComponent(id) + '/conflicts?page=' + page)
    conflicts.value = result.items
    conflictTotal.value = result.total
    conflictPage.value = result.page
  } catch (e) {
    conflicts.value = []
    error.value = crmError(e)
  }
}
async function selectJob(job: SyncJob) {
  currentJob.value = job
  conflicts.value = []
  await loadConflicts(job.id)
}
async function retry(job: SyncJob) {
  if (!canManage.value || busy.value || !['Failed', 'Paused'].includes(job.status)) return
  if (!window.confirm(t('crm.integration.confirmRetry'))) return
  busy.value = true
  error.value = ''; notice.value = ''
  try {
    await crmRequest('/api/crm/integrations/jobs/' + encodeURIComponent(job.id) + '/retry',
      'POST', undefined, crmUuid())
    notice.value = t('crm.integration.queued')
    await refresh()
  } catch (e) {
    error.value = crmError(e)
  } finally {
    busy.value = false
  }
}
onMounted(() => { if (canRead.value) void refresh() })
</script>

<template>
  <main class="mx-auto w-full max-w-6xl space-y-5 p-3 text-[var(--dh-text)] sm:p-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-black">{{ t('crm.integration.title') }}</h1>
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.integration.subtitle') }}</p>
      </div>
      <button v-if="canRead" class="rounded-xl border border-[var(--dh-border)] p-3"
        type="button" :disabled="busy" @click="refresh">{{ t('common.refresh') }}</button>
    </header>
    <p v-if="!canRead" role="alert">{{ t('crm.denied') }}</p>
    <template v-else>
      <p v-if="error" role="alert" class="rounded-xl border border-red-400 p-3 text-red-600">{{ error }}</p>
      <p v-if="notice" role="status" class="rounded-xl border border-[var(--dh-border)] p-3">{{ notice }}</p>
      <p v-if="busy" role="status">{{ t('common.loading') }}</p>
      <section v-if="canManage" class="space-y-3 rounded-2xl border border-[var(--dh-border)] p-4">
        <h2 class="font-bold">{{ t('crm.integration.previewTitle') }}</h2>
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.integration.previewExplanation') }}</p>
        <div class="flex flex-wrap gap-2">
          <button class="rounded-xl bg-[var(--dh-primary)] px-4 py-2 font-bold text-white"
            :disabled="busy" @click="dryRun">{{ t('crm.integration.dryRun') }}</button>
          <button class="rounded-xl border border-[var(--dh-border)] px-4 py-2 font-bold"
            :disabled="busy || !preview || preview.truncated || preview.conflicts > 0"
            @click="enqueue">{{ t('crm.integration.import') }}</button>
        </div>
        <div v-if="preview" class="grid grid-cols-2 gap-3 sm:grid-cols-4" role="status">
          <div v-for="entry in [
            { label: t('crm.integration.examined'), value: preview.examined },
            { label: t('crm.integration.creates'), value: preview.wouldCreate },
            { label: t('crm.integration.unchanged'), value: preview.unchanged },
            { label: t('crm.integration.conflicts'), value: preview.conflicts },
          ]" :key="entry.label" class="rounded-xl border border-[var(--dh-border)] p-3">
            <p class="text-xs text-[var(--dh-text-muted)]">{{ entry.label }}</p>
            <p class="text-xl font-black">{{ entry.value }}</p>
          </div>
        </div>
        <p v-if="preview?.truncated" class="text-sm text-amber-700">
          {{ t('crm.integration.previewTruncated') }}
        </p>
        <ul v-if="preview && Object.keys(preview.reasons).length" class="text-sm">
          <li v-for="(count, reason) in preview.reasons" :key="reason">{{ reason }}: {{ count }}</li>
        </ul>
      </section>
      <section class="space-y-3 rounded-2xl border border-[var(--dh-border)] p-4">
        <h2 class="font-bold">{{ t('crm.integration.jobs') }}</h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[650px] text-left text-sm">
            <thead><tr>
              <th class="p-2">{{ t('crm.integration.created') }}</th>
              <th class="p-2">{{ t('crm.integration.status') }}</th>
              <th class="p-2">{{ t('crm.integration.examined') }}</th>
              <th class="p-2">{{ t('crm.integration.creates') }}</th>
              <th class="p-2">{{ t('crm.integration.conflicts') }}</th>
              <th class="p-2">{{ t('common.actions') }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="job in jobs" :key="job.id" class="border-t border-[var(--dh-border)]">
                <td class="p-2">{{ date(job.createdAt) }}</td>
                <td class="p-2">{{ job.status }}</td>
                <td class="p-2">{{ job.processedCount }}</td>
                <td class="p-2">{{ job.createdCount }}</td>
                <td class="p-2">{{ job.conflictCount }}</td>
                <td class="flex flex-wrap gap-2 p-2">
                  <button class="underline" @click="selectJob(job)">{{ t('common.details') }}</button>
                  <button v-if="canManage && ['Failed','Paused'].includes(job.status)"
                    class="underline" :disabled="busy" @click="retry(job)">{{ t('crm.integration.retry') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!jobs.length" class="p-3 text-sm">{{ t('common.noData') }}</p>
        </div>
      </section>
      <section v-if="currentJob" class="space-y-3 rounded-2xl border border-[var(--dh-border)] p-4">
        <h2 class="font-bold">{{ t('crm.integration.conflictList') }} · {{ currentJob.id }}</h2>
        <p v-if="currentJob.lastErrorCode" class="text-sm text-amber-700">
          {{ currentJob.lastErrorCode }}
        </p>
        <p v-for="row in conflicts" :key="row.id" class="border-b border-[var(--dh-border)] p-2 text-sm">
          {{ row.entityType }} · {{ row.externalId }} · {{ row.reasonCode }}
          <span class="text-[var(--dh-text-muted)]"> ({{ row.resolution }})</span>
        </p>
        <p v-if="!conflicts.length" class="text-sm">{{ t('common.noData') }}</p>
        <div class="flex items-center gap-3 text-sm">
          <button class="underline" :disabled="conflictPage <= 1"
            @click="loadConflicts(currentJob.id, conflictPage - 1)">‹</button>
          {{ conflictPage }} · {{ conflictTotal }}
          <button class="underline" :disabled="conflictPage * 50 >= conflictTotal"
            @click="loadConflicts(currentJob.id, conflictPage + 1)">›</button>
        </div>
      </section>
    </template>
  </main>
</template>
