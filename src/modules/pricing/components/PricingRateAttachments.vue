<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileText, Paperclip } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { StorageService } from '@/core/services/storageService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'

interface StoredDocument {
  id: string
  fileName: string
  sizeInBytes: number
}

interface SellerDocument extends StoredDocument {
  categoryLabel?: string | null
}

interface LinkedSellerRequest {
  payload?: {
    supportDocuments?: SellerDocument[] | null
  } | null
}

interface DisplayDocument extends StoredDocument {
  source: string
}

const props = defineProps<{
  rateId: string
  finalDocuments?: StoredDocument[]
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const sellerDocuments = ref<SellerDocument[]>([])
const loadingSeller = ref(false)
const sellerError = ref(false)
let loadSequence = 0

// Estos soportes pertenecen a la solicitud original de Ventas. Nunca deben
// reemplazar ni modificar FinalBackupStorageIds de la cotización.
watch(() => props.rateId, async (rateId) => {
  const sequence = ++loadSequence
  sellerDocuments.value = []
  sellerError.value = false
  loadingSeller.value = Boolean(rateId)
  if (!rateId) return

  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rate-requests/by-rate/' + encodeURIComponent(rateId),
      headers: { Accept: 'application/json' },
    })
    const request = unwrapApiResponse<LinkedSellerRequest>(response as never)
    if (sequence !== loadSequence) return
    const documents = request?.payload?.supportDocuments
    sellerDocuments.value = Array.isArray(documents)
      ? documents.filter((file) => Boolean(file?.id && file?.fileName))
      : []
  } catch (cause) {
    if (sequence !== loadSequence) return
    const status = (cause as { status?: number; statusCode?: number })?.status
      ?? (cause as { statusCode?: number })?.statusCode
    // Una tarifa creada directamente en Pricing no necesariamente tiene solicitud de Ventas.
    if (status !== 404) {
      console.error('[PricingRateAttachments] Could not load seller documents.', cause)
      sellerError.value = true
    }
  } finally {
    if (sequence === loadSequence) loadingSeller.value = false
  }
}, { immediate: true })

// Un mismo archivo de Storage puede estar referenciado por Ventas y Pricing.
// Mostrarlo una sola vez, manteniendo visibles ambos orígenes.
const attachments = computed<DisplayDocument[]>(() => {
  const unique = new Map<string, DisplayDocument>()
  for (const file of sellerDocuments.value) {
    const id = file.id?.trim()
    if (!id) continue
    unique.set(id.toLowerCase(), {
      id,
      fileName: file.fileName,
      sizeInBytes: file.sizeInBytes ?? 0,
      source: file.categoryLabel ? 'Ventas · ' + file.categoryLabel : 'Adjunto original de Ventas',
    })
  }
  for (const file of props.finalDocuments ?? []) {
    const id = file.id?.trim()
    if (!id) continue
    const key = id.toLowerCase()
    const existing = unique.get(key)
    if (existing) {
      existing.source += ' · Respaldo final'
      if (existing.fileName === 'Archivo no disponible en Storage') existing.fileName = file.fileName
    } else {
      unique.set(key, {
        id,
        fileName: file.fileName,
        sizeInBytes: file.sizeInBytes ?? 0,
        source: 'Respaldo final de Pricing',
      })
    }
  }
  return [...unique.values()]
})

function fileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return 'Tamaño no disponible'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / (1024 * 1024)).toFixed(1) + ' MB'
}

function canAccess(file: DisplayDocument) {
  return file.fileName !== 'Archivo no disponible en Storage'
}

function preview(file: DisplayDocument) {
  if (!canAccess(file)) return
  modalStore.open({
    title: file.fileName,
    component: StorageFileViewer,
    size: 'xl',
    props: { id: file.id, fileName: file.fileName, sizeInBytes: file.sizeInBytes },
  })
}

async function download(file: DisplayDocument) {
  if (!canAccess(file)) return
  try {
    await StorageService.downloadFile({
      id: file.id,
      fileName: file.fileName,
      sizeInBytes: file.sizeInBytes,
    })
  } catch (cause) {
    toastStore.backendError(cause, 'No se pudo descargar el archivo adjunto.')
  }
}
</script>

<template>
  <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Archivos adjuntos</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Documentos originales enviados por Ventas y respaldos finales de Pricing, vinculados a esta tarifa.
        </p>
      </div>
      <DhBadge
        :label="loadingSeller ? 'Consultando adjuntos…' : sellerError ? 'Adjuntos parciales' : attachments.length + ' adjunto' + (attachments.length === 1 ? '' : 's')"
        variant="neutral"
      />
    </div>

    <div v-if="attachments.length" class="mt-4 grid gap-3 md:grid-cols-2">
      <article
        v-for="file in attachments"
        :key="file.id"
        class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-bg)] p-3"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-card-hover)] text-[var(--dh-primary)]">
            <FileText class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <p class="break-all text-sm font-black text-[var(--dh-text)]">{{ file.fileName }}</p>
            <p class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ file.source }} · {{ fileSize(file.sizeInBytes) }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <DhButton size="sm" variant="secondary" :disabled="!canAccess(file)" @click="preview(file)">Ver</DhButton>
          <DhButton size="sm" variant="secondary" :disabled="!canAccess(file)" @click="download(file)">Descargar</DhButton>
        </div>
      </article>
    </div>
    <p v-else-if="!loadingSeller && !sellerError" class="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-[var(--dh-border)] px-4 py-4 text-sm font-semibold text-[var(--dh-text-muted)]">
      <Paperclip class="h-4 w-4 shrink-0" /> Esta tarifa no tiene archivos adjuntos registrados.
    </p>
    <p v-if="sellerError" class="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
      No se pudieron consultar los documentos originales de Ventas. Los respaldos finales siguen disponibles.
    </p>
  </section>
</template>
