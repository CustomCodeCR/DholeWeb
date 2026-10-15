<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { createCorrelationId } from '@/modules/pricing/utils/pricingFormat'
import type { ExtractImportRatesResultDto } from '@/core/interfaces/pricing'

type CompatibleExtractionResult = ExtractImportRatesResultDto & {
  persistedRows?: number
}

const props = defineProps<{ onSaved?: () => void | Promise<void> }>()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const result = ref<CompatibleExtractionResult | null>(null)
const form = reactive({ submitted: false, saving: false, dragging: false })
const jobStatus = ref<'Pending' | 'Processing' | 'Completed' | 'Failed' | null>(null)
const activeJobId = ref<string | null>(null)
const JOB_STORAGE_KEY = 'dhole:pricing:import-extraction-job'
let activePoll: AbortController | null = null
let unmounted = false

const createdRows = computed(() =>
  Number(result.value?.createdRows ?? result.value?.persistedRows ?? 0),
)
const skippedRows = computed(() => Number(result.value?.skippedRows ?? 0))
const totalRows = computed(() =>
  Number(result.value?.totalRows ?? createdRows.value + skippedRows.value),
)
const warningRows = computed(() =>
  Number(
    result.value?.warningRows ??
      result.value?.issues?.filter((issue) => !issue.isBlocking).length ??
      0,
  ),
)
const invalidRows = computed(() =>
  Number(
    result.value?.invalidRows ??
      result.value?.issues?.filter((issue) => issue.isBlocking).length ??
      0,
  ),
)
const hasIssues = computed(() =>
  Boolean(result.value?.hasIssues ?? (result.value?.issues?.length ?? 0) > 0),
)
const extractionSucceeded = computed(() => result.value?.success === true && createdRows.value > 0)

function chooseFile(files: FileList | null) {
  if (form.saving) return
  file.value = files?.[0] ?? null
  result.value = null
  jobStatus.value = null
  form.submitted = false
}

function drop(event: DragEvent) {
  form.dragging = false
  chooseFile(event.dataTransfer?.files ?? null)
}

function extractionFailureMessage(response: CompatibleExtractionResult): string {
  if (response.errorMessage?.trim()) return response.errorMessage.trim()

  const blockingIssue = response.issues?.find((issue) => issue.isBlocking)
  if (blockingIssue?.message?.trim()) return blockingIssue.message.trim()

  return 'DataExtraction no produjo tarifas utilizables. Revise los detalles de la extracción.'
}

async function followJob(jobId: string) {
  activePoll?.abort()
  activePoll = new AbortController()
  activeJobId.value = jobId
  jobStatus.value = 'Pending'
  form.saving = true
  result.value = null

  try {
    // Poll the status endpoint; only a Completed or Failed job may display
    // a final result. A 202 Pending response is NOT a failed extraction.
    const extraction = await PricingService.awaitManualImportExtraction(
      jobId,
      (status) => { if (!unmounted) jobStatus.value = status },
      activePoll.signal,
    )
    if (unmounted) return
    result.value = extraction
    jobStatus.value = extraction.success ? 'Completed' : 'Failed'

    if (!extraction.success) {
      toastStore.warning('No se pudo importar el tarifario', extractionFailureMessage(extraction))
    } else if (createdRows.value <= 0) {
      toastStore.warning(
        'No se crearon tarifas',
        'El archivo terminó de procesarse, pero ninguna fila pudo convertirse en una tarifa.',
      )
    } else {
      toastStore.success(
        'Archivo procesado',
        String(createdRows.value) + ' tarifas importadas correctamente.',
      )
      await props.onSaved?.()
    }
  } catch (error) {
    if (unmounted) return
    // Leave the persisted job id untouched on transient connection failures.
    // Reopening the drawer resumes the job without resubmitting the file.
    toastStore.backendError(error, 'No se pudo consultar la extracción. Puede reabrir esta pantalla.')
  } finally {
    if (!unmounted) form.saving = false
    activePoll = null
  }
}

async function submit() {
  form.submitted = true
  if (!file.value || form.saving) return

  form.saving = true
  result.value = null
  jobStatus.value = 'Pending'
  try {
    const accepted = await PricingService.enqueueImportRateExtraction(
      file.value,
      createCorrelationId(),
    )
    if (!accepted.jobId) throw new Error('Pricing no devolvió un identificador de extracción.')
    // Save immediately so closing the browser never loses track of the job.
    localStorage.setItem(JOB_STORAGE_KEY, accepted.jobId)
    await followJob(accepted.jobId)
  } catch (error) {
    toastStore.backendError(error, 'No fue posible registrar el archivo para extracción.')
  } finally {
    if (!unmounted) form.saving = false
  }
}

onMounted(() => {
  const pendingJob = localStorage.getItem(JOB_STORAGE_KEY)
  if (pendingJob) void followJob(pendingJob)
})

