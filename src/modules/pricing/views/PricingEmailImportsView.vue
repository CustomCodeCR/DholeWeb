<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ArrowRight,
  ExternalLink,
  Inbox,
  Mail,
  Paperclip,
  RefreshCw,
  Send,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { EmailExtractionService } from '@/core/services/emailExtractionService'
import type {
  EmailAccountDto,
  EmailExtractionJobDto,
  EmailExtractionJobStatus,
  EmailMessageDto,
  EmailMessageStatus,
} from '@/core/interfaces/emailExtraction'
import PricingEmailMessageDrawer from '@/modules/pricing/components/PricingEmailMessageDrawer.vue'

const AUTO_REFRESH_MS = 30_000

const router = useRouter()
const { t, locale } = useI18n()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const rows = ref<EmailMessageDto[]>([])
const accounts = ref<EmailAccountDto[]>([])
const jobs = ref<EmailExtractionJobDto[]>([])
const loading = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const lastUpdatedAt = ref<Date | null>(null)
let refreshTimer: number | undefined

const filters = reactive({
  search: '',
  status: '' as EmailMessageStatus | '',
  accountId: '',
})


const columns = computed<DhTableColumn<EmailMessageDto>[]>(() => [
  { key: 'sender', label: t('pricingEmail.sender') },
  { key: 'subject', label: t('pricingEmail.subject') },
  { key: 'receivedAt', label: t('pricingEmail.received') },
  { key: 'confidence', label: t('pricingEmail.confidence'), align: 'center' },
  { key: 'status', label: t('pricingEmail.extraction'), align: 'center' },
  { key: 'pricing', label: t('pricingEmail.pricing'), align: 'center' },
  { key: 'actions', label: t('pricingEmail.nextAction'), align: 'right', width: '250px' },
])

const statusOptions = computed(() => [
  { label: t('pricingEmail.allStatuses'), value: '' },
  ...([
    ['Received', 'statusReceived'], ['Queued', 'statusQueued'], ['Processing', 'statusProcessing'],
    ['Extracted', 'statusExtracted'], ['NeedsReview', 'statusNeedsReview'],
    ['Failed', 'statusFailed'], ['Invalid', 'statusInvalid'], ['Ignored', 'statusIgnored'],
    ['Duplicated', 'statusDuplicated'],
  ] as const).map(([value, key]) => ({ value, label: t('pricingEmail.' + key) })),
])


const accountOptions = computed(() => [
  { label: t('pricingEmail.allAccounts'), value: '' },
  ...accounts.value.map((account) => ({
    label: `${account.name} · ${account.emailAddress}`,
    value: account.id,
  })),
])

const latestJobByMessage = computed(() => {
  const result = new Map<string, EmailExtractionJobDto>()
  for (const job of jobs.value) {
    const previous = result.get(job.emailMessageId)
    // The source email is already extracted when at least one of its jobs
    // reached Pricing. Show the successful batch, not a pending sibling.
    if (!previous || (job.status === 'SentToPricing' && previous.status !== 'SentToPricing')) {
      result.set(job.emailMessageId, job)
    }
  }
  return result
})

const summary = computed(() => {
  const sentMessageIds = new Set(
    jobs.value.filter((job) => job.status === 'SentToPricing').map((job) => job.emailMessageId),
  )
  const inProgress = rows.value.filter((message) =>
    ['Received', 'Queued', 'Processing'].includes(message.status)
      && !sentMessageIds.has(message.id),
  ).length
  const review = rows.value.filter((message) => message.status === 'NeedsReview').length
  const failed = rows.value.filter((message) => message.status === 'Failed').length

  return { sent: sentMessageIds.size, inProgress, review, failed }
})

const accountWithError = computed(() => accounts.value.find((account) => account.lastSyncError))


const nextAction = computed(() => {
  if (summary.value.review > 0) return {
    title: t(summary.value.review === 1 ? 'pricingEmail.needsReviewOne' : 'pricingEmail.needsReviewMany', { count: summary.value.review }),
    description: t('pricingEmail.needsReviewHint'),
    action: t('pricingEmail.showPending'),
    status: 'NeedsReview' as EmailMessageStatus,
  }
  if (summary.value.failed > 0) return {
    title: t(summary.value.failed === 1 ? 'pricingEmail.failedOne' : 'pricingEmail.failedMany', { count: summary.value.failed }),
    description: t('pricingEmail.failedHint'),
    action: t('pricingEmail.showFailed'),
    status: 'Failed' as EmailMessageStatus,
  }
  return {
    title: t('pricingEmail.noAction'),
    description: t('pricingEmail.noActionHint'),
    action: t('pricingEmail.viewAll'),
    status: '' as EmailMessageStatus | '',
  }
})


