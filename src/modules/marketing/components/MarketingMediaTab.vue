<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CheckCircle2,
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
  formatMediaFileSize,
  isAllowedMarketingFile,
  MARKETING_MEDIA_ACCEPT,
  mediaKind,
  mediaSizeInBytes,
  parseMarketingMediaMetadata,
} from '@/core/media/mediaLibrary'
import { useAuthStore } from '@/core/stores/authStore'
import { useLocale } from '@/core/stores/locale'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type { MediaDto } from '@/core/interfaces/content'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSkeleton from '@/shared/components/atoms/DhSkeleton.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import DhDropZone from '@/shared/components/molecules/DhDropZone.vue'
import DhModal from '@/shared/components/organisms/DhModal.vue'
import MarketingMediaThumbnail from '@/modules/marketing/components/MarketingMediaThumbnail.vue'

type MediaGalleryFilter = 'all' | 'image' | 'video' | 'document'

const authStore = useAuthStore()
const localeStore = useLocale()
const toastStore = useToastStore()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const loading = ref(false)
const uploading = ref(false)
const previewLoading = ref(false)
const items = ref<MediaDto[]>([])
const search = ref('')
const typeFilter = ref<MediaGalleryFilter>('all')
const selected = ref<MediaDto | null>(null)
const deleteCandidate = ref<MediaDto | null>(null)
const file = ref<File | null>(null)
const altText = ref('')
const caption = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const previewError = ref('')

const canUpload = () => authStore.hasScope(CONTENT_SCOPES.media.upload)
const canEdit = () => authStore.hasScope(CONTENT_SCOPES.edit)
const canDelete = () => authStore.hasScope(CONTENT_SCOPES.media.delete)

function galleryKind(item: MediaDto): Exclude<MediaGalleryFilter, 'all'> {
  const kind = mediaKind(item.contentType, item.fileName)
  if (kind === 'image') return 'image'
  if (kind === 'video') return 'video'
  return 'document'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeStore.locale === 'en' ? 'en-US' : 'es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function searchableDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.toLowerCase()
  const iso = date.toISOString().slice(0, 10)
  const localized = formatDate(value)
  return `${iso} ${localized} ${date.getFullYear()}`.toLocaleLowerCase(localeStore.locale)
}

const filterOptions = computed<Array<{ value: MediaGalleryFilter; label: string }>>(() => [
  { value: 'all', label: tr('Todos', 'All') },
  { value: 'image', label: tr('Imágenes', 'Images') },
  { value: 'video', label: tr('Videos', 'Videos') },
  { value: 'document', label: tr('Documentos', 'Documents') },
])

const filterCounts = computed(() => ({
  all: items.value.length,
  image: items.value.filter((item) => galleryKind(item) === 'image').length,
  video: items.value.filter((item) => galleryKind(item) === 'video').length,
  document: items.value.filter((item) => galleryKind(item) === 'document').length,
}))

const visibleItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase(localeStore.locale)
  return items.value.filter((item) => {
    if (typeFilter.value !== 'all' && galleryKind(item) !== typeFilter.value) return false
    if (!query) return true

    const haystack = [
      item.fileName,
      item.altText ?? '',
      searchableDate(item.createdAtUtc),
    ].join(' ').toLocaleLowerCase(localeStore.locale)

    return haystack.includes(query)
  })
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
    const response = await ContentService.browseMedia({ pageNumber: 1, pageSize: 300 })
    items.value = response.items
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo cargar la biblioteca multimedia.', 'The media library could not be loaded.'))
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
  if (galleryKind(item) === 'document') return

  previewLoading.value = true
  try {
    const response = await downloadFile(
      `/api/content/media/${item.id}/content`,
      item.fileName,
    )
    previewUrl.value = URL.createObjectURL(response.blob)
  } catch (error) {
    previewError.value = tr('No se pudo cargar la vista previa.', 'Preview could not be loaded.')
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
      tr('Formato no permitido', 'Unsupported format'),
      tr(
        'Use imágenes, videos, PDF, Word, Excel, PowerPoint, CSV o TXT.',
        'Use images, videos, PDF, Word, Excel, PowerPoint, CSV or TXT.',
      ),
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

function handleDropZoneFiles(files: File[]) {
  setFile(files[0])
}

function handleRejectedFiles() {
  toastStore.warning(
    tr('Archivo no permitido', 'File not allowed'),
    tr('Seleccione un formato compatible con Multimedia.', 'Choose a format supported by Media.'),
  )
}

function readableType(item: MediaDto) {
  const kind = mediaKind(item.contentType, item.fileName)
  if (kind === 'image') return tr('Imagen', 'Image')
  if (kind === 'video') return tr('Video', 'Video')
  if (kind === 'pdf') return 'PDF'
  return tr('Documento', 'Document')
}

function fileSize(item: MediaDto) {
  return formatMediaFileSize(mediaSizeInBytes(item.metadataJson))
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
    toastStore.success(tr('Archivo agregado a Multimedia', 'File added to Media'))
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo subir el archivo.', 'The file could not be uploaded.'))
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
    toastStore.success(tr('Detalles actualizados', 'Details updated'))
    clearEditor()
    await load()
  } catch (error) {
    toastStore.backendError(error, tr('No se pudieron guardar los detalles.', 'Details could not be saved.'))
  } finally {
    uploading.value = false
  }
}

