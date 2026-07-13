<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Inbox,
  Mail,
  Paperclip,
  RefreshCw,
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

const columns: DhTableColumn<EmailMessageDto>[] = [
  { key: 'sender', label: 'Remitente' },
  { key: 'subject', label: 'Correo' },
  { key: 'receivedAt', label: 'Recibido' },
  { key: 'confidence', label: 'Confianza', align: 'center' },
  { key: 'status', label: 'Extracción', align: 'center' },
  { key: 'pricing', label: 'Pricing', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: '96px' },
]

const statusOptions = [
  { label: 'Todos los estados', value: '' },
  { label: 'Recibidos', value: 'Received' },
  { label: 'En cola', value: 'Queued' },
  { label: 'Procesando', value: 'Processing' },
  { label: 'Extraídos', value: 'Extracted' },
  { label: 'Necesitan revisión', value: 'NeedsReview' },
  { label: 'Fallidos', value: 'Failed' },
  { label: 'Ignorados', value: 'Ignored' },
  { label: 'Duplicados', value: 'Duplicated' },
]

const accountOptions = computed(() => [
  { label: 'Todas las cuentas', value: '' },
  ...accounts.value.map((account) => ({
    label: `${account.name} · ${account.emailAddress}`,
    value: account.id,
  })),
])

const latestJobByMessage = computed(() => {
  const result = new Map<string, EmailExtractionJobDto>()
  for (const job of jobs.value) {
    if (!result.has(job.emailMessageId)) result.set(job.emailMessageId, job)
  }
  return result
})

const summary = computed(() => {
  const sentMessageIds = new Set(
    jobs.value.filter((job) => job.status === 'SentToPricing').map((job) => job.emailMessageId),
  )
  const inProgress = rows.value.filter((message) =>
    ['Received', 'Queued', 'Processing'].includes(message.status),
  ).length
  const review = rows.value.filter((message) => message.status === 'NeedsReview').length
  const failed = rows.value.filter((message) => message.status === 'Failed').length

  return { sent: sentMessageIds.size, inProgress, review, failed }
})

const accountWithError = computed(() => accounts.value.find((account) => account.lastSyncError))

function accountName(id: string) {
  return accounts.value.find((account) => account.id === id)?.name ?? 'Cuenta de correo'
}

function messageStatusLabel(status: EmailMessageStatus | string) {
  return (
    {
      Received: 'Recibido',
      Queued: 'En cola',
      Processing: 'Procesando',
      Extracted: 'Extraído',
      NeedsReview: 'Necesita revisión',
      Ignored: 'Ignorado',
      Duplicated: 'Duplicado',
      Failed: 'Fallido',
    } as Record<string, string>
  )[status] ?? status
}

function jobStatusLabel(status: EmailExtractionJobStatus | string) {
  return (
    {
      Pending: 'Pendiente',
      Processing: 'Procesando',
      SentToPricing: 'Enviado',
      NeedsReview: 'No enviado',
      Failed: 'Falló',
      Ignored: 'Ignorado',
    } as Record<string, string>
  )[status] ?? status
}

function statusVariant(status: string) {
  if (status === 'Extracted' || status === 'SentToPricing') return 'success' as const
  if (status === 'Failed') return 'danger' as const
  if (status === 'NeedsReview' || status === 'Queued' || status === 'Pending') return 'warning' as const
  if (status === 'Processing' || status === 'Received') return 'primary' as const
  return 'neutral' as const
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CR', {
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
    if (!silent) toastStore.backendError(error, 'No se pudo cargar la bandeja de correos.')
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
  drawerStore.open({
    title: 'Detalle del correo de tarifas',
    component: PricingEmailMessageDrawer,
    size: 'xl',
    props: {
      message,
      onReprocessed: () => load(true),
      onOpenPricing: openPricingBatch,
    },
  })
}

async function reprocess(message: EmailMessageDto) {
  if (message.status !== 'NeedsReview' && message.status !== 'Failed') return

  try {
    await EmailExtractionService.reprocessMessage(message.id)
    toastStore.success(
      'Correo enviado a reproceso',
      'La extracción se ejecutará nuevamente y se enviará a Pricing si supera la confianza configurada.',
    )
    await load(true)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo reprocesar el correo.')
  }
}