function focusStatus(status: EmailMessageStatus | '') {
  filters.status = status
  page.value = 1
  load()
}


function accountName(id: string) {
  return accounts.value.find((account) => account.id === id)?.name ?? t('pricingEmail.emailAccount')
}

const emailStatusKeys: Record<string, string> = {
  Received: 'statusReceived', Queued: 'statusQueued', Processing: 'statusProcessing',
  Extracted: 'statusExtracted', NeedsReview: 'statusNeedsReview', Ignored: 'statusIgnored',
  Duplicated: 'statusDuplicated', Failed: 'statusFailed', Invalid: 'statusInvalid',
}
const extractionStatusKeys: Record<string, string> = {
  Pending: 'jobPending', Processing: 'jobProcessing', Extracting: 'jobExtracting',
  AwaitingAi: 'jobAwaitingAi', AiProcessing: 'jobAiProcessing',
  ValidatingAiResult: 'jobValidatingAiResult', AwaitingPricing: 'jobAwaitingPricing',
  SentToPricing: 'jobSentToPricing', NeedsReview: 'jobNeedsReview',
  Failed: 'jobFailed', Ignored: 'jobIgnored',
}
function messageStatusLabel(status: EmailMessageStatus | string) {
  const key = emailStatusKeys[status]
  return key ? t('pricingEmail.' + key) : status
}
function jobStatusLabel(status: EmailExtractionJobStatus | string) {
  const key = extractionStatusKeys[status]
  return key ? t('pricingEmail.' + key) : status
}


function statusVariant(status: string) {
  if (status === 'Extracted' || status === 'SentToPricing') return 'success' as const
  if (status === 'Failed' || status === 'Invalid') return 'danger' as const
  if (status === 'NeedsReview' || status === 'Queued' || status === 'Pending') return 'warning' as const
  if (status === 'Processing' || status === 'Received' || status === 'AwaitingPricing') return 'primary' as const
  return 'neutral' as const
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function confidenceVariant(value?: number | null) {
  if (value == null) return 'neutral' as const
  if (value >= 80) return 'success' as const
  if (value >= 60) return 'warning' as const
  return 'danger' as const
}

function latestJob(messageId: string) {
  return latestJobByMessage.value.get(messageId)
}

async function load(silent = false) {
  if (loading.value || refreshing.value) return

  try {
    if (silent) refreshing.value = true
    else loading.value = true

    const [accountResult, messageResult, jobResult] = await Promise.all([
      EmailExtractionService.browseAccounts({ pageNumber: 1, pageSize: 100 }),
      EmailExtractionService.browseMessages({
        pageNumber: page.value,
        pageSize: pageSize.value,
        search: filters.search || undefined,
        status: filters.status || undefined,
        accountId: filters.accountId || undefined,
      }),
      EmailExtractionService.browseExtractionJobs({ pageNumber: 1, pageSize: 100 }),
    ])

    accounts.value = accountResult.items
    rows.value = messageResult.items
    jobs.value = jobResult.items
    total.value = messageResult.totalCount ?? messageResult.items.length
    lastUpdatedAt.value = new Date()
  } catch (error) {
    if (!silent) toastStore.backendError(error, t('pricingEmail.loadError'))
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  Object.assign(filters, { search: '', status: '', accountId: '' })
  applyFilters()
}

function openDetail(message: EmailMessageDto) {
  const job = latestJob(message.id)
  if (job?.pricingImportBatchId) {
    openPricingBatch(job.pricingImportBatchId)
    return
  }

  drawerStore.open({
    title: t('pricingEmail.detailTitle'),
    component: PricingEmailMessageDrawer,
    size: 'xl',
    props: {
      message,
      onReprocessed: () => load(true),
      onOpenPricing: openPricingBatch,
    },
  })
}

async function sendToPricingReview(message: EmailMessageDto) {
  const job = latestJob(message.id)
  if (job?.status !== 'NeedsReview' || !job.extractionExecutionId) {
    openDetail(message)
    return
  }

  try {
    const result = await EmailExtractionService.sendExtractionToPricing(job.id)
    if (result.pricingImportBatchId) {
      openPricingBatch(result.pricingImportBatchId)
      return
    }

    toastStore.info(
      t('pricingEmail.creatingReview'),
      t('pricingEmail.creatingReviewHint'),
    )

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      const detail = await EmailExtractionService.getMessage(message.id)
      const completed = detail.jobs.find(
        (item) => item.id === job.id && Boolean(item.pricingImportBatchId),
      )
      if (completed?.pricingImportBatchId) {
        await load(true)
        openPricingBatch(completed.pricingImportBatchId)
        return
      }
      if (completed?.status === 'Failed' || completed?.status === 'NeedsReview') break
    }

    await load(true)
    openDetail(message)
  } catch (error) {
    toastStore.backendError(error, t('pricingEmail.reviewError'))
  }
}

async function reprocess(message: EmailMessageDto) {
  if (message.status !== 'NeedsReview' && message.status !== 'Failed') return

  try {
    await EmailExtractionService.reprocessMessage(message.id)
    toastStore.success(
      t('pricingEmail.reprocessSuccess'),
      t('pricingEmail.reprocessHint'),
    )
    await load(true)
  } catch (error) {
    toastStore.backendError(error, t('pricingEmail.reprocessError'))
  }
}

function openPricingBatch(batchId: string) {
  drawerStore.close()
  router.push(`/pricing/imports/review/${batchId}`)
}

function scheduleRefresh() {
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) load(true)
  }, AUTO_REFRESH_MS)
}

