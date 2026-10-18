<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BarChart3, FileUp, RefreshCw, Download, Maximize2, Minimize2, Trash2, Save } from 'lucide-vue-next'
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
const previewFrame = ref<HTMLIFrameElement | null>(null)
let lastPostedVersion = -1
function clearPreview() { previewHtml.value = '' }
function onViewerLoad() {
  if (!previewHtml.value || !previewFrame.value?.contentWindow
    || lastPostedVersion === previewVersion) return
  lastPostedVersion = previewVersion
  previewFrame.value.contentWindow.postMessage({
    type: 'dhole:competitor-analysis:render',
    html: previewHtml.value,
  }, '*') // The iframe has an opaque sandbox origin, so targetOrigin must be '*'.
}
const fullscreen = ref(false)
const validFrom = ref('')
const validTo = ref('')
const validitySaving = ref(false)
const deleting = ref(false)
const deleteConfirm = ref(false)
function toUtc(value: string) { return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null }
function dateInput(value: string | null) { return value?.slice(0, 10) ?? '' }
function validityLabel(document: CompetitorAnalysisDocument) {
  if (!document.validFromUtc && !document.validToUtc) return 'Sin vigencia definida'
  const today = new Date().toISOString().slice(0, 10)
  if (document.validToUtc && document.validToUtc.slice(0, 10) < today) return 'Vencido'
  if (document.validFromUtc && document.validFromUtc.slice(0, 10) > today) return 'Próximo'
  return 'Vigente'
}
async function saveValidity() {
  if (!selected.value) return
  if (validFrom.value && validTo.value && validFrom.value > validTo.value) {
    toast.error('Vigencia inválida', 'La fecha final debe ser igual o posterior a la inicial.')
    return
  }
  validitySaving.value = true
  try {
    const updated = await CompetitorAnalysisService.updateValidity(selected.value.id, toUtc(validFrom.value), toUtc(validTo.value))
    documents.value = documents.value.map(item => item.id === updated.id ? updated : item)
    toast.success('Vigencia guardada', 'Se actualizó la vigencia del análisis.')
  } catch (error) {
    toast.backendError(error, 'No se pudo actualizar la vigencia.')
  } finally { validitySaving.value = false }
}
async function removeSelected() {
  if (!selected.value) return
  deleting.value = true
  try {
    await CompetitorAnalysisService.remove(selected.value.id)
    deleteConfirm.value = false
    fullscreen.value = false
    selectedId.value = null
    clearPreview()
    await loadDocuments()
    toast.success('Análisis eliminado', 'Se retiró el reporte del listado.')
  } catch (error) {
    toast.backendError(error, 'No se pudo eliminar el análisis.')
  } finally { deleting.value = false }
}
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
    "script-src 'unsafe-inline' 'unsafe-eval' blob:",
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
  validFrom.value = dateInput(document.validFromUtc)
  validTo.value = dateInput(document.validToUtc)
  deleteConfirm.value = false
  const version = ++previewVersion
  clearPreview()
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
      clearPreview()
      ++previewVersion
    }
  } catch (error) {
    documents.value = []
    selectedId.value = null
    clearPreview()
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
      validFromUtc: toUtc(validFrom.value),
      validToUtc: toUtc(validTo.value),
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
onBeforeUnmount(() => { ++previewVersion; clearPreview() })
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

    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--dh-border)] p-3">
      <label class="text-sm text-[var(--dh-text)]">Vigente desde
        <input v-model="validFrom" type="date" class="mt-1 block rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] p-2" />
      </label>
      <label class="text-sm text-[var(--dh-text)]">Vigente hasta
        <input v-model="validTo" type="date" class="mt-1 block rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] p-2" />
      </label>
      <DhButton v-if="selected" label="Guardar vigencia" :icon="Save" variant="secondary" :disabled="validitySaving" @click="saveValidity" />
      <span class="text-xs text-[var(--dh-text-muted)]">Las fechas se aplican al subir un nuevo HTML o al guardar cambios del seleccionado.</span>
    </div>

    <p v-if="uploading" role="status" class="text-sm font-semibold text-[var(--dh-text-muted)]">Subiendo y registrando HTML...</p>

    <div class="grid min-w-0 gap-4">
      <aside class="min-w-0 space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <h2 class="font-black text-[var(--dh-text)]">HTML almacenados</h2>
        <p v-if="loading" class="text-sm text-[var(--dh-text-muted)]">Cargando análisis...</p>
        <p v-else-if="!documents.length" class="text-sm text-[var(--dh-text-muted)]">
          Aún no hay análisis registrados. Suba un HTML para comenzar.
        </p>
        <div class="flex gap-3 overflow-x-auto pb-2">
        <button
          v-for="document in documents"
          :key="document.id"
          type="button"
          class="min-w-[240px] max-w-[320px] flex-1 rounded-xl border p-3 text-left transition-colors"
          :class="selectedId === document.id
            ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10'
            : 'border-[var(--dh-border)] hover:bg-[var(--dh-hover)]'"
          @click="openDocument(document)"
        >
          <span class="block break-words text-sm font-bold text-[var(--dh-text)]">{{ document.originalFileName }}</span>
          <span class="mt-1 block text-xs font-semibold text-[var(--dh-text)]">{{ validityLabel(document) }} · {{ dateInput(document.validFromUtc) || "—" }} a {{ dateInput(document.validToUtc) || "—" }}</span>
          <span class="mt-2 block text-xs text-[var(--dh-text-muted)]">
            {{ formatDate(document.createdAtUtc) }} · {{ formatSize(document.sizeInBytes) }}
          </span>
        </button>
        </div>
      </aside>

      <section class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]"
        :class="fullscreen ? 'fixed inset-0 z-[9999] flex flex-col rounded-none bg-white' : ''">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] p-4">
          <div class="min-w-0">
            <h2 class="truncate font-black text-[var(--dh-text)]">{{ selected?.originalFileName || 'Vista previa del análisis' }}</h2>
            <p class="text-xs text-[var(--dh-text-muted)]">Documento HTML, CSS y JavaScript interactivo · ejecución aislada de Dhole</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <DhButton v-if="selected" label="Descargar HTML" :icon="Download" variant="secondary" @click="downloadSelected" />
            <DhButton v-if="selected" :label="fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'" :icon="fullscreen ? Minimize2 : Maximize2" variant="secondary" @click="fullscreen = !fullscreen" />
            <DhButton v-if="selected" label="Eliminar" :icon="Trash2" variant="secondary" @click="deleteConfirm = true" />
          </div>
        </div>
        <div v-if="deleteConfirm" class="flex flex-wrap items-center gap-3 border-b border-[var(--dh-border)] p-4">
          <span class="text-sm font-semibold">¿Eliminar este análisis del listado? Esta acción no se puede deshacer.</span>
          <DhButton label="Confirmar eliminación" :icon="Trash2" :disabled="deleting" @click="removeSelected" />
          <DhButton label="Cancelar" variant="secondary" @click="deleteConfirm = false" />
        </div>
        <div v-if="previewLoading" class="p-8 text-center text-[var(--dh-text-muted)]" role="status">Cargando visualización HTML...</div>
        <iframe
          v-else-if="previewHtml"
          :key="selectedId ?? undefined"
          ref="previewFrame"
          src="/competitor-analysis-viewer.html"
          @load="onViewerLoad"
          title="Análisis interactivo de la competencia"
          sandbox="allow-scripts allow-downloads allow-modals"
          referrerpolicy="no-referrer"
          class="block min-h-[700px] w-full border-0 bg-white" :class="fullscreen ? 'min-h-0 flex-1' : 'h-[85vh]'"
        />
        <div v-else class="p-10 text-center text-sm text-[var(--dh-text-muted)]">
          Seleccione un HTML almacenado para visualizarlo.
        </div>
      </section>
    </div>
  </div>
</template>