onUnmounted(() => {
  unmounted = true
  activePoll?.abort()
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <button
        type="button"
        class="mt-5 flex min-h-64 w-full flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-8 text-center transition"
        :class="
          form.dragging
            ? 'border-[var(--dh-primary)] dh-bg-primary-soft'
            : 'border-[var(--dh-border-strong)] hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]'
        "
        @click="!form.saving && fileInput?.click()"
        @dragover.prevent="form.dragging = true"
        @dragleave.prevent="form.dragging = false"
        @drop.prevent="drop"
      >
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept=".pdf,.xlsx,.xlsm,.xls,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,image/*"
          @change="chooseFile(($event.target as HTMLInputElement).files)"
        />
        <div
          class="flex h-16 w-16 items-center justify-center rounded-[24px] dh-bg-primary-soft text-[var(--dh-primary)]"
        >
          <FileSpreadsheet v-if="file" class="h-7 w-7" />
          <UploadCloud v-else class="h-7 w-7" />
        </div>
        <p class="mt-4 text-base font-black text-[var(--dh-text)]">
          {{ file?.name ?? 'Arrastre o seleccione el tarifario' }}
        </p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          PDF, Excel, CSV o imagen. El archivo se valida antes de crear registros.
        </p>
        <p
          v-if="file"
          class="mt-3 rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-[var(--dh-text-soft)] dark:bg-white/10"
        >
          {{ (file.size / 1024 / 1024).toFixed(2) }} MB
        </p>
      </button>
      <p v-if="form.submitted && !file" class="mt-2 text-xs font-semibold text-red-500">
        Seleccione un archivo.
      </p>
    </section>

    <section
      v-if="jobStatus === 'Pending' || jobStatus === 'Processing'"
      role="status"
      aria-live="polite"
      class="rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5"
    >
      <div class="flex items-start gap-3">
        <UploadCloud class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p class="font-black text-[var(--dh-text)]">
            {{ jobStatus === 'Pending' ? 'Tarifario recibido, en espera de procesamiento' : 'Extrayendo tarifas en segundo plano' }}
          </p>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
            El archivo está registrado. Puede cerrar esta ventana; al volver se recuperará el resultado.
          </p>
          <p v-if="activeJobId" class="mt-2 break-all text-xs text-[var(--dh-text-muted)]">
            Trabajo: {{ activeJobId }}
          </p>
        </div>
      </div>
    </section>

    <section
      v-if="result"
      class="rounded-[26px] border p-5"
      :class="
        !result.success
          ? 'border-red-500/20 bg-red-500/10'
          : hasIssues
            ? 'border-amber-500/20 bg-amber-500/10'
            : 'border-emerald-500/20 bg-emerald-500/10'
      "
    >
      <div class="flex items-start gap-3">
        <AlertTriangle
          v-if="!result.success || hasIssues"
          class="mt-0.5 h-5 w-5 shrink-0"
          :class="!result.success ? 'text-red-500' : 'text-amber-600'"
        />
        <CheckCircle2 v-else class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div class="flex-1">
          <h3 class="font-black text-[var(--dh-text)]">Resultado de la extracción</h3>
          <p v-if="!result.success" class="mt-2 text-sm font-semibold text-red-500">
            {{ extractionFailureMessage(result) }}
          </p>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Filas</p>
              <p class="text-lg font-black">{{ totalRows }}</p>
            </div>
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Creadas</p>
              <p class="text-lg font-black text-emerald-600">{{ createdRows }}</p>
            </div>
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Advertencias</p>
              <p class="text-lg font-black text-amber-600">{{ warningRows }}</p>
            </div>
            <div>
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Inválidas</p>
              <p class="text-lg font-black text-red-500">{{ invalidRows }}</p>
            </div>
          </div>
          <div
            v-if="result.issues?.length"
            class="mt-4 max-h-48 space-y-2 overflow-y-auto dh-scrollbar"
          >
            <div
              v-for="(issue, index) in result.issues"
              :key="`${issue.code}-${index}`"
              class="rounded-2xl bg-[var(--dh-card)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-soft)]"
            >
              <span class="font-black">{{ issue.code }}</span> · {{ issue.message }}
              <span v-if="issue.sourceRowNumber" class="text-[var(--dh-text-muted)]">
                (fila {{ issue.sourceRowNumber }})</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="flex justify-end gap-2">
      <DhButton
        :label="result ? 'Cerrar' : 'Cancelar'"
        variant="secondary"
        @click="drawerStore.close()"
      />
      <DhButton
        v-if="!extractionSucceeded && !form.saving"
        :label="result ? 'Reintentar extracción' : 'Extraer tarifas'"
        :icon="UploadCloud"
        :loading="form.saving"
        :disabled="!file"
        @click="submit"
      />
    </div>
  </div>
</template>