watch([page, pageSize], () => load())
useViewShortcuts({ save: () => load(), refresh: () => load() })

onMounted(async () => {
  await load()
  scheduleRefresh()
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <section data-no-auto-translate class="space-y-6">
    <DhPageHeader
      :title="t('pricingEmail.title')"
      :subtitle="t('pricingEmail.subtitle')"
      :icon="Mail"
    >
      <template #actions>
        <DhButton
          :label="t('common.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="refreshing"
          @click="load(true)"
        />
      </template>
    </DhPageHeader>

    <section
      class="rounded-[28px] border border-[rgb(var(--dh-primary-rgb)/0.25)] bg-[rgb(var(--dh-primary-rgb)/0.07)] p-5"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[var(--dh-primary)] text-white">
            <ArrowRight class="h-5 w-5" />
          </div>
          <div>
            <p class="text-xs font-black uppercase tracking-[0.13em] text-[var(--dh-primary)]">{{ t('pricingEmail.whatNow') }}</p>
            <h2 class="mt-1 font-black text-[var(--dh-text)]">{{ nextAction.title }}</h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ nextAction.description }}</p>
          </div>
        </div>
        <DhButton :label="nextAction.action" variant="secondary" @click="focusStatus(nextAction.status)" />
      </div>
    </section>

    <section
      v-if="accountWithError"
      class="rounded-[26px] border border-red-500/20 bg-red-500/10 p-5"
    >
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <h2 class="font-black text-[var(--dh-text)]">
            {{ t('pricingEmail.syncError', { name: accountWithError.name }) }}
          </h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-soft)]">
            {{ accountWithError.lastSyncError }}
          </p>
          <p class="mt-2 text-xs font-bold text-[var(--dh-text-muted)]">
            {{ t('pricingEmail.lastAttempt') }}: {{ formatDateTime(accountWithError.lastSyncAt) }}
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ t('pricingEmail.sentToPricing') }}
          </p>
          <CheckCircle2 class="h-5 w-5 text-emerald-500" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.sent }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricingEmail.latest100Jobs') }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ t('pricingEmail.inProgress') }}
          </p>
          <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.inProgress }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricingEmail.currentPage') }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ t('pricingEmail.needsReview') }}
          </p>
          <AlertTriangle class="h-5 w-5 text-amber-500" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.review }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricingEmail.currentPage') }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ t('pricingEmail.failed') }}
          </p>
          <Inbox class="h-5 w-5 text-red-500" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.failed }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('pricingEmail.currentPage') }}</p>
      </article>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('pricingEmail.extractInbox') }}</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ t('pricingEmail.inboxRefresh', { count: total }) }}
            <span v-if="lastUpdatedAt">· {{ formatDateTime(lastUpdatedAt.toISOString()) }}</span>
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-3 xl:w-[760px]">
          <DhInput
            v-model="filters.search"
            type="search"
            :label="t('pricingEmail.search')"
            :placeholder="t('pricingEmail.subjectOrSender')"
            @keyup.enter="applyFilters"
          />
          <DhSelect
            v-model="filters.accountId"
            :label="t('pricingEmail.account')"
            :options="accountOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.status"
            :label="t('pricingEmail.status')"
            :options="statusOptions"
            placeholder=""
          />
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <DhButton :label="t('pricingEmail.clear')" variant="ghost" size="sm" @click="clearFilters" />
        <DhButton :label="t('pricingEmail.applyFilters')" size="sm" @click="applyFilters" />
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="rows"
          :loading="loading"
          :empty-text="t('pricingEmail.empty')"
          @row-click="openDetail"
        >
          <template #cell-sender="{ row }">
            <div class="max-w-56">
              <p class="truncate font-black text-[var(--dh-text)]">
                {{ row.fromName || row.fromAddress }}
              </p>
              <p class="truncate text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ row.fromAddress }}
              </p>
            </div>
          </template>
          <template #cell-subject="{ row }">
            <div class="max-w-72">
              <p class="truncate font-black text-[var(--dh-text)]">{{ row.subject }}</p>
              <div class="mt-1 flex items-center gap-2 text-xs font-semibold text-[var(--dh-text-muted)]">
                <span>{{ accountName(row.emailIngestionAccountId) }}</span>
                <Paperclip v-if="row.hasAttachments" class="h-3.5 w-3.5" />
              </div>
            </div>
          </template>
          <template #cell-receivedAt="{ row }">
            <span class="whitespace-nowrap text-xs font-bold">{{ formatDateTime(row.receivedAt) }}</span>
          </template>
          <template #cell-confidence="{ row }">
            <DhBadge
              :label="row.classificationConfidence == null ? t('pricingEmail.unclassified') : `${row.classificationConfidence.toFixed(1)}%`"
              :variant="confidenceVariant(row.classificationConfidence)"
            />
          </template>
          <template #cell-status="{ row }">
            <DhBadge :label="messageStatusLabel(row.status)" :variant="statusVariant(row.status)" />
          </template>
          <template #cell-pricing="{ row }">
            <DhBadge
              v-if="row.status === 'Extracted' || latestJob(row.id)?.status === 'SentToPricing'"
              :label="t('pricingEmail.sent')"
              variant="success"
            />
            <DhBadge
              v-else-if="latestJob(row.id)"
              :label="jobStatusLabel(latestJob(row.id)!.status)"
              :variant="statusVariant(latestJob(row.id)!.status)"
            />
            <span v-else class="text-xs font-semibold text-[var(--dh-text-muted)]">—</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex flex-wrap justify-end gap-2" @click.stop>
              <DhButton
                v-if="latestJob(row.id)?.pricingImportBatchId"
                :label="t('pricingEmail.openReview')"
                :icon="ExternalLink"
                size="sm"
                @click="openPricingBatch(latestJob(row.id)!.pricingImportBatchId!)"
              />
              <DhButton
                v-else-if="latestJob(row.id)?.status === 'NeedsReview' && latestJob(row.id)?.extractionExecutionId"
                :label="t('pricingEmail.createReview')"
                :icon="Send"
                size="sm"
                @click="sendToPricingReview(row)"
              />
              <DhButton
                v-if="row.status === 'NeedsReview' || row.status === 'Failed'"
                :label="t('pricingEmail.reprocess')"
                :icon="RefreshCw"
                size="sm"
                variant="ghost"
                @click="reprocess(row)"
              />
              <DhButton
                v-if="!latestJob(row.id)?.pricingImportBatchId && latestJob(row.id)?.status !== 'NeedsReview' && row.status !== 'Failed'"
                :label="t('pricingEmail.viewDetail')"
                size="sm"
                variant="ghost"
                @click="openDetail(row)"
              />
            </div>
          </template>
        </DhDataTable>
      </div>

      <div class="mt-5">
        <DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </section>
  </section>
</template>