function requestRemove(item: MediaDto) {
  if (!canDelete()) return
  deleteCandidate.value = item
}

async function confirmRemove() {
  const item = deleteCandidate.value
  if (!item || !canDelete()) return
  try {
    await ContentService.deleteMedia(item.id)
    toastStore.success(tr('Referencia eliminada', 'Media reference deleted'))
    if (selected.value?.id === item.id) clearEditor()
    deleteCandidate.value = null
    await load()
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo eliminar la referencia.', 'The media reference could not be deleted.'))
  }
}

onMounted(() => void load())
onBeforeUnmount(releasePreview)
</script>

<template>
  <div class="space-y-5">
    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-2xl font-black">{{ tr('Multimedia', 'Media') }}</h2>
          <p class="mt-1 text-sm opacity-60">
            {{ tr('Biblioteca visual de imágenes, videos y documentos reutilizables del sitio.', 'Visual library of reusable site images, videos and documents.') }}
          </p>
        </div>
        <DhButton
          v-if="canUpload()"
          :label="tr('Agregar archivo', 'Add file')"
          :icon="Plus"
          @click="clearEditor(); chooseFile()"
        />
      </div>

      <div class="mt-5 flex flex-col gap-3">
        <div class="relative max-w-2xl">
          <Search class="pointer-events-none absolute left-3 top-3.5 z-10 h-4 w-4 text-[var(--dh-text-muted)]" />
          <DhInput
            v-model="search"
            class="pl-7"
            type="search"
            :placeholder="tr('Buscar por nombre, ALT o fecha...', 'Search by name, ALT or date...')"
          />
        </div>

        <div class="flex flex-wrap gap-2" role="group" :aria-label="tr('Filtrar multimedia', 'Filter media')">
          <DhButton
            v-for="option in filterOptions"
            :key="option.value"
            :label="`${option.label} (${filterCounts[option.value]})`"
            :variant="typeFilter === option.value ? 'primary' : 'secondary'"
            size="sm"
            @click="typeFilter = option.value"
          />
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--dh-text-muted)]">
        <span>{{ tr(`${visibleItems.length} archivo${visibleItems.length === 1 ? '' : 's'}`, `${visibleItems.length} file${visibleItems.length === 1 ? '' : 's'}`) }}</span>
        <span v-if="search.trim()">{{ tr('Filtro instantáneo activo', 'Instant search active') }}</span>
      </div>

      <div v-if="loading" class="media-gallery mt-4">
        <div v-for="index in 10" :key="index" class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)]">
          <DhSkeleton height="9rem" rounded="none" />
          <div class="space-y-2 p-3"><DhSkeleton height="1rem" /><DhSkeleton height=".75rem" width="70%" /></div>
        </div>
      </div>

      <div v-else-if="visibleItems.length" class="media-gallery mt-4">
        <article
          v-for="item in visibleItems"
          :key="item.id"
          class="media-gallery-card"
          :class="{ 'media-gallery-card-active': selected?.id === item.id }"
        >
          <button type="button" class="block w-full min-w-0 text-left" @click="select(item)">
            <div class="relative">
              <MarketingMediaThumbnail :item="item" />
              <span
                class="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black text-white backdrop-blur"
              >
                {{ readableType(item) }}
              </span>
              <CheckCircle2
                v-if="selected?.id === item.id"
                class="absolute right-2 top-2 h-5 w-5 rounded-full bg-white text-[var(--dh-primary)]"
              />
            </div>

            <div class="min-w-0 p-3">
              <strong class="block truncate text-sm text-[var(--dh-text)]">{{ item.fileName }}</strong>
              <p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">
                {{ item.altText || tr('Sin ALT', 'No ALT') }}
              </p>
              <div class="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-bold text-[var(--dh-text-muted)]">
                <span>{{ fileSize(item) }}</span>
                <span class="text-right">{{ formatDate(item.createdAtUtc) }}</span>
              </div>
            </div>
          </button>

          <DhIconButton
            v-if="canDelete()"
            class="absolute bottom-2 right-2"
            :icon="Trash2"
            :label="tr('Eliminar referencia', 'Delete media reference')"
            variant="danger"
            size="sm"
            @click="requestRemove(item)"
          />
        </article>
      </div>

      <DhEmptyState
        v-else
        class="mt-5"
        :icon="FileImage"
        :title="tr('No hay archivos para esta vista', 'No files for this view')"
        :description="tr('Cambie el filtro o la búsqueda para encontrar otro recurso.', 'Change the filter or search to find another asset.')"
      />
    </section>

    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 class="text-xl font-black">
            {{ selected ? tr('Archivo seleccionado', 'Selected file') : tr('Subir archivo', 'Upload file') }}
          </h3>
          <p class="mt-1 text-sm opacity-60">
            {{ selected ? selected.fileName : tr('Arrastre un archivo aquí o selecciónelo desde su equipo.', 'Drag a file here or choose it from your computer.') }}
          </p>
        </div>
        <DhButton
          v-if="selected && canUpload()"
          :label="tr('Subir otro', 'Upload another')"
          :icon="Upload"
          variant="secondary"
          @click="clearEditor(); chooseFile()"
        />
      </div>

      <input
        ref="fileInput"
        class="hidden"
        type="file"
        :accept="MARKETING_MEDIA_ACCEPT"
        @change="handleInput"
      />

      <DhDropZone
        v-if="!selected && canUpload()"
        class="mt-5"
        :title="file ? file.name : tr('Arrastre un archivo o haga clic para seleccionar', 'Drag a file or click to choose')"
        :description="tr('JPG, PNG, WebP, AVIF, MP4, WebM, MOV, PDF, Word, Excel, PowerPoint, CSV y TXT.', 'JPG, PNG, WebP, AVIF, MP4, WebM, MOV, PDF, Word, Excel, PowerPoint, CSV and TXT.')"
        :browse-label="tr('Seleccionar archivo', 'Choose file')"
        :accept="MARKETING_MEDIA_ACCEPT"
        :disabled="uploading"
        @files="handleDropZoneFiles"
        @rejected="handleRejectedFiles"
      />

      <div v-if="selected || file" class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
        <div class="preview-shell">
          <div v-if="previewLoading" class="preview-placeholder">{{ tr('Cargando vista previa...', 'Loading preview...') }}</div>
          <img
            v-else-if="previewUrl && activeKind === 'image'"
            :src="previewUrl"
            :alt="altText || selected?.fileName || file?.name || tr('Vista previa', 'Preview')"
            class="preview-media"
          />
          <video v-else-if="previewUrl && activeKind === 'video'" :src="previewUrl" class="preview-media" controls />
          <iframe
            v-else-if="previewUrl && activeKind === 'pdf'"
            :src="previewUrl"
            class="h-[480px] w-full rounded-xl bg-white"
            :title="tr('Vista previa PDF', 'PDF preview')"
          />
          <div v-else class="preview-placeholder">
            <FileText class="h-10 w-10 opacity-35" />
            <strong class="mt-3">{{ previewError || tr('Vista previa visual no disponible', 'Visual preview unavailable') }}</strong>
            <span class="mt-1 text-xs opacity-50">
              {{ tr('El documento permanece disponible para reutilizarlo desde la biblioteca.', 'The document remains available for reuse from the library.') }}
            </span>
          </div>
        </div>

        <div class="space-y-4">
          <DhInput
            v-model="altText"
            label="ALT Text"
            :placeholder="tr('Describa el contenido visual', 'Describe the visual content')"
            :disabled="selected ? !canEdit() : false"
          />
          <DhTextarea
            v-model="caption"
            label="Caption"
            :placeholder="tr('Descripción o pie de archivo', 'File caption or description')"
            :disabled="selected ? !canEdit() : false"
            :rows="4"
          />

          <div v-if="selected" class="metadata-card">
            <p class="text-xs font-black uppercase tracking-[.12em] opacity-45">{{ tr('Detalles del archivo', 'File details') }}</p>
            <dl class="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><dt class="opacity-45">{{ tr('Tipo', 'Type') }}</dt><dd class="mt-1 font-bold">{{ readableType(selected) }}</dd></div>
              <div><dt class="opacity-45">{{ tr('Tamaño', 'Size') }}</dt><dd class="mt-1 font-bold">{{ fileSize(selected) }}</dd></div>
              <div><dt class="opacity-45">{{ tr('Fecha', 'Date') }}</dt><dd class="mt-1 font-bold">{{ formatDate(selected.createdAtUtc) }}</dd></div>
              <div><dt class="opacity-45">{{ tr('Formato', 'Format') }}</dt><dd class="mt-1 font-bold">{{ technicalMetadata?.format || selected.contentType }}</dd></div>
              <div v-if="technicalMetadata?.width && technicalMetadata?.height"><dt class="opacity-45">{{ tr('Resolución', 'Resolution') }}</dt><dd class="mt-1 font-bold">{{ technicalMetadata.width }} × {{ technicalMetadata.height }}</dd></div>
              <div v-if="technicalMetadata?.durationSeconds != null"><dt class="opacity-45">{{ tr('Duración', 'Duration') }}</dt><dd class="mt-1 font-bold">{{ formatDuration(technicalMetadata.durationSeconds) }}</dd></div>
              <div v-if="technicalMetadata?.variants?.length"><dt class="opacity-45">{{ tr('Variantes', 'Variants') }}</dt><dd class="mt-1 font-bold">{{ technicalMetadata.variants.length }}</dd></div>
            </dl>
          </div>

          <div class="flex flex-wrap gap-2">
            <DhButton
              v-if="!selected && canUpload()"
              :label="tr('Subir archivo', 'Upload file')"
              :icon="Upload"
              :loading="uploading"
              :disabled="!file"
              @click="upload"
            />
            <DhButton
              v-if="selected && canEdit()"
              :label="tr('Guardar Alt/Caption', 'Save Alt/Caption')"
              :icon="Save"
              :loading="uploading"
              @click="saveDetails"
            />
          </div>
        </div>
      </div>
    </section>

    <DhModal
      :open="Boolean(deleteCandidate)"
      :title="tr('Confirmar eliminación', 'Confirm deletion')"
      size="sm"
      @close="deleteCandidate = null"
    >
      <DhConfirmDialog
        :title="tr('¿Eliminar este archivo de Multimedia?', 'Delete this file from Media?')"
        :message="tr('Se eliminará la referencia multimedia seleccionada.', 'The selected media reference will be deleted.')"
        :confirm-label="tr('Eliminar', 'Delete')"
        :cancel-label="tr('Cancelar', 'Cancel')"
        :danger="true"
        :on-confirm="confirmRemove"
        :on-cancel="() => { deleteCandidate = null }"
      />
    </DhModal>
  </div>
