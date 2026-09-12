<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CheckCircle2,
  File as FileIcon,
  FileImage,
  FileText,
  Film,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { downloadFile } from '@/core/api/fetchConfig'
import {
  isAllowedMarketingFile,
  MARKETING_MEDIA_ACCEPT,
  mediaContentTypeFilter,
  mediaKind,
  parseMarketingMediaMetadata,
  type MarketingMediaKind,
} from '@/core/media/mediaLibrary'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { MediaDto } from '@/core/interfaces/content'

const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const uploading = ref(false)
const previewLoading = ref(false)
const items = ref<MediaDto[]>([])
const search = ref('')
const typeFilter = ref<MarketingMediaKind>('all')
const selected = ref<MediaDto | null>(null)
const file = ref<File | null>(null)
const altText = ref('')
const caption = ref('')
const dragActive = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const previewError = ref('')

const canUpload = () => authStore.hasScope(CONTENT_SCOPES.media.upload)
const canEdit = () => authStore.hasScope(CONTENT_SCOPES.edit)
const canDelete = () => authStore.hasScope(CONTENT_SCOPES.media.delete)

const visibleItems = computed(() => {
  if (typeFilter.value !== 'document') return items.value
  return items.value.filter((item) => mediaKind(item.contentType, item.fileName) === 'document')
})

const activeKind = computed(() => {
  if (selected.value) return mediaKind(selected.value.contentType, selected.value.fileName)
  if (file.value) return mediaKind(file.value.type, file.value.name)
  return null
})

const technicalMetadata = computed(() => parseMarketingMediaMetadata(selected.value?.metadataJson))

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseMedia({
      pageNumber: 1,
      pageSize: 300,
      search: search.value.trim() || undefined,
      contentType: mediaContentTypeFilter(typeFilter.value),
    })
    items.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la biblioteca multimedia.')
  } finally {
    loading.value = false
  }
}

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewError.value = ''
}

async function loadStoredPreview(item: MediaDto) {
  releasePreview()
  if (mediaKind(item.contentType, item.fileName) === 'document') return

  previewLoading.value = true
  try {
    const response = await downloadFile(
      `/api/v1/storage/files/${item.storageFileId}/content`,
      item.fileName,
    )
    previewUrl.value = URL.createObjectURL(response.blob)
  } catch (error) {
    previewError.value = 'No se pudo cargar la vista previa.'
    toastStore.backendWarning(error, previewError.value)
  } finally {
    previewLoading.value = false
  }
}

async function select(item: MediaDto) {
  selected.value = item
  file.value = null
  altText.value = item.altText ?? ''
  caption.value = item.caption ?? ''
  if (fileInput.value) fileInput.value.value = ''
  await loadStoredPreview(item)
}

function clearEditor() {
  selected.value = null
  file.value = null
  altText.value = ''
  caption.value = ''
  releasePreview()
  if (fileInput.value) fileInput.value.value = ''
}

function chooseFile() {
  if (canUpload()) fileInput.value?.click()
}

function setFile(nextFile?: File | null) {
  const value = nextFile ?? null
  if (value && !isAllowedMarketingFile(value)) {
    toastStore.warning(
      'Formato no permitido',
      'Use imágenes, videos, PDF, Word, Excel, PowerPoint, CSV o TXT.',
    )
    if (fileInput.value) fileInput.value.value = ''
    return
  }

  releasePreview()
  file.value = value
  selected.value = null

  if (value) {
    if (!altText.value && mediaKind(value.type, value.name) === 'image') {
      altText.value = value.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
    }
    if (mediaKind(value.type, value.name) !== 'document') {
      previewUrl.value = URL.createObjectURL(value)
    }
  }
}

function handleInput(event: Event) {
  setFile((event.target as HTMLInputElement).files?.[0])
}

function handleDrop(event: DragEvent) {
  dragActive.value = false
  if (!canUpload()) return
  setFile(event.dataTransfer?.files?.[0])
}

function readableType(item: MediaDto) {
  const kind = mediaKind(item.contentType, item.fileName)
  if (kind === 'image') return 'Imagen'
  if (kind === 'video') return 'Video'
  if (kind === 'pdf') return 'PDF'
  return 'Documento'
}

