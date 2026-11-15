<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, AlertTriangle, Clock3, Cpu, Database, ExternalLink, Mail, RefreshCw, RotateCcw, Search, ShieldAlert, XCircle } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { AI_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhCard, DhConfirmDialog } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'

type Source = 'extraction' | 'ai' | 'infrastructure'
type RowStatus = string
type Page<T> = { items: T[]; total: number; pageNumber: number; pageSize: number }
type ExtractionRow = {
  id: string; emailMessageId: string; emailAttachmentId?: string | null
  subject: string; sender: string; receivedAt: string; status: RowStatus
  attemptCount: number; confidenceScore?: number | null
  createdAtUtc: string; startedAt?: string | null; finishedAt?: string | null
  nextAttemptAtUtc?: string | null; leaseOwner?: string | null
  leaseExpiresAtUtc?: string | null; lastHeartbeatAtUtc?: string | null
  aiRequestId?: string | null; aiExecutionId?: string | null
  extractionExecutionId?: string | null; pricingRequestId?: string | null
  pricingImportBatchId?: string | null; lastErrorCode?: string | null
  errorMessage?: string | null
}
type AiRow = {
  jobId: string; requestId: string; emailExtractionJobId: string
  emailMessageId: string; emailAttachmentId?: string | null
  correlationId: string; status: RowStatus
  attemptCount: number; maxAttemptCount: number
  createdAtUtc: string; startedAtUtc?: string | null; completedAtUtc?: string | null
  nextAttemptAtUtc?: string | null; leaseOwner?: string | null
  leaseExpiresAtUtc?: string | null; lastHeartbeatAtUtc?: string | null
  aiExecutionId?: string | null; errorCode?: string | null; errorMessage?: string | null
}
type Overview = {
  generatedAtUtc: string; total: number; counts: Record<string, number>
  stuckLeases: number; oldestPendingUtc?: string | null
}
type AiState = {
  generatedAtUtc: string
  queue: {
    pending: number; processing: number; retryScheduled: number
    failed: number; reviewRequired: number; completed: number
  }
  redis: {
    available: boolean; stream: string; length?: number
    group?: { pending: number; lag?: number | null; consumerCount: number } | null
    error?: string
  }
  mongo: { available: boolean; executionSnapshots?: number; error?: string }
  ollama: Array<{ id: string; name: string; available: boolean; models?: Array<{ model?: string; name?: string }>; error?: string }>
}
type Selected = { source: 'extraction'; row: ExtractionRow } | { source: 'ai'; row: AiRow }

const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()
const modalStore = useModalStore()
const canOperate = computed(() => authStore.hasScope(AI_SCOPES.executions.cancel))
const active = ref<Source>('extraction')
const searchInput = ref('')
const search = ref('')
const status = ref('')
const stalledOnly = ref(false)
const page = ref(1)
const pageSize = 25
const loading = ref(false)
const actionKey = ref('')
const autoRefresh = ref(true)
const selected = ref<Selected | null>(null)
const warnings = ref<string[]>([])
const lastRefresh = ref('')
const overview = ref<Overview | null>(null)
const aiState = ref<AiState | null>(null)
const extractionPage = ref<Page<ExtractionRow>>({ items: [], total: 0, pageNumber: 1, pageSize })
const aiPage = ref<Page<AiRow>>({ items: [], total: 0, pageNumber: 1, pageSize })
let timer: number | undefined
let serial = 0

const extractionStatuses = [
  'Pending', 'Extracting', 'AwaitingAi', 'AiProcessing', 'ValidatingAiResult',
  'AwaitingPricing', 'SentToPricing', 'NeedsReview', 'Failed', 'Ignored',
]
const aiStatuses = ['Pending', 'Processing', 'RetryScheduled', 'Completed', 'Failed']
const availableStatuses = computed(() => active.value === 'ai' ? aiStatuses : extractionStatuses)
const currentTotal = computed(() => active.value === 'ai' ? aiPage.value.total : extractionPage.value.total)
const totalPages = computed(() => Math.max(1, Math.ceil(currentTotal.value / pageSize)))

