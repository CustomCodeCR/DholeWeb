<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Mail,
  Paperclip,
  RefreshCw,
} from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { useToastStore } from '@/core/stores/toastStore'
import { EmailExtractionService } from '@/core/services/emailExtractionService'
import type {
  EmailExtractionJobStatus,
  EmailMessageDetailDto,
  EmailMessageDto,
  EmailMessageStatus,
} from '@/core/interfaces/emailExtraction'

const props = defineProps<{
  message: EmailMessageDto
  onReprocessed?: () => void | Promise<void>
  onOpenPricing?: (batchId: string) => void | Promise<void>
}>()

const toastStore = useToastStore()
const current = ref<EmailMessageDetailDto | null>(null)
const loading = ref(false)
const reprocessing = ref(false)

const canReprocess = computed(
  () => current.value?.status === 'NeedsReview' || current.value?.status === 'Failed',
)

const bodyPreview = computed(() => {
  if (!current.value) return ''
  if (current.value.bodyText?.trim()) return current.value.bodyText.trim()
  if (!current.value.bodyHtml?.trim()) return ''

  return new DOMParser().parseFromString(current.value.bodyHtml, 'text/html').body.textContent?.trim() ?? ''
})

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
      SentToPricing: 'Enviado a Pricing',
      NeedsReview: 'Necesita revisión',
      Failed: 'Fallido',
      Ignored: 'Ignorado',
    } as Record<string, string>
  )[status] ?? status
}

function statusVariant(status: string) {
  if (status === 'Extracted' || status === 'SentToPricing') return 'success' as const
  if (status === 'Failed') return 'danger' as const
  if (status === 'NeedsReview' || status === 'Queued' || status === 'Pending') return 'warning' as const
  if (status === 'Processing') return 'primary' as const
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function load() {
  try {
    loading.value = true
    current.value = await EmailExtractionService.getMessage(props.message.id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el detalle del correo.')
  } finally {
    loading.value = false
  }
}

async function reprocess() {
  if (!canReprocess.value) return

  try {
    reprocessing.value = true
    await EmailExtractionService.reprocessMessage(props.message.id)
    toastStore.success(
      'Correo enviado a reproceso',
      'Se crearon nuevos trabajos de extracción. La bandeja se actualizará automáticamente.',
    )
    await load()
    await props.onReprocessed?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo reprocesar el correo.')
  } finally {
    reprocessing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <section
      class="dh-liquid rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]"
          >
            <Mail class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <DhBadge
                :label="messageStatusLabel(current?.status ?? message.status)"
                :variant="statusVariant(current?.status ?? message.status)"
              />
              <DhBadge
                v-if="current?.classificationConfidence != null"
                :label="`${current.classificationConfidence.toFixed(1)}% confianza`"
                variant="neutral"
              />
            </div>
            <h2 class="mt-3 break-words text-xl font-black text-[var(--dh-text)]">
              {{ current?.subject ?? message.subject }}
            </h2>
            <p class="mt-1 break-all text-sm font-semibold text-[var(--dh-text-muted)]">
              {{ current?.fromName || message.fromName || 'Remitente sin nombre' }} ·
              {{ current?.fromAddress ?? message.fromAddress }}
            </p>
          </div>
        </div>
        <DhButton
          v-if="canReprocess"
          label="Reprocesar"
          :icon="RefreshCw"
          variant="secondary"
          size="sm"
          :loading="reprocessing"
          @click="reprocess"
        />
      </div>
    </section>

    <div v-if="loading && !current" class="py-12 text-center font-semibold text-[var(--dh-text-muted)]">
      Cargando detalle del correo...
    </div>

    <template v-else-if="current">
      <section class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Recibido
          </p>
          <p class="mt-2 font-black text-[var(--dh-text)]">{{ formatDateTime(current.receivedAt) }}</p>
        </div>
        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Destinatarios
          </p>
          <p class="mt-2 break-all font-semibold text-[var(--dh-text)]">
            {{ current.toAddresses || '—' }}
          </p>
        </div>
      </section>

      <section
        v-if="current.classificationReason || current.errorMessage"
        class="rounded-[26px] border p-5"
        :class="
          current.errorMessage
            ? 'border-red-500/20 bg-red-500/10'
            : 'border-amber-500/20 bg-amber-500/10'
        "
      >
        <div class="flex gap-3">
          <AlertTriangle
            class="mt-0.5 h-5 w-5 shrink-0"
            :class="current.errorMessage ? 'text-red-500' : 'text-amber-600'"
          />
          <div>
            <h3 class="font-black text-[var(--dh-text)]">Resultado de clasificación</h3>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-soft)]">
              {{ current.errorMessage || current.classificationReason }}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-3 flex items-center gap-2">
          <Paperclip class="h-4 w-4 text-[var(--dh-primary)]" />
          <h3 class="font-black text-[var(--dh-text)]">Adjuntos</h3>
          <DhBadge :label="String(current.attachments.length)" variant="neutral" />
        </div>
        <div v-if="current.attachments.length" class="space-y-2">
          <div
            v-for="attachment in current.attachments"
            :key="attachment.id"
            class="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
          >
            <div class="flex min-w-0 items-center gap-3">
              <FileText class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
              <div class="min-w-0">
                <p class="truncate font-black text-[var(--dh-text)]">{{ attachment.fileName }}</p>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ attachment.sourceFileType }} · {{ formatSize(attachment.sizeBytes) }}
                </p>
              </div>
            </div>
            <DhBadge :label="attachment.status" :variant="statusVariant(attachment.status)" />
          </div>
        </div>
        <p v-else class="rounded-[22px] bg-black/[0.025] p-4 text-sm font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.04]">
          El correo se procesó desde su cuerpo; no contiene adjuntos registrados.
        </p>
      </section>

      <section>
        <h3 class="mb-3 font-black text-[var(--dh-text)]">Seguimiento de extracción y Pricing</h3>
        <div v-if="current.jobs.length" class="space-y-3">
          <article
            v-for="job in current.jobs"
            :key="job.id"
            class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <DhBadge :label="jobStatusLabel(job.status)" :variant="statusVariant(job.status)" />
                  <DhBadge :label="job.sourceType === 'Body' ? 'Cuerpo del correo' : 'Adjunto'" variant="neutral" />
                  <DhBadge
                    v-if="job.confidenceScore != null"
                    :label="`${job.confidenceScore.toFixed(1)}%`"
                    variant="neutral"
                  />
                </div>
                <p v-if="job.errorMessage" class="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
                  {{ job.errorMessage }}
                </p>
                <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
                  Inicio: {{ formatDateTime(job.startedAt) }} · Fin: {{ formatDateTime(job.finishedAt) }}
                </p>
                <p v-if="job.pricingImportBatchId" class="mt-2 break-all text-xs font-bold text-[var(--dh-text-soft)]">
                  Lote Pricing: {{ job.pricingImportBatchId }}
                </p>
              </div>
              <DhButton
                v-if="job.pricingImportBatchId"
                label="Ver en Pricing"
                :icon="ExternalLink"
                size="sm"
                @click="onOpenPricing?.(job.pricingImportBatchId)"
              />
            </div>
          </article>
        </div>
        <p v-else class="rounded-[22px] bg-black/[0.025] p-4 text-sm font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.04]">
          Aún no hay trabajos de extracción asociados.
        </p>
      </section>

      <section v-if="bodyPreview" class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h3 class="font-black text-[var(--dh-text)]">Vista previa del correo</h3>
        <p class="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--dh-text-soft)]">
          {{ bodyPreview }}
        </p>
      </section>
    </template>
  </div>
</template>