function formatDuration(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  const seconds = Math.round(value)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes}:${remainder.toString().padStart(2, '0')} min` : `${remainder} s`
}

async function upload() {
  if (!file.value || !canUpload() || uploading.value) return
  uploading.value = true
  try {
    await ContentService.uploadMedia(file.value, altText.value, caption.value)
    toastStore.success('Archivo agregado a Multimedia')
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo subir el archivo.')
  } finally {
    uploading.value = false
  }
}

async function saveDetails() {
  if (!selected.value || !canEdit() || uploading.value) return
  uploading.value = true
  try {
    await ContentService.updateMedia(selected.value.id, {
      altText: altText.value.trim() || null,
      caption: caption.value.trim() || null,
      metadataJson: selected.value.metadataJson ?? null,
    })
    toastStore.success('Detalles actualizados')
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron guardar los detalles.')
  } finally {
    uploading.value = false
  }
}

async function remove(item: MediaDto) {
  if (!canDelete() || !window.confirm(`¿Eliminar la referencia “${item.fileName}” de Multimedia?`)) return
  try {
    await ContentService.deleteMedia(item.id)
    toastStore.success('Referencia eliminada')
    if (selected.value?.id === item.id) clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar la referencia.')
  }
}

watch(typeFilter, () => {
  clearEditor()
  void load()
})

onMounted(() => void load())
onBeforeUnmount(releasePreview)
</script>

<template>
  <div class="space-y-5">
    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-2xl font-black">Multimedia</h2>
          <p class="mt-1 text-sm opacity-60">Biblioteca de imágenes, videos y documentos reutilizables del sitio.</p>
        </div>
        <button v-if="canUpload()" class="primary-action" @click="clearEditor(); chooseFile()">
          <Plus class="h-4 w-4" /> Agregar archivo
        </button>
      </div>

      <div class="mt-5 grid gap-2 md:grid-cols-[minmax(0,1fr)_190px_auto]">
        <label class="relative">
          <Search class="pointer-events-none absolute left-3 top-3.5 h-4 w-4 opacity-45" />
          <input v-model="search" class="field w-full pl-10" placeholder="Buscar por nombre, Alt Text o Caption…" @keyup.enter="load" />
        </label>
        <select v-model="typeFilter" class="field">
          <option value="all">Todos los archivos</option>
          <option value="image">Imágenes</option>
          <option value="video">Videos</option>
          <option value="pdf">PDF</option>
          <option value="document">Documentos</option>
        </select>
        <button class="secondary-action" @click="load">Buscar</button>
      </div>

      <div class="mt-3 text-xs opacity-50">{{ visibleItems.length }} archivo{{ visibleItems.length === 1 ? '' : 's' }} en esta vista</div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <div v-if="loading" class="col-span-full p-10 text-center text-sm opacity-60">Cargando archivos…</div>
        <div
          v-for="item in visibleItems"
          v-else
          :key="item.id"
          class="media-card"
          :class="{ 'media-card-active': selected?.id === item.id }"
        >
          <button class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="select(item)">
            <span class="file-icon">
              <FileImage v-if="mediaKind(item.contentType, item.fileName) === 'image'" class="h-5 w-5" />
              <Film v-else-if="mediaKind(item.contentType, item.fileName) === 'video'" class="h-5 w-5" />
              <FileText v-else-if="mediaKind(item.contentType, item.fileName) === 'pdf'" class="h-5 w-5" />
              <FileIcon v-else class="h-5 w-5" />
            </span>
            <span class="min-w-0 flex-1">
              <strong class="block truncate text-sm">{{ item.fileName }}</strong>
              <span class="mt-1 block text-xs opacity-50">{{ readableType(item) }}</span>
            </span>
            <CheckCircle2 v-if="selected?.id === item.id" class="h-4 w-4 flex-none text-[var(--dh-primary)]" />
          </button>
          <button
            v-if="canDelete()"
            class="delete-button"
            title="Eliminar referencia"
            @click="remove(item)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
        <div v-if="!loading && !visibleItems.length" class="col-span-full p-10 text-center text-sm opacity-60">
          No hay archivos para este filtro.
        </div>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 class="text-xl font-black">{{ selected ? 'Archivo seleccionado' : 'Subir archivo' }}</h3>
          <p class="mt-1 text-sm opacity-60">
            {{ selected ? selected.fileName : 'Arrastre un archivo aquí o selecciónelo desde su equipo.' }}
          </p>
        </div>
        <button v-if="selected" class="secondary-action" @click="clearEditor(); chooseFile()">
          <Upload class="h-4 w-4" /> Subir otro
        </button>
      </div>

      <input
        ref="fileInput"
        class="hidden"
        type="file"
        :accept="MARKETING_MEDIA_ACCEPT"
        @change="handleInput"
      />

      <button
        v-if="!selected && canUpload()"
        type="button"
        class="drop-zone mt-5"
        :class="{ 'drop-zone-active': dragActive }"
        @click="chooseFile"
        @dragenter.prevent="dragActive = true"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="dragActive = false"
        @drop.prevent="handleDrop"
      >
        <Upload class="h-8 w-8 text-[var(--dh-primary)]" />
        <strong class="mt-3">{{ file ? file.name : 'Arrastre un archivo o haga clic para seleccionar' }}</strong>
        <span class="mt-1 max-w-xl text-xs opacity-50">JPG, PNG, WebP, AVIF, MP4, WebM, MOV, PDF, Word, Excel, PowerPoint, CSV y TXT.</span>
      </button>

      <div v-if="selected || file" class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
        <div class="preview-shell">
          <div v-if="previewLoading" class="preview-placeholder">Cargando vista previa…</div>
          <img
            v-else-if="previewUrl && activeKind === 'image'"
            :src="previewUrl"
            :alt="altText || selected?.fileName || file?.name || 'Vista previa'"
            class="preview-media"
          />
          <video v-else-if="previewUrl && activeKind === 'video'" :src="previewUrl" class="preview-media" controls />
          <iframe v-else-if="previewUrl && activeKind === 'pdf'" :src="previewUrl" class="h-[480px] w-full rounded-xl bg-white" title="Vista previa PDF" />
          <div v-else class="preview-placeholder">
            <FileText class="h-10 w-10 opacity-35" />
            <strong class="mt-3">{{ previewError || 'Vista previa visual no disponible' }}</strong>
            <span class="mt-1 text-xs opacity-50">El documento permanece disponible para reutilizarlo desde la biblioteca.</span>
          </div>
        </div>

        <div class="space-y-4">
          <label class="label">
            Alt Text
            <input v-model="altText" class="field mt-2 w-full" placeholder="Describa el contenido visual" />
          </label>
          <label class="label">
            Caption
            <textarea v-model="caption" class="field mt-2 min-h-24 w-full" placeholder="Descripción o pie de archivo" />
          </label>

          <div v-if="selected" class="metadata-card">
            <p class="text-xs font-black uppercase tracking-[.12em] opacity-45">Información técnica</p>
            <dl class="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><dt class="opacity-45">Tipo</dt><dd class="mt-1 font-bold">{{ readableType(selected) }}</dd></div>
              <div><dt class="opacity-45">Formato</dt><dd class="mt-1 font-bold">{{ technicalMetadata?.format || selected.contentType }}</dd></div>
              <div v-if="technicalMetadata?.width && technicalMetadata?.height"><dt class="opacity-45">Resolución</dt><dd class="mt-1 font-bold">{{ technicalMetadata.width }} × {{ technicalMetadata.height }}</dd></div>
              <div v-if="technicalMetadata?.durationSeconds != null"><dt class="opacity-45">Duración</dt><dd class="mt-1 font-bold">{{ formatDuration(technicalMetadata.durationSeconds) }}</dd></div>
              <div v-if="technicalMetadata?.variants?.length"><dt class="opacity-45">Variantes</dt><dd class="mt-1 font-bold">{{ technicalMetadata.variants.length }}</dd></div>
            </dl>
          </div>

          <div class="flex flex-wrap gap-2">
            <button v-if="!selected && canUpload()" class="primary-action" :disabled="!file || uploading" @click="upload">
              <Upload class="h-4 w-4" /> Subir archivo
            </button>
            <button v-if="selected && canEdit()" class="primary-action" :disabled="uploading" @click="saveDetails">
              <Save class="h-4 w-4" /> Guardar Alt/Caption
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action:disabled{opacity:.4}.media-card{display:flex;align-items:center;gap:.5rem;border:1px solid var(--dh-border);border-radius:16px;padding:.75rem;transition:160ms}.media-card:hover,.media-card-active{border-color:color-mix(in srgb,var(--dh-primary) 55%,var(--dh-border));background:color-mix(in srgb,var(--dh-primary) 5%,transparent)}.file-icon{display:grid;height:42px;width:42px;flex:none;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--dh-primary) 10%,transparent);color:var(--dh-primary)}.delete-button{display:grid;height:34px;width:34px;flex:none;place-items:center;border-radius:10px;color:#dc2626;transition:150ms}.delete-button:hover{background:rgb(239 68 68 / .1)}.drop-zone{display:flex;width:100%;min-height:180px;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--dh-border);border-radius:18px;padding:1.5rem;text-align:center;transition:160ms}.drop-zone:hover,.drop-zone-active{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 5%,transparent)}.preview-shell{display:flex;min-height:320px;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--dh-border);border-radius:18px;background:color-mix(in srgb,var(--dh-surface) 78%,transparent);padding:.75rem}.preview-media{max-height:520px;max-width:100%;border-radius:12px;object-fit:contain}.preview-placeholder{display:flex;min-height:280px;width:100%;flex-direction:column;align-items:center;justify-content:center;text-align:center}.metadata-card{border:1px solid var(--dh-border);border-radius:16px;padding:1rem;background:color-mix(in srgb,var(--dh-surface) 82%,transparent)}
</style>
