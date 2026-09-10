<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Activity,
  AlertTriangle,
  Bot,
  Database,
  Eraser,
  HardDrive,
  HelpCircle,
  Link2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  Unplug,
} from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import type { Endpoint } from '@/core/composables/endpoints'
import { AI_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhBadge, DhButton, DhSpinner, DhSwitch, DhTooltip } from '@/shared/components/atoms'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { DhPageHeader } from '@/shared/components/organisms'

type JobStatus = 'Pending' | 'Processing' | 'RetryScheduled' | 'Failed' | 'Completed' | string

type AttemptTrace = {
  attemptId: string
  attemptNumber: number
  status: string
  modelId: string
  modelName?: string | null
  externalModelId: string
  connectionId: string
  connectionName?: string | null
  providerType: string
  startedAtUtc: string
  completedAtUtc?: string | null
  durationMilliseconds: number
  errorCode?: string | null
  errorMessage?: string | null
}

type ExecutionTrace = {
  executionId: string
  status: string
  executionType: string
  profileKey: string
  requestHash?: string | null
  startedAtUtc?: string | null
  completedAtUtc?: string | null
  durationMilliseconds: number
  errorCode?: string | null
  errorMessage?: string | null
  attempt?: AttemptTrace | null
}

type QueueItem = {
  jobId: string
  requestId: string
  emailExtractionJobId: string
  emailMessageId: string
  emailAttachmentId?: string | null
  correlationId: string
  requestHash: string
  status: JobStatus
  attemptCount: number
  maxAttemptCount: number
  nextAttemptAtUtc?: string | null
  leaseOwner?: string | null
  leaseExpiresAtUtc?: string | null
  lastHeartbeatAtUtc?: string | null
  aiExecutionId?: string | null
  startedAtUtc?: string | null
  completedAtUtc?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  executions: ExecutionTrace[]
}

type RedisConsumer = {
  name: string
  pending: number
  idleMilliseconds: number
}

type RedisState = {
  available: boolean
  stream: string
  length?: number
  group?: {
    name: string
    consumerCount: number
    pending: number
    lastDeliveredId: string
    entriesRead?: number | null
    lag?: number | null
  } | null
  consumers?: RedisConsumer[]
  error?: string
}

type MongoState = {
  available: boolean
  executionSnapshots?: number
  error?: string
}

type OllamaLoadedModel = {
  name?: string | null
  model?: string | null
  size?: number | null
  sizeVram?: number | null
  expiresAt?: string | null
}

type OllamaConnection = {
  id: string
  name: string
  baseUrl: string
  available: boolean
  models?: OllamaLoadedModel[]
  error?: string
}

type OperationsState = {
  generatedAtUtc: string
  queue: {
    pending: number
    processing: number
    retryScheduled: number
    failed: number
    completed: number
    items: QueueItem[]
  }
  redis: RedisState
  mongo: MongoState
  ollama: OllamaConnection[]
}

type ConfirmActionOptions = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  action: () => Promise<boolean>
}

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }
const acceptJson = { Accept: 'application/json' }
const stateEndpoint = { method: 'GET', path: '/api/ai/operations/state?take=250', headers: acceptJson } satisfies Endpoint
const cancelJobEndpoint = { method: 'POST', path: '/api/ai/operations/jobs/{{jobId}}/cancel', headers: jsonHeaders } satisfies Endpoint
const retryJobEndpoint = { method: 'POST', path: '/api/ai/operations/jobs/{{jobId}}/retry', headers: jsonHeaders } satisfies Endpoint
const clearRedisEndpoint = { method: 'POST', path: '/api/ai/operations/redis/pending/clear', headers: jsonHeaders } satisfies Endpoint
const trimRedisEndpoint = { method: 'POST', path: '/api/ai/operations/redis/trim', headers: jsonHeaders } satisfies Endpoint
const purgeMongoEndpoint = { method: 'POST', path: '/api/ai/operations/mongo/execution-snapshots/purge', headers: jsonHeaders } satisfies Endpoint
const unloadOllamaEndpoint = { method: 'POST', path: '/api/ai/operations/ollama/models/{{modelId}}/unload', headers: jsonHeaders } satisfies Endpoint

const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const state = ref<OperationsState | null>(null)
const loading = ref(false)
const actionKey = ref('')
const autoRefresh = ref(true)
const expandedJobId = ref('')
let timer: number | undefined

