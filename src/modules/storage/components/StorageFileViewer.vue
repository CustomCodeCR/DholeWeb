<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
} from 'lucide-vue-next'
import { StorageService, storagePreviewKind } from '@/core/services/storageService'
import type { StorageFileDescriptor } from '@/core/interfaces/storage'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<StorageFileDescriptor>()
const toastStore = useToastStore()
const loading = ref(true)
const objectUrl = ref<string | null>(null)
const textContent = ref('')
const errorMessage = ref<string | null>(null)
const kind = computed(() => storagePreviewKind(props))

function revokeObjectUrl() {
  if (!objectUrl.value) return
  URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
}

function expectedMimeType() {
  if (kind.value === 'pdf') return 'application/pdf'

  if (kind.value === 'image') {
    const declared = props.contentType?.trim().toLowerCase()
    if (declared?.startsWith('image/')) return declared

    const extension = props.fileName.split('.').pop()?.toLowerCase()
    return (
      {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        svg: 'image/svg+xml',
      } as Record<string, string>
    )[extension || '']
  }

  return undefined
}

function normalizePreviewBlob(blob: Blob) {
  const expected = expectedMimeType()
  if (!expected || blob.type.toLowerCase() === expected) return blob

  // Storage puede devolver application/octet-stream cuando el adjunto llegó desde correo.
  // Para PDF/imágenes el navegador necesita el MIME real para poder renderizar el blob URL.
  return new Blob([blob], { type: expected })
}

async function load() {
  loading.value = true
  errorMessage.value = null
  textContent.value = ''
  revokeObjectUrl()

  try {
    const blob = await StorageService.getContent(props.id)
    if (blob.size === 0) {
      throw new Error('El archivo almacenado está vacío.')
    }

    if (kind.value === 'image' || kind.value === 'pdf') {
      objectUrl.value = URL.createObjectURL(normalizePreviewBlob(blob))
      return
    }

    if (kind.value === 'text') {
      textContent.value = await blob.text()
      return
    }

    errorMessage.value = 'Este formato no tiene una vista previa disponible.'
  } catch (error) {
    errorMessage.value = 'No se pudo cargar el contenido del archivo.'
    toastStore.backendError(error, errorMessage.value)
  } finally {
    loading.value = false
  }
}

function downloadCurrentFile() {
  if (!objectUrl.value) return

  const anchor = document.createElement('a')
  anchor.href = objectUrl.value
  anchor.download = props.fileName || 'archivo'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function openCurrentFile() {
  if (!objectUrl.value) return
  window.open(objectUrl.value, '_blank', 'noopener,noreferrer')
}

onMounted(load)
onBeforeUnmount(revokeObjectUrl)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <ImageIcon v-if="kind === 'image'" class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <FileText v-else class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-black text-[var(--dh-text)]">{{ fileName }}</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ contentType || 'Tipo desconocido' }}
          <template v-if="sizeInBytes != null"> · {{ (sizeInBytes / 1024).toFixed(1) }} KB</template>
        </p>
      </div>

      <div v-if="objectUrl && (kind === 'pdf' || kind === 'image')" class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-black text-[var(--dh-text)] transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          @click="openCurrentFile"
        >
          <ExternalLink class="h-4 w-4" />
          Abrir
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-3 py-2 text-xs font-black text-white transition hover:opacity-90"
          @click="downloadCurrentFile"
        >
          <Download class="h-4 w-4" />
          Descargar
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex min-h-[420px] items-center justify-center rounded-[24px] bg-black/[0.025] dark:bg-white/[0.04]">
      <LoaderCircle class="h-8 w-8 animate-spin text-[var(--dh-primary)]" />
    </div>

    <div v-else-if="errorMessage" class="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-8 text-center">
      <AlertTriangle class="h-8 w-8 text-amber-600" />
      <p class="font-black text-[var(--dh-text)]">{{ errorMessage }}</p>
    </div>

    <img
      v-else-if="kind === 'image' && objectUrl"
      :src="objectUrl"
      :alt="fileName"
      class="mx-auto max-h-[72vh] max-w-full rounded-[24px] object-contain shadow-[var(--dh-shadow-lg)]"
    />

    <object
      v-else-if="kind === 'pdf' && objectUrl"
      :data="objectUrl"
      type="application/pdf"
      :aria-label="fileName"
      class="h-[72vh] w-full rounded-[24px] border border-[var(--dh-border)] bg-white"
    >
      <div class="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center text-[var(--dh-text)]">
        <FileText class="h-8 w-8 text-[var(--dh-primary)]" />
        <p class="font-black">El navegador no pudo mostrar el PDF incrustado.</p>
        <button type="button" class="font-black text-[var(--dh-primary)] underline" @click="downloadCurrentFile">
          Descargar PDF
        </button>
      </div>
    </object>

    <pre
      v-else-if="kind === 'text'"
      class="dh-scrollbar max-h-[72vh] overflow-auto whitespace-pre-wrap break-words rounded-[24px] border border-[var(--dh-border)] bg-black/[0.025] p-5 text-sm leading-6 text-[var(--dh-text-soft)] dark:bg-white/[0.04]"
    >{{ textContent }}</pre>
  </div>
</template>