function openPricingBatch(batchId: string) {
  drawerStore.close()
  router.push({ path: '/pricing/imports', query: { importBatchId: batchId } })
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
  <section class="space-y-6">
    <DhPageHeader
      title="Correos de tarifas"
      subtitle="Siga cada correo desde la recepción hasta la creación del lote en Pricing."
      :icon="Mail"
    >
      <template #actions>
        <DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="refreshing"
          @click="load(true)"
        />
      </template>
    </DhPageHeader>

    <section
      v-if="accountWithError"
      class="rounded-[26px] border border-red-500/20 bg-red-500/10 p-5"
    >
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <h2 class="font-black text-[var(--dh-text)]">
            Error sincronizando {{ accountWithError.name }}
          </h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-soft)]">
            {{ accountWithError.lastSyncError }}
          </p>
          <p class="mt-2 text-xs font-bold text-[var(--dh-text-muted)]">
            Último intento: {{ formatDateTime(accountWithError.lastSyncAt) }}
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Enviados a Pricing
          </p>
          <CheckCircle2 class="h-5 w-5 text-emerald-500" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.sent }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Últimos 100 trabajos</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            En proceso
          </p>
          <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.inProgress }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Página actual</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Por revisar
          </p>
          <AlertTriangle class="h-5 w-5 text-amber-500" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.review }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Página actual</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[26px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Fallidos
          </p>
          <Inbox class="h-5 w-5 text-red-500" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.failed }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Página actual</p>
      </article>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">Bandeja de extracción</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} correos · Actualización automática cada 30 segundos
            <span v-if="lastUpdatedAt">· {{ formatDateTime(lastUpdatedAt.toISOString()) }}</span>
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-3 xl:w-[760px]">
          <DhInput
            v-model="filters.search"
            type="search"
            label="Buscar"
            placeholder="Asunto o remitente"
            @keyup.enter="applyFilters"
          />
          <DhSelect
            v-model="filters.accountId"
            label="Cuenta"
            :options="accountOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.status"
            label="Estado"
            :options="statusOptions"
            placeholder=""
          />
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <DhButton label="Limpiar" variant="ghost" size="sm" @click="clearFilters" />
        <DhButton label="Aplicar filtros" size="sm" @click="applyFilters" />
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="rows"
          :loading="loading"
          empty-text="No hay correos de tarifas que coincidan con los filtros."
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
              :label="row.classificationConfidence == null ? 'Sin clasificar' : `${row.classificationConfidence.toFixed(1)}%`"
              :variant="confidenceVariant(row.classificationConfidence)"
            />
          </template>
          <template #cell-status="{ row }">
            <DhBadge :label="messageStatusLabel(row.status)" :variant="statusVariant(row.status)" />
          </template>
          <template #cell-pricing="{ row }">
            <DhBadge
              v-if="latestJob(row.id)"
              :label="jobStatusLabel(latestJob(row.id)!.status)"
              :variant="statusVariant(latestJob(row.id)!.status)"
            />
            <DhBadge
              v-else-if="row.status === 'Extracted'"
              label="Enviado"
              variant="success"
            />
            <span v-else class="text-xs font-semibold text-[var(--dh-text-muted)]">—</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-1" @click.stop>
              <button
                v-if="latestJob(row.id)?.pricingImportBatchId"
                type="button"
                class="rounded-2xl p-2 text-emerald-600 hover:bg-emerald-500/10"
                title="Ver lote en Pricing"
                @click="openPricingBatch(latestJob(row.id)!.pricingImportBatchId!)"
              >
                <ExternalLink class="h-4 w-4" />
              </button>
              <button
                v-if="row.status === 'NeedsReview' || row.status === 'Failed'"
                type="button"
                class="rounded-2xl p-2 text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.1)]"
                title="Reprocesar correo"
                @click="reprocess(row)"
              >
                <RefreshCw class="h-4 w-4" />
              </button>
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