const canOperate = computed(() => authStore.hasScope(AI_SCOPES.executions.cancel))
const activeItems = computed(() => state.value?.queue.items.filter((item) => item.status !== 'Failed') ?? [])
const failedItems = computed(() => state.value?.queue.items.filter((item) => item.status === 'Failed') ?? [])

function endpointModelId(externalModelId?: string | null) {
  if (!externalModelId || !state.value) return null
  for (const job of state.value.queue.items) {
    for (const execution of job.executions ?? []) {
      if (execution.attempt?.externalModelId === externalModelId) return execution.attempt.modelId
    }
  }
  return null
}

function badgeVariant(status: string) {
  if (status === 'Completed') return 'success'
  if (status === 'Processing' || status === 'Running') return 'primary'
  if (status === 'Pending' || status === 'RetryScheduled') return 'warning'
  if (status === 'Failed') return 'danger'
  return 'neutral'
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    Pending: 'En cola',
    Processing: 'Procesando',
    RetryScheduled: 'Reintento programado',
    Failed: 'Fallida',
    Completed: 'Completada',
    Running: 'Ejecutando',
    Cancelled: 'Cancelada',
  }
  return labels[status] ?? status
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
}

function formatDuration(milliseconds?: number | null) {
  if (!milliseconds) return '0 s'
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (minutes < 60) return `${minutes}m ${remaining}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatBytes(value?: number | null) {
  if (!value) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

async function refresh(showSpinner = true) {
  if (showSpinner) loading.value = true
  try {
    const response = await callEndpoint<unknown>(stateEndpoint)
    state.value = unwrapApiResponse<OperationsState>(response as never)
  } catch (error) {
    if (showSpinner) toastStore.backendError(error, 'No se pudo consultar el estado de la cola de IA.')
  } finally {
    loading.value = false
  }
}

async function runAction(
  key: string,
  action: () => Promise<unknown>,
  successTitle: string,
  successMessage: string,
) {
  if (actionKey.value) return false
  try {
    actionKey.value = key
    await action()
    toastStore.success(successTitle, successMessage)
    await refresh(false)
    return true
  } catch (error) {
    toastStore.backendError(error, 'La operación de IA no pudo completarse.')
    return false
  } finally {
    actionKey.value = ''
  }
}

function confirmAction(options: ConfirmActionOptions) {
  modalStore.open({
    title: options.title,
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel,
      cancelLabel: 'Cancelar',
      danger: options.danger ?? false,
      onConfirm: async () => {
        if (await options.action()) modalStore.close()
      },
      onCancel: () => modalStore.close(),
    },
  })
}

function cancelJob(item: QueueItem) {
  confirmAction({
    title: 'Retirar trabajo de la cola',
    message: `La solicitud ${item.requestId} quedará cancelada y no será enviada al modelo. El registro se conserva para trazabilidad.`,
    confirmLabel: 'Retirar',
    danger: true,
    action: () => runAction(
      `cancel:${item.jobId}`,
      () => callEndpoint(cancelJobEndpoint, { params: { jobId: item.jobId }, body: {} }),
      'Trabajo retirado',
      'El trabajo ya no será enviado al modelo.',
    ),
  })
}

function retryJob(item: QueueItem) {
  return runAction(
    `retry:${item.jobId}`,
    () => callEndpoint(retryJobEndpoint, { params: { jobId: item.jobId }, body: {} }),
    'Trabajo reencolado',
    'El trabajo volverá a ser procesado por la IA.',
  )
}

function clearRedisPending() {
  confirmAction({
    title: 'Limpiar mensajes pending de Redis',
    message: 'Reconoce y elimina de dhole.ai.events los mensajes que llevan más de una hora entregados al consumer group sin ACK. No elimina los trabajos durables de PostgreSQL.',
    confirmLabel: 'Limpiar pending',
    danger: true,
    action: () => runAction(
      'redis:pending',
      () => callEndpoint(clearRedisEndpoint, {
        body: { olderThanSeconds: 3600, maximumMessages: 10000, deleteMessages: true },
      }),
      'Pending de Redis limpiados',
      'Se eliminaron únicamente mensajes pending antiguos del consumer group.',
    ),
  })
}

function trimRedis() {
  confirmAction({
    title: 'Recortar historial del stream',
    message: 'Reduce dhole.ai.events a una ventana aproximada de 10 000 eventos recientes. No elimina la cola durable de PostgreSQL.',
    confirmLabel: 'Recortar stream',
    danger: true,
    action: () => runAction(
      'redis:trim',
      () => callEndpoint(trimRedisEndpoint, { body: { maxLength: 10000 } }),
      'Stream recortado',
      'Redis conservó la ventana más reciente del stream.',
    ),
  })
}

function purgeMongo() {
  confirmAction({
    title: 'Purgar historial antiguo de MongoDB',
    message: 'Elimina snapshots de ejecuciones de IA con más de 90 días. MongoDB se usa como historial; esta acción no borra trabajos de PostgreSQL ni mensajes nuevos de Redis.',
    confirmLabel: 'Purgar historial',
    danger: true,
    action: () => runAction(
      'mongo:purge',
      () => callEndpoint(purgeMongoEndpoint, { body: { olderThanDays: 90, deleteAll: false } }),
      'Historial depurado',
      'Se eliminaron snapshots antiguos de MongoDB.',
    ),
  })
}

function unloadModel(model: OllamaLoadedModel) {
  const externalId = model.model ?? model.name
  const modelId = endpointModelId(externalId)
  if (!modelId) {
    toastStore.warning('Modelo no identificado', 'No hay una ejecución visible que permita relacionar este modelo cargado con su ModelId de Dhole.')
    return
  }

  confirmAction({
    title: `Descargar ${externalId ?? 'modelo'} de memoria`,
    message: 'Libera el modelo de la RAM/VRAM de Ollama. No elimina el modelo del disco; volverá a cargarse automáticamente cuando una ejecución lo necesite.',
    confirmLabel: 'Descargar de memoria',
    action: () => runAction(
      `ollama:${modelId}`,
      () => callEndpoint(unloadOllamaEndpoint, { params: { modelId }, body: {} }),
      'Modelo descargado',
      `${externalId} fue solicitado para descarga de memoria en Ollama.`,
    ),
  })
}

function toggleExpanded(jobId: string) {
  expandedJobId.value = expandedJobId.value === jobId ? '' : jobId
}

onMounted(async () => {
  await refresh()
  timer = window.setInterval(() => {
    if (autoRefresh.value && !actionKey.value) void refresh(false)
  }, 3000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="space-y-6 p-1">
    <DhPageHeader
      title="Cola y operaciones de IA"
      description="Estado en tiempo real de PostgreSQL, Redis, Ollama y MongoDB. Cada trabajo conserva la trazabilidad hasta correo, ejecución, intento y modelo."
    >
      <template #actions>
        <div class="min-w-[210px] rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
          <DhSwitch
            v-model="autoRefresh"
            label="Tiempo real · 3 s"
            description="Actualiza la pantalla automáticamente."
          />
        </div>
        <DhTooltip text="Consulta el estado ahora, sin esperar el próximo ciclo de 3 segundos." position="bottom">
          <DhButton variant="secondary" :disabled="loading" @click="refresh()">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Actualizar
          </DhButton>
        </DhTooltip>
      </template>
    </DhPageHeader>

    <div class="dh-glass dh-liquid rounded-[24px] p-4">
      <div class="flex gap-3">
        <HelpCircle class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
        <div>
          <p class="text-sm font-black text-[var(--dh-text)]">Qué controlan estas acciones</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Redis transporta eventos, PostgreSQL mantiene la cola durable, MongoDB conserva historial y Ollama ejecuta el modelo. Las acciones de mantenimiento no eliminan la cola durable salvo “Retirar”, que cancela un trabajo concreto.
          </p>
        </div>
      </div>
    </div>

    <div v-if="loading && !state" class="flex min-h-72 items-center justify-center">
      <DhSpinner />
    </div>

    <template v-else-if="state">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div class="dh-glass dh-liquid rounded-[24px] p-5">
          <div class="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><span>En cola</span><LoaderCircle class="h-4 w-4" /></div>
          <div class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ state.queue.pending }}</div>
        </div>
        <div class="dh-glass dh-liquid rounded-[24px] border border-orange-500/30 p-5">
          <div class="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><span>Procesando</span><Activity class="h-4 w-4 text-orange-400" /></div>
          <div class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ state.queue.processing }}</div>
        </div>
        <div class="dh-glass dh-liquid rounded-[24px] p-5">
          <div class="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><span>Reintentos</span><RotateCcw class="h-4 w-4" /></div>
          <div class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ state.queue.retryScheduled }}</div>
        </div>
        <div class="dh-glass dh-liquid rounded-[24px] border border-red-500/20 p-5">
          <div class="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><span>Fallidos</span><AlertTriangle class="h-4 w-4" /></div>
          <div class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ state.queue.failed }}</div>
        </div>
        <div class="dh-glass dh-liquid rounded-[24px] p-5">
          <div class="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><span>Redis pending</span><Server class="h-4 w-4" /></div>
          <div class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ state.redis.group?.pending ?? 0 }}</div>
          <div class="mt-1 text-xs text-[var(--dh-text-muted)]">Lag {{ state.redis.group?.lag ?? '—' }}</div>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        <div class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex items-center gap-3"><Server class="h-5 w-5 text-[var(--dh-primary)]" /><div><h2 class="font-black text-[var(--dh-text)]">Redis Streams</h2><p class="text-xs text-[var(--dh-text-muted)]">{{ state.redis.stream }}</p></div></div>
          <div class="grid grid-cols-3 gap-2 text-center text-sm">
            <div class="rounded-xl bg-black/10 p-3 dark:bg-black/20"><div class="text-[var(--dh-text-muted)]">Eventos</div><strong>{{ state.redis.length ?? '—' }}</strong></div>
            <div class="rounded-xl bg-black/10 p-3 dark:bg-black/20"><div class="text-[var(--dh-text-muted)]">Pending</div><strong>{{ state.redis.group?.pending ?? '—' }}</strong></div>
            <div class="rounded-xl bg-black/10 p-3 dark:bg-black/20"><div class="text-[var(--dh-text-muted)]">Lag</div><strong>{{ state.redis.group?.lag ?? '—' }}</strong></div>
          </div>
          <p class="mt-3 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">Pending son eventos ya entregados pero todavía sin ACK. Lag son eventos que aún no han sido entregados al grupo.</p>
          <p v-if="state.redis.error" class="mt-3 text-xs text-red-400">{{ state.redis.error }}</p>
          <div v-if="canOperate" class="mt-4 flex flex-wrap gap-2">
            <DhTooltip text="Elimina de Redis mensajes sin ACK con más de 1 hora; PostgreSQL no se toca." position="bottom">
              <DhButton size="sm" variant="secondary" :loading="actionKey === 'redis:pending'" @click="clearRedisPending"><Eraser class="h-4 w-4" />Limpiar pending &gt;1h</DhButton>
            </DhTooltip>
            <DhTooltip text="Conserva aproximadamente los 10 000 eventos más recientes del stream." position="bottom">
              <DhButton size="sm" variant="secondary" :loading="actionKey === 'redis:trim'" @click="trimRedis"><Trash2 class="h-4 w-4" />Recortar stream</DhButton>
            </DhTooltip>
          </div>
        </div>

        <div class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex items-center gap-3"><Database class="h-5 w-5 text-[var(--dh-primary)]" /><div><h2 class="font-black text-[var(--dh-text)]">MongoDB</h2><p class="text-xs text-[var(--dh-text-muted)]">Snapshots, no cola de inferencia</p></div></div>
          <div class="rounded-xl bg-black/10 p-4 dark:bg-black/20"><div class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Snapshots de ejecución</div><div class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ state.mongo.executionSnapshots ?? '—' }}</div></div>
          <p class="mt-3 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">Purgar elimina únicamente snapshots históricos con más de 90 días; no cancela trabajos ni borra la cola.</p>
          <p v-if="state.mongo.error" class="mt-3 text-xs text-red-400">{{ state.mongo.error }}</p>
          <DhTooltip v-if="canOperate" text="Borra de MongoDB snapshots de ejecución con más de 90 días." position="bottom">
            <DhButton class="mt-4" size="sm" variant="secondary" :loading="actionKey === 'mongo:purge'" @click="purgeMongo"><Trash2 class="h-4 w-4" />Purgar &gt;90 días</DhButton>
          </DhTooltip>
        </div>

        <div class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex items-center gap-3"><Bot class="h-5 w-5 text-[var(--dh-primary)]" /><div><h2 class="font-black text-[var(--dh-text)]">Ollama</h2><p class="text-xs text-[var(--dh-text-muted)]">Modelos actualmente cargados</p></div></div>
          <div v-if="!state.ollama.length" class="text-sm text-[var(--dh-text-muted)]">No hay conexiones Ollama activas.</div>
          <div v-for="connection in state.ollama" :key="connection.id" class="mb-3 rounded-xl bg-black/10 p-3 dark:bg-black/20">
            <div class="flex items-center justify-between"><span class="text-sm font-black text-[var(--dh-text)]">{{ connection.name }}</span><DhBadge :variant="connection.available ? 'success' : 'danger'">{{ connection.available ? 'Disponible' : 'Error' }}</DhBadge></div>
            <div class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ connection.baseUrl }}</div>
            <p v-if="connection.error" class="mt-2 text-xs text-red-400">{{ connection.error }}</p>
            <div v-for="model in connection.models ?? []" :key="model.model ?? model.name ?? ''" class="mt-3 flex items-center justify-between gap-3 border-t border-[var(--dh-border)] pt-3">
              <div class="min-w-0"><div class="truncate text-sm font-semibold text-[var(--dh-text)]">{{ model.model ?? model.name }}</div><div class="text-xs text-[var(--dh-text-muted)]">RAM {{ formatBytes(model.size) }} · VRAM {{ formatBytes(model.sizeVram) }}</div></div>
              <DhTooltip text="Libera RAM/VRAM; no borra el modelo del disco." position="left">
                <DhButton v-if="canOperate" size="sm" variant="secondary" :disabled="!endpointModelId(model.model ?? model.name)" :loading="actionKey === `ollama:${endpointModelId(model.model ?? model.name)}`" @click="unloadModel(model)"><Unplug class="h-4 w-4" />Descargar</DhButton>
              </DhTooltip>
            </div>
          </div>
        </div>
      </section>

      <section class="dh-glass dh-liquid overflow-hidden rounded-[28px]">
        <div class="flex items-center justify-between border-b border-[var(--dh-border)] px-5 py-4"><div><h2 class="font-black text-[var(--dh-text)]">Cola durable de IA</h2><p class="text-xs text-[var(--dh-text-muted)]">PostgreSQL · AiEmailAnalysisJobs · {{ activeItems.length }} visibles</p></div><HardDrive class="h-5 w-5 text-[var(--dh-text-muted)]" /></div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1180px] text-left text-sm">
            <thead class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><tr><th class="px-5 py-3">Estado</th><th class="px-4 py-3">Correo / solicitud</th><th class="px-4 py-3">Ejecución</th><th class="px-4 py-3">Modelo</th><th class="px-4 py-3">Intento</th><th class="px-4 py-3">Tiempo</th><th class="px-4 py-3">Acciones</th></tr></thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <template v-for="item in state.queue.items" :key="item.jobId">
                <tr class="hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                  <td class="px-5 py-4"><DhBadge :variant="badgeVariant(item.status)">{{ statusLabel(item.status) }}</DhBadge></td>
                  <td class="px-4 py-4"><button class="text-left" @click="toggleExpanded(item.jobId)"><div class="font-medium">{{ item.emailMessageId.slice(0, 8) }}…</div><div class="mt-1 text-xs text-[var(--dh-text-muted)]">Req {{ item.requestId.slice(0, 8) }}…</div><div class="text-xs text-[var(--dh-text-muted)]">Job {{ item.jobId.slice(0, 8) }}…</div></button></td>
                  <td class="px-4 py-4"><div v-if="item.executions?.[0]" class="space-y-1"><div class="font-mono text-xs">{{ item.executions[0].executionId.slice(0, 8) }}…</div><DhBadge :variant="badgeVariant(item.executions[0].status)">{{ statusLabel(item.executions[0].status) }}</DhBadge></div><span v-else class="text-[var(--dh-text-muted)]">Aún no creada</span></td>
                  <td class="px-4 py-4"><template v-if="item.executions?.[0]?.attempt"><div class="font-medium">{{ item.executions[0].attempt?.modelName ?? item.executions[0].attempt?.externalModelId }}</div><div class="text-xs text-[var(--dh-text-muted)]">{{ item.executions[0].attempt?.providerType }} · {{ item.executions[0].attempt?.connectionName }}</div></template><span v-else class="text-[var(--dh-text-muted)]">Sin selección</span></td>
                  <td class="px-4 py-4">{{ item.attemptCount }}/{{ item.maxAttemptCount }}</td>
                  <td class="px-4 py-4"><div>{{ formatDuration(item.executions?.[0]?.durationMilliseconds) }}</div><div class="text-xs text-[var(--dh-text-muted)]">{{ formatDate(item.startedAtUtc ?? item.nextAttemptAtUtc) }}</div></td>
                  <td class="px-4 py-4"><div v-if="canOperate" class="flex gap-2"><DhTooltip v-if="item.status === 'Pending' || item.status === 'RetryScheduled'" text="Cancela este trabajo durable y evita que llegue al modelo." position="left"><DhButton size="sm" variant="secondary" :loading="actionKey === `cancel:${item.jobId}`" @click="cancelJob(item)"><Trash2 class="h-4 w-4" />Retirar</DhButton></DhTooltip><DhTooltip v-if="item.status === 'Failed'" text="Vuelve a poner este trabajo fallido en la cola para otro intento." position="left"><DhButton size="sm" variant="secondary" :loading="actionKey === `retry:${item.jobId}`" @click="retryJob(item)"><RotateCcw class="h-4 w-4" />Reintentar</DhButton></DhTooltip></div></td>
                </tr>
                <tr v-if="expandedJobId === item.jobId" class="bg-black/5 dark:bg-black/20"><td colspan="7" class="px-5 py-5"><div class="grid gap-4 lg:grid-cols-3"><div><div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--dh-text-muted)]"><Link2 class="h-4 w-4" />Trazabilidad origen</div><dl class="space-y-2 text-xs"><div><dt class="text-[var(--dh-text-muted)]">EmailMessageId</dt><dd class="break-all font-mono">{{ item.emailMessageId }}</dd></div><div><dt class="text-[var(--dh-text-muted)]">EmailAttachmentId</dt><dd class="break-all font-mono">{{ item.emailAttachmentId ?? '—' }}</dd></div><div><dt class="text-[var(--dh-text-muted)]">EmailExtractionJobId</dt><dd class="break-all font-mono">{{ item.emailExtractionJobId }}</dd></div><div><dt class="text-[var(--dh-text-muted)]">RequestId</dt><dd class="break-all font-mono">{{ item.requestId }}</dd></div></dl></div><div><div class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--dh-text-muted)]">Correlación</div><dl class="space-y-2 text-xs"><div><dt class="text-[var(--dh-text-muted)]">CorrelationId</dt><dd class="break-all font-mono">{{ item.correlationId }}</dd></div><div><dt class="text-[var(--dh-text-muted)]">RequestHash</dt><dd class="break-all font-mono">{{ item.requestHash }}</dd></div><div><dt class="text-[var(--dh-text-muted)]">Lease</dt><dd class="break-all font-mono">{{ item.leaseOwner ?? '—' }}</dd></div><div><dt class="text-[var(--dh-text-muted)]">Heartbeat</dt><dd>{{ formatDate(item.lastHeartbeatAtUtc) }}</dd></div></dl></div><div><div class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--dh-text-muted)]">Ejecuciones IA</div><div v-if="!item.executions?.length" class="text-xs text-[var(--dh-text-muted)]">Todavía no hay una AiExecution asociada.</div><div v-for="execution in item.executions" :key="execution.executionId" class="mb-2 rounded-lg border border-[var(--dh-border)] p-3 text-xs"><div class="flex justify-between gap-2"><span class="break-all font-mono">{{ execution.executionId }}</span><DhBadge :variant="badgeVariant(execution.status)">{{ statusLabel(execution.status) }}</DhBadge></div><div v-if="execution.attempt" class="mt-2 text-[var(--dh-text-muted)]">Attempt {{ execution.attempt.attemptNumber }} · {{ execution.attempt.externalModelId }} · {{ execution.attempt.providerType }}</div><div v-if="execution.errorCode" class="mt-2 text-red-400">{{ execution.errorCode }} · {{ execution.errorMessage }}</div></div></div></div></td></tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="failedItems.length" class="dh-glass dh-liquid rounded-[24px] border border-red-500/20 p-5"><div class="flex items-center gap-2"><AlertTriangle class="h-5 w-5 text-red-400" /><h2 class="font-black text-[var(--dh-text)]">Diagnóstico</h2></div><p class="mt-2 text-sm text-[var(--dh-text-muted)]">Los fallos siguen visibles para relacionar ErrorCode con correo, RequestId, ExecutionId, AttemptId y modelo. Limpiar Mongo no elimina estos jobs de PostgreSQL.</p></section>
    </template>
  </div>
</template>