</template>

<style scoped>
.media-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.media-gallery-card{position:relative;min-width:0;overflow:hidden;border:1px solid var(--dh-border);border-radius:18px;background:var(--dh-surface);box-shadow:var(--dh-shadow-sm);transition:160ms}.media-gallery-card:hover,.media-gallery-card-active{border-color:color-mix(in srgb,var(--dh-primary) 58%,var(--dh-border));box-shadow:var(--dh-shadow-md);transform:translateY(-1px)}.preview-shell{display:flex;min-height:320px;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--dh-border);border-radius:18px;background:color-mix(in srgb,var(--dh-surface) 78%,transparent);padding:.75rem}.preview-media{max-height:520px;max-width:100%;border-radius:12px;object-fit:contain}.preview-placeholder{display:flex;min-height:280px;width:100%;flex-direction:column;align-items:center;justify-content:center;text-align:center}.metadata-card{border:1px solid var(--dh-border);border-radius:16px;padding:1rem;background:color-mix(in srgb,var(--dh-surface) 82%,transparent)}@media (min-width:640px){.media-gallery{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (min-width:1024px){.media-gallery{grid-template-columns:repeat(4,minmax(0,1fr))}}@media (min-width:1536px){.media-gallery{grid-template-columns:repeat(5,minmax(0,1fr))}}
</style>
