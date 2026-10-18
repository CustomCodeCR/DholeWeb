<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BarChart3, FileUp, RefreshCw, Download } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { StorageService } from '@/core/services/storageService'
import { useToastStore } from '@/core/stores/toastStore'
import {
  CompetitorAnalysisService,
  type CompetitorAnalysisDocument,
} from '@/modules/pricing/services/competitorAnalysisService'

const toast = useToastStore()
const input = ref<HTMLInputElement | null>(null)
const documents = ref<CompetitorAnalysisDocument[]>([])
const selectedId = ref<string | null>(null)
const selected = computed(() => documents.value.find((item) => item.id === selectedId.value) ?? null)
const loading = ref(false)
const uploading = ref(false)
const previewLoading = ref(false)
const previewHtml = ref('')
let previewVersion = 0

const maxBytes = 10 * 1024 * 1024

function formatDate(utc: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(utc))
}

function formatSize(bytes: number) {
  return `${(bytes / 1024).toLocaleString('es-CR', { maximumFractionDigits: 1 })} KB`
}

/** Preserve interactive inline scripts without exposing the application's origin. */
function sandboxedHtml(html: string) {
  const policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    "connect-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (match) => match + meta)
    : meta + html
}

async function openDocument(document: CompetitorAnalysisDocument) {
  selectedId.value = document.id
  const version = ++previewVersion
  previewHtml.value = ''
  previewLoading.value = true
  try {
    const blob = await StorageService.getContent(document.storageId)
    const html = await blob.text()
    if (version !== previewVersion) return
    if (!/<html[\s>]|<!doctype\s+html/i.test(html)) {
      throw new Error('El archivo guardado no contiene un documento HTML válido.')
    }
    previewHtml.value = sandboxedHtml(html)
  } catch (error) {
    if (version === previewVersion) {
      toast.backendError(error, 'No fue posible abrir el HTML almacenado.')
    }
  } finally {
    if (version === previewVersion) previewLoading.value = false
  }
}

async function loadDocuments(selectId?: string) {
  loading.value = true
  try {
    documents.value = await CompetitorAnalysisService.browse()
    const target = documents.value.find((item) => item.id === selectId)
      ?? documents.value.find((item) => item.id === selectedId.value)
      ?? documents.value[0]
    if (target) await openDocument(target)
    else {
      selectedId.value = null
      previewHtml.value = ''
      ++previewVersion
    }
  } catch (error) {
    documents.value = []
    selectedId.value = null
    previewHtml.value = ''
    ++previewVersion
    toast.backendError(error, 'No se pudieron cargar los análisis de la competencia.')
  } finally {
    loading.value = false
  }
}

async function uploadFile(event: Event) {
  const element = event.target as HTMLInputElement
  const file = element.files?.[0]
  element.value = ''
  if (!file || uploading.value) return
  if (!/\.html?$/i.test(file.name) || file.size < 1 || file.size > maxBytes) {
    toast.error('HTML inválido', 'Seleccione un archivo .html o .htm de máximo 10 MB.')
    return
  }

  uploading.value = true
  try {
    const id = crypto.randomUUID()
    const stored = await StorageService.uploadFile({
      file,
      sourceService: 'DholePricingService',
      entityType: 'CompetitorAnalysisDocument',
      entityId: id,
      metadataJson: JSON.stringify({ category: 'competitor-analysis', contentType: 'text/html' }),
    })
    const created = await CompetitorAnalysisService.register({
      id,
      storageId: stored.id,
      originalFileName: file.name,
      sizeInBytes: file.size,
    })
    toast.success('Análisis guardado', 'El HTML está almacenado y disponible para visualizar.')
    await loadDocuments(created.id)
  } catch (error) {
    toast.backendError(error, 'No se pudo guardar el análisis de la competencia.')
  } finally {
    uploading.value = false
  }
}