function formatDate(date?: string | null) {
  if (!date) return '—'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'medium' })
}
function elapsed(date?: string | null) {
  if (!date) return '—'
  const ms = Date.now() - new Date(date).getTime()
  if (!Number.isFinite(ms)) return '—'
  if (ms < 60_000) return '<1 min'
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + ' min'
  return Math.floor(ms / 3_600_000) + ' h ' + Math.floor((ms % 3_600_000) / 60_000) + ' min'
}
function stuck(row: ExtractionRow | AiRow) {
  return Boolean(row.leaseExpiresAtUtc &&
    new Date(row.leaseExpiresAtUtc).getTime() < Date.now() &&
    ['Extracting', 'Processing'].includes(row.status))
}
function color(statusValue: string) {
  if (statusValue === 'Completed' || statusValue === 'SentToPricing') return 'success'
  if (statusValue === 'Failed') return 'danger'
  if (statusValue === 'NeedsReview' || statusValue === 'RetryScheduled' || statusValue === 'Pending') return 'warning'
  if (statusValue === 'Extracting' || statusValue === 'Processing' || statusValue === 'AiProcessing') return 'primary'
  return 'neutral'
}
function label(statusValue: string) {
  const labels: Record<string, string> = {
    Pending: 'Pendiente', Extracting: 'Extrayendo', Processing: 'Procesando',
    AwaitingAi: 'Esperando IA', AiProcessing: 'IA procesando', ValidatingAiResult: 'Validando IA',
    AwaitingPricing: 'Esperando Pricing', SentToPricing: 'Enviado a Pricing',
    NeedsReview: 'Revisión humana', Failed: 'Fallido', Ignored: 'Ignorado',
    RetryScheduled: 'Reintento programado', Completed: 'Completado',
  }
  return labels[statusValue] ?? statusValue
}
async function get<T>(path: string): Promise<T> {
  const result = await callEndpoint<unknown>({ method: 'GET', path, headers: { Accept: 'application/json' } })
  return unwrapApiResponse<T>(result as never)
}
async function refresh(silent = false) {
  if (loading.value && silent) return
  const request = ++serial
  if (!silent) loading.value = true
  const query = toQueryString({
    pageNumber: page.value, pageSize,
    status: status.value || undefined,
    search: search.value || undefined,
    ...(active.value === 'extraction' && stalledOnly.value ? { stalled: true } : {}),
  })
  const jobsPath = active.value === 'ai'
    ? '/api/ai/operations/jobs/search' + query
    : '/api/data-extraction/email/queue/jobs' + query
  const [data, extractionStats, aiStats] = await Promise.allSettled([
    active.value === 'infrastructure' ? Promise.resolve(null) : get<Page<ExtractionRow> | Page<AiRow>>(jobsPath),
    get<Overview>('/api/data-extraction/email/queue/overview'),
    get<AiState>('/api/ai/operations/state?take=1'),
  ])
  if (request !== serial) return
  const failures: string[] = []
  if (data.status === 'fulfilled' && data.value) {
    if (active.value === 'ai') aiPage.value = data.value as Page<AiRow>
    else extractionPage.value = data.value as Page<ExtractionRow>
  } else if (data.status === 'rejected') failures.push('No se pudo consultar el historial de trabajos.')
  if (extractionStats.status === 'fulfilled') overview.value = extractionStats.value
  else failures.push('DataExtraction no responde o no hay permiso de lectura.')
  if (aiStats.status === 'fulfilled') aiState.value = aiStats.value
  else failures.push('No se pudo consultar AI / Redis / Ollama.')
  warnings.value = failures
  lastRefresh.value = new Date().toISOString()
  loading.value = false
}
function applyFilters() {
  search.value = searchInput.value.trim()
  page.value = 1
  selected.value = null
  void refresh()
}
function navigatePage(next: number) {
  page.value = Math.max(1, Math.min(totalPages.value, next))
  selected.value = null
  void refresh()
}
function switchTab(next: Source) {
  active.value = next
  status.value = ''
  stalledOnly.value = false
  page.value = 1
  selected.value = null
  void refresh()
}
function confirmAction(title: string, message: string, action: () => Promise<void>, danger = false) {
  modalStore.open({
    title, component: DhConfirmDialog, size: 'md',
    props: {
      title, message, confirmLabel: 'Confirmar', cancelLabel: 'Volver', danger,
      onConfirm: async () => {
        await action()
        if (!actionKey.value) modalStore.close()
      },
      onCancel: () => modalStore.close(),
    },
  })
}
async function execute(source: 'extraction' | 'ai', jobId: string, operation: 'retry' | 'cancel') {
  if (actionKey.value || !canOperate.value) return
  actionKey.value = jobId
  const base = source === 'extraction'
    ? '/api/data-extraction/email/queue/jobs/'
    : '/api/ai/operations/jobs/'
  try {
    await callEndpoint({ method: 'POST', path: base + encodeURIComponent(jobId) + '/' + operation, headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }, { body: {} })
    toastStore.success('Acción aceptada', 'El estado se actualizó en el servicio. Compruebe la siguiente ejecución.')
    selected.value = null
  } catch (error) {
    toastStore.backendError(error, 'No se pudo modificar el trabajo')
  } finally {
    actionKey.value = ''
    await refresh(true)
  }
}
function retryExtraction(row: ExtractionRow) {
  if (!['Failed', 'NeedsReview'].includes(row.status) || row.pricingRequestId || row.pricingImportBatchId) return
  confirmAction('Reprocesar extracción', 'Se reutilizará el mismo trabajo para evitar importaciones duplicadas a Pricing. ¿Continuar?', () => execute('extraction', row.id, 'retry'))
}
function retryAi(row: AiRow) {
  if (row.status !== 'Failed') return
  confirmAction('Reintentar análisis IA', 'Se reprogramará únicamente este trabajo fallido. ¿Continuar?', () => execute('ai', row.jobId, 'retry'))
}
function cancelAi(row: AiRow) {
  if (!['Pending', 'RetryScheduled'].includes(row.status)) return
  confirmAction('Retirar trabajo de IA', 'Solo se puede retirar un trabajo no reclamado por el worker. Esta acción afecta el procesamiento del correo.', () => execute('ai', row.jobId, 'cancel'), true)
}
onMounted(() => {
  void refresh()
  timer = window.setInterval(() => {
    if (autoRefresh.value && document.visibilityState === 'visible' && !actionKey.value) void refresh(true)
  }, 30000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  serial++
})
</script>

<template>
  <section class="space-y-5 p-1">
    <DhPageHeader title="Centro de colas" subtitle="Seguimiento operativo de correos, extracción, IA, Redis y Ollama desde registros reales.">
      <template #actions>
        <label class="flex items-center gap-2 text-sm font-semibold text-[var(--dh-text-muted)]">
          <input v-model="autoRefresh" type="checkbox" class="accent-[var(--dh-primary)]" />
          Actualizar cada 30 s
        </label>
        <DhButton variant="secondary" :disabled="loading" @click="refresh()"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /> Actualizar</DhButton>
      </template>
    </DhPageHeader>

    <div v-if="warnings.length" class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div class="flex items-center gap-2 font-semibold text-[var(--dh-text)]"><AlertTriangle class="h-4 w-4 text-amber-500" /> Lectura parcial de los servicios</div>
      <p v-for="warning in warnings" :key="warning" class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ warning }}</p>
    </div>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DhCard padding="sm">
        <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]"><span>Extracción pendiente</span><Mail class="h-4 w-4" /></div>
        <p class="mt-2 text-3xl font-black">{{ overview?.counts.Pending ?? '—' }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Más antiguo: {{ elapsed(overview?.oldestPendingUtc) }}</p>
      </DhCard>
      <DhCard padding="sm">
        <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]"><span>IA en cola</span><Cpu class="h-4 w-4" /></div>
        <p class="mt-2 text-3xl font-black">{{ aiState?.queue.pending ?? '—' }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Procesando: {{ aiState?.queue.processing ?? '—' }} · Reintentos: {{ aiState?.queue.retryScheduled ?? '—' }}</p>
      </DhCard>
      <DhCard padding="sm">
        <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]"><span>Revisión / fallos</span><AlertTriangle class="h-4 w-4" /></div>
        <p class="mt-2 text-3xl font-black">{{ overview ? (overview.counts.NeedsReview ?? 0) + (overview.counts.Failed ?? 0) : '—' }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">IA: {{ (aiState?.queue.failed ?? 0) + (aiState?.queue.reviewRequired ?? 0) }} · Leases vencidos: {{ overview?.stuckLeases ?? '—' }}</p>
      </DhCard>
      <DhCard padding="sm">
        <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]"><span>Redis Streams</span><Database class="h-4 w-4" /></div>
        <p class="mt-2 text-3xl font-black">{{ aiState?.redis.group?.lag ?? '—' }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Lag · Sin ACK: {{ aiState?.redis.group?.pending ?? '—' }}</p>
      </DhCard>
    </section>

    <div class="flex flex-wrap items-center gap-2 border-b border-[var(--dh-border)] pb-3">
      <DhButton :variant="active === 'extraction' ? 'primary' : 'secondary'" @click="switchTab('extraction')">Extracción / Correos</DhButton>
      <DhButton :variant="active === 'ai' ? 'primary' : 'secondary'" @click="switchTab('ai')">Cola de IA</DhButton>
      <DhButton :variant="active === 'infrastructure' ? 'primary' : 'secondary'" @click="switchTab('infrastructure')">Infraestructura</DhButton>
      <span class="ml-auto text-xs text-[var(--dh-text-muted)]">Datos actualizados: {{ formatDate(lastRefresh) }}</span>
    </div>

    <template v-if="active !== 'infrastructure'">
      <DhCard padding="sm">
        <div class="flex flex-wrap items-end gap-3">
          <label class="min-w-[220px] flex-1 text-xs font-semibold text-[var(--dh-text-muted)]">Buscar asunto, remitente, correlación o UUID
            <div class="mt-1 flex overflow-hidden rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)]">
              <input v-model="searchInput" class="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-[var(--dh-text)] outline-none" placeholder="Buscar trabajos..." @keyup.enter="applyFilters" />
              <button class="border-l border-[var(--dh-border)] px-3" title="Buscar" @click="applyFilters"><Search class="h-4 w-4" /></button>
            </div>
          </label>
          <label class="text-xs font-semibold text-[var(--dh-text-muted)]">Estado
            <select v-model="status" class="mt-1 block min-w-44 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2.5 text-sm text-[var(--dh-text)]" @change="page = 1; refresh()">
              <option value="">Todos</option>
              <option v-for="item in availableStatuses" :key="item" :value="item">{{ label(item) }}</option>
            </select>
          </label>
          <label v-if="active === 'extraction'" class="flex items-center gap-2 pb-2 text-sm text-[var(--dh-text-muted)]">
            <input v-model="stalledOnly" type="checkbox" @change="page = 1; refresh()" /> Solo leases vencidos
          </label>
          <span class="pb-2 text-xs font-semibold text-[var(--dh-text-muted)]">{{ currentTotal }} registros</span>
        </div>
      </DhCard>

      <DhCard padding="none">
        <div class="overflow-x-auto">
          <table class="min-w-[950px] w-full text-left text-sm">
            <thead class="border-b border-[var(--dh-border)] bg-black/5 text-xs uppercase tracking-wide text-[var(--dh-text-muted)] dark:bg-white/5">
              <tr><th class="p-3">Trabajo / origen</th><th class="p-3">Estado</th><th class="p-3">Intentos</th><th class="p-3">Inicio / antigüedad</th><th class="p-3">Diagnóstico</th><th class="p-3 text-right">Acciones</th></tr>
            </thead>
            <tbody v-if="active === 'extraction'">
              <tr v-for="job in extractionPage.items" :key="job.id" class="border-b border-[var(--dh-border)] align-top hover:bg-black/5 dark:hover:bg-white/5">
                <td class="p-3"><button class="max-w-[300px] text-left font-semibold text-[var(--dh-text)] hover:underline" @click="selected = { source: 'extraction', row: job }">{{ job.subject || 'Sin asunto' }}</button><div class="max-w-[300px] truncate text-xs text-[var(--dh-text-muted)]">{{ job.sender }}</div><div class="mt-1 font-mono text-[10px] text-[var(--dh-text-muted)]">{{ job.id }}</div></td>
                <td class="p-3"><DhBadge :variant="color(job.status)">{{ label(job.status) }}</DhBadge><div v-if="stuck(job)" class="mt-1 text-xs font-bold text-red-500">Lease vencido</div></td>
                <td class="p-3">{{ job.attemptCount }}</td>
                <td class="p-3 text-xs">{{ formatDate(job.createdAtUtc) }}<div class="mt-1 text-[var(--dh-text-muted)]">{{ elapsed(job.createdAtUtc) }}</div></td>
                <td class="max-w-[260px] p-3 text-xs"><div class="truncate text-red-500">{{ job.lastErrorCode || job.errorMessage || 'Sin errores' }}</div><div class="mt-1 text-[var(--dh-text-muted)]">AI: {{ job.aiRequestId ? job.aiRequestId.slice(0, 8) : '—' }}</div></td>
                <td class="p-3 text-right"><DhButton v-if="canOperate && ['Failed', 'NeedsReview'].includes(job.status) && !job.pricingRequestId && !job.pricingImportBatchId" size="sm" variant="secondary" :disabled="!!actionKey" @click="retryExtraction(job)"><RotateCcw class="h-3.5 w-3.5" /> Reintentar</DhButton><DhButton v-else size="sm" variant="secondary" @click="selected = { source: 'extraction', row: job }">Detalles</DhButton></td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr v-for="job in aiPage.items" :key="job.jobId" class="border-b border-[var(--dh-border)] align-top hover:bg-black/5 dark:hover:bg-white/5">
                <td class="p-3"><button class="text-left font-mono text-xs font-semibold text-[var(--dh-text)] hover:underline" @click="selected = { source: 'ai', row: job }">{{ job.jobId }}</button><div class="mt-1 text-xs text-[var(--dh-text-muted)]">Correo: {{ job.emailMessageId }}</div><div class="truncate text-xs text-[var(--dh-text-muted)]">{{ job.correlationId }}</div></td>
                <td class="p-3"><DhBadge :variant="color(job.status)">{{ label(job.status) }}</DhBadge><div v-if="stuck(job)" class="mt-1 text-xs font-bold text-red-500">Lease vencido</div></td>
                <td class="p-3">{{ job.attemptCount }} / {{ job.maxAttemptCount }}</td>
                <td class="p-3 text-xs">{{ formatDate(job.createdAtUtc) }}<div class="mt-1 text-[var(--dh-text-muted)]">{{ elapsed(job.createdAtUtc) }}</div></td>
                <td class="max-w-[260px] p-3 text-xs"><div class="truncate text-red-500">{{ job.errorCode || job.errorMessage || 'Sin errores' }}</div><div class="mt-1 text-[var(--dh-text-muted)]">Lease: {{ formatDate(job.leaseExpiresAtUtc) }}</div></td>
                <td class="p-3 text-right"><div class="flex justify-end gap-1"><DhButton v-if="canOperate && job.status === 'Failed'" size="sm" variant="secondary" :disabled="!!actionKey" @click="retryAi(job)">Reintentar</DhButton><DhButton v-if="canOperate && ['Pending','RetryScheduled'].includes(job.status)" size="sm" variant="secondary" :disabled="!!actionKey" @click="cancelAi(job)">Retirar</DhButton><DhButton size="sm" variant="secondary" @click="selected = { source: 'ai', row: job }">Detalles</DhButton></div></td>
              </tr>
            </tbody>
          </table>
          <div v-if="!(active === 'ai' ? aiPage.items.length : extractionPage.items.length)" class="px-5 py-12 text-center text-sm text-[var(--dh-text-muted)]">No hay registros para los filtros seleccionados.</div>
        </div>
        <div class="flex items-center justify-between gap-3 p-4 text-sm text-[var(--dh-text-muted)]">
          <span>Página {{ page }} de {{ totalPages }}</span>
          <div class="flex gap-2"><DhButton variant="secondary" size="sm" :disabled="page <= 1" @click="navigatePage(page - 1)">Anterior</DhButton><DhButton variant="secondary" size="sm" :disabled="page >= totalPages" @click="navigatePage(page + 1)">Siguiente</DhButton></div>
        </div>
      </DhCard>

      <DhCard v-if="selected" padding="md">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dh-border)] pb-3">
          <div><h2 class="font-bold">Trazabilidad completa del trabajo</h2><p class="text-xs text-[var(--dh-text-muted)]">Identificadores, tiempos, error y vínculos entre servicios</p></div>
          <DhButton variant="secondary" size="sm" @click="selected = null">Cerrar</DhButton>
        </div>
        <dl class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <template v-for="[field, value] in Object.entries(selected.row)" :key="field">
            <div v-if="value !== null && value !== undefined && value !== ''" class="min-w-0">
              <dt class="text-xs font-bold uppercase tracking-wide text-[var(--dh-text-muted)]">{{ field }}</dt>
              <dd class="mt-1 break-all font-mono text-xs">{{ value }}</dd>
            </div>
          </template>
        </dl>
        <div class="mt-4 flex flex-wrap gap-2 border-t border-[var(--dh-border)] pt-4">
          <DhButton variant="secondary" @click="router.push('/pricing/email-imports')"><ExternalLink class="h-4 w-4" /> Historial de correos</DhButton>
          <DhButton v-if="selected.source === 'extraction' && selected.row.pricingImportBatchId" variant="secondary" @click="router.push('/pricing/imports/review/' + selected.row.pricingImportBatchId)">Ver importación Pricing</DhButton>
        </div>
      </DhCard>
    </template>

    <section v-else class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <DhCard padding="md">
        <div class="flex items-center gap-2 font-bold"><Database class="h-5 w-5" /> Redis Streams</div>
        <p class="mt-3 text-sm">Estado: <DhBadge :variant="aiState?.redis.available ? 'success' : 'danger'">{{ aiState?.redis.available ? 'Conectado' : 'No disponible' }}</DhBadge></p>
        <p class="mt-2 break-all text-sm">Stream: {{ aiState?.redis.stream ?? '—' }}</p>
        <p class="mt-2 text-sm">Longitud: {{ aiState?.redis.length ?? '—' }}</p>
        <p class="mt-2 text-sm">Pendiente de ACK: {{ aiState?.redis.group?.pending ?? '—' }}</p>
        <p class="mt-2 text-sm">Lag: {{ aiState?.redis.group?.lag ?? '—' }}</p>
        <p class="mt-2 text-sm">Consumidores: {{ aiState?.redis.group?.consumerCount ?? '—' }}</p>
        <p v-if="aiState?.redis.error" class="mt-2 break-all text-xs text-red-500">{{ aiState.redis.error }}</p>
      </DhCard>
      <DhCard padding="md">
        <div class="flex items-center gap-2 font-bold"><Database class="h-5 w-5" /> MongoDB</div>
        <p class="mt-3 text-sm">Estado: <DhBadge :variant="aiState?.mongo.available ? 'success' : 'danger'">{{ aiState?.mongo.available ? 'Conectado' : 'No disponible' }}</DhBadge></p>
        <p class="mt-2 text-sm">Ejecuciones archivadas: {{ aiState?.mongo.executionSnapshots ?? '—' }}</p>
        <p v-if="aiState?.mongo.error" class="mt-2 break-all text-xs text-red-500">{{ aiState.mongo.error }}</p>
      </DhCard>
      <DhCard padding="md">
        <div class="flex items-center gap-2 font-bold"><Cpu class="h-5 w-5" /> Ollama / IA local</div>
        <div v-for="item in aiState?.ollama ?? []" :key="item.id" class="mt-3 border-b border-[var(--dh-border)] pb-3">
          <div class="flex items-center justify-between gap-2"><span class="font-semibold">{{ item.name }}</span><DhBadge :variant="item.available ? 'success' : 'danger'">{{ item.available ? 'Conectado' : 'Error' }}</DhBadge></div>
          <p v-for="model in item.models ?? []" :key="model.model || model.name" class="mt-1 break-all font-mono text-xs text-[var(--dh-text-muted)]">{{ model.model || model.name }}</p>
          <p v-if="item.error" class="mt-1 text-xs text-red-500">{{ item.error }}</p>
        </div>
      </DhCard>
    </section>

    <p class="flex items-start gap-2 text-xs text-[var(--dh-text-muted)]"><ShieldAlert class="mt-0.5 h-4 w-4 shrink-0" /> El panel consulta PostgreSQL, Redis y Ollama. No elimina eventos de Redis ni borra históricos. Un reintento nunca autoriza duplicar una importación a Pricing; el servidor valida su estado real antes de aceptarlo.</p>
  </section>
</template>
