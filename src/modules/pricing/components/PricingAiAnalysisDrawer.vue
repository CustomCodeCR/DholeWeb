<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertTriangle, Bot, RefreshCw, Sparkles } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useToastStore } from '@/core/stores/toastStore'
import type { PricingAiAnalysisDto, PricingAiAnalysisStatus } from '@/core/interfaces/pricing'

const props = defineProps<{
  analysisId: string
  initialAnalysis?: PricingAiAnalysisDto | null
  onUpdated?: (analysis: PricingAiAnalysisDto) => void | Promise<void>
}>()

const POLL_MS = 3_000
const toastStore = useToastStore()
const analysis = ref<PricingAiAnalysisDto | null>(props.initialAnalysis ?? null)
const loading = ref(false)
let timer: number | undefined

const isPending = computed(() =>
  analysis.value ? ['Pending', 'Processing'].includes(analysis.value.status) : false,
)

function statusLabel(status?: PricingAiAnalysisStatus) {
  return ({ Pending: 'Pendiente', Processing: 'Analizando', Completed: 'Completado', Failed: 'Fallido' } as Record<string, string>)[status ?? ''] ?? 'Cargando'
}

function statusVariant(status?: PricingAiAnalysisStatus) {
  if (status === 'Completed') return 'success' as const
  if (status === 'Failed') return 'danger' as const
  if (status === 'Processing') return 'primary' as const
  return 'warning' as const
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function load(silent = false) {
  try {
    if (!silent) loading.value = true
    analysis.value = await PricingService.getAiAnalysis(props.analysisId)
    await props.onUpdated?.(analysis.value)
    if (!isPending.value && timer) {
      window.clearInterval(timer)
      timer = undefined
    }
  } catch (error) {
    if (!silent) toastStore.backendError(error, 'No se pudo cargar el análisis de IA.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  if (isPending.value) timer = window.setInterval(() => void load(true), POLL_MS)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="space-y-5">
    <section class="dh-liquid rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex gap-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]">
            <Bot class="h-5 w-5" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <DhBadge :label="analysis?.analysisType === 'Email' ? 'Análisis de correo' : 'Análisis del panel'" variant="primary" />
              <DhBadge :label="statusLabel(analysis?.status)" :variant="statusVariant(analysis?.status)" />
            </div>
            <p class="mt-3 break-all text-xs font-bold text-[var(--dh-text-muted)]">
              {{ analysis?.sourceReference ?? analysisId }}
            </p>
          </div>
        </div>
        <DhButton :icon="RefreshCw" label="Actualizar" size="sm" variant="secondary" :loading="loading" @click="load()" />
      </div>
    </section>

    <section v-if="analysis?.status === 'Completed'" class="rounded-[28px] border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div class="mb-3 flex items-center gap-2">
        <Sparkles class="h-5 w-5 text-emerald-600" />
        <h3 class="font-black text-[var(--dh-text)]">Recomendación de IA</h3>
      </div>
      <p class="whitespace-pre-wrap text-sm font-semibold leading-6 text-[var(--dh-text-soft)]">{{ analysis.resultText }}</p>
    </section>

    <section v-else-if="analysis?.status === 'Failed'" class="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5">
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <h3 class="font-black text-[var(--dh-text)]">No fue posible completar el análisis</h3>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-soft)]">{{ analysis.errorMessage || analysis.errorCode }}</p>
        </div>
      </div>
    </section>

    <section v-else class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-8 text-center">
      <Sparkles class="mx-auto h-7 w-7 animate-pulse text-[var(--dh-primary)]" />
      <p class="mt-3 font-black text-[var(--dh-text)]">El BackgroundTask está analizando la información.</p>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Esta ventana se actualizará automáticamente.</p>
    </section>

    <section v-if="analysis" class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Solicitado</p>
        <p class="mt-2 text-sm font-black text-[var(--dh-text)]">{{ formatDateTime(analysis.createdAtUtc) }}</p>
      </div>
      <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Finalizado</p>
        <p class="mt-2 text-sm font-black text-[var(--dh-text)]">{{ formatDateTime(analysis.completedAtUtc) }}</p>
      </div>
      <div v-if="analysis.aiExecutionId" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:col-span-2">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Ejecución IA auditada</p>
        <p class="mt-2 break-all text-sm font-black text-[var(--dh-text)]">{{ analysis.aiExecutionId }}</p>
      </div>
    </section>
  </div>
</template>