async function downloadSelected() {
  if (!selected.value) return
  try {
    await StorageService.downloadFile({
      id: selected.value.storageId,
      fileName: selected.value.originalFileName,
    })
  } catch (error) {
    toast.backendError(error, 'No se pudo descargar el HTML.')
  }
}

onMounted(() => void loadDocuments())
onBeforeUnmount(() => { ++previewVersion })
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Análisis de la competencia"
      subtitle="Cargue reportes HTML comparativos, guárdelos en Storage y consulte su contenido interactivo."
      :icon="BarChart3"
    >
      <template #actions>
        <DhButton label="Actualizar" variant="secondary" :icon="RefreshCw" :disabled="loading || uploading" @click="loadDocuments()" />
        <DhButton label="Subir HTML" :icon="FileUp" :disabled="uploading" @click="input?.click()" />
        <input ref="input" class="hidden" type="file" accept=".html,.htm,text/html" @change="uploadFile" />
      </template>
    </DhPageHeader>

    <nav class="flex flex-wrap gap-2 border-b border-[var(--dh-border)] pb-3" aria-label="Pestañas de competencia">
      <RouterLink to="/pricing/competition" class="rounded-xl px-4 py-2 text-sm font-bold text-[var(--dh-text-muted)] hover:bg-[var(--dh-card)]">
        Tarifas competencia
      </RouterLink>
      <RouterLink to="/pricing/competition/analysis" aria-current="page" class="rounded-xl bg-[var(--dh-primary)] px-4 py-2 text-sm font-bold text-white">
        Análisis de la competencia
      </RouterLink>
    </nav>

    <p v-if="uploading" role="status" class="text-sm font-semibold text-[var(--dh-text-muted)]">Subiendo y registrando HTML...</p>

    <div class="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="min-w-0 space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <h2 class="font-black text-[var(--dh-text)]">HTML almacenados</h2>
        <p v-if="loading" class="text-sm text-[var(--dh-text-muted)]">Cargando análisis...</p>
        <p v-else-if="!documents.length" class="text-sm text-[var(--dh-text-muted)]">
          Aún no hay análisis registrados. Suba un HTML para comenzar.
        </p>
        <button
          v-for="document in documents"
          :key="document.id"
          type="button"
          class="w-full rounded-xl border p-3 text-left transition-colors"
          :class="selectedId === document.id
            ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10'
            : 'border-[var(--dh-border)] hover:bg-[var(--dh-hover)]'"
          @click="openDocument(document)"
        >
          <span class="block break-words text-sm font-bold text-[var(--dh-text)]">{{ document.originalFileName }}</span>
          <span class="mt-2 block text-xs text-[var(--dh-text-muted)]">
            {{ formatDate(document.createdAtUtc) }} · {{ formatSize(document.sizeInBytes) }}
          </span>
        </button>
      </aside>

      <section class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] p-4">
          <div class="min-w-0">
            <h2 class="truncate font-black text-[var(--dh-text)]">{{ selected?.originalFileName || 'Vista previa del análisis' }}</h2>
            <p class="text-xs text-[var(--dh-text-muted)]">Documento HTML interactivo · ejecución aislada del sistema</p>
          </div>
          <DhButton v-if="selected" label="Descargar HTML" :icon="Download" variant="secondary" @click="downloadSelected" />
        </div>
        <div v-if="previewLoading" class="p-8 text-center text-[var(--dh-text-muted)]" role="status">Cargando visualización HTML...</div>
        <iframe
          v-else-if="previewHtml"
          :key="selectedId"
          :srcdoc="previewHtml"
          title="Análisis interactivo de la competencia"
          sandbox="allow-scripts allow-downloads allow-modals"
          referrerpolicy="no-referrer"
          class="block h-[75vh] min-h-[600px] w-full border-0 bg-white"
        />
        <div v-else class="p-10 text-center text-sm text-[var(--dh-text-muted)]">
          Seleccione un HTML almacenado para visualizarlo.
        </div>
      </section>
    </div>
  </div>
</template>
