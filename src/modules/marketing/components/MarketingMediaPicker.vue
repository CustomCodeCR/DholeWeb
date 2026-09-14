<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Image as ImageIcon, Save } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { downloadFile } from '@/core/api/fetchConfig'
import { isAllowedMarketingFile, mediaKind } from '@/core/media/mediaLibrary'
import { ContentService } from '@/core/services/contentService'
import { useAuthStore } from '@/core/stores/authStore'
import { useLocale } from '@/core/stores/locale'
import { useToastStore } from '@/core/stores/toastStore'
import type { MediaDto } from '@/core/interfaces/content'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSkeleton from '@/shared/components/atoms/DhSkeleton.vue'
import DhTextarea from '@/shared/components/atoms/DhTextarea.vue'
import DhDropZone, { type DhDropZoneRejection } from '@/shared/components/molecules/DhDropZone.vue'
import DhMediaPicker, { type DhMediaPickerItem } from '@/shared/components/organisms/DhMediaPicker.vue'

export interface MarketingMediaSelection {
  id: string
  fileName: string
  altText: string
  caption: string
}

type ImageFilter = 'all' | 'jpeg' | 'png' | 'webp' | 'avif'

const props = withDefaults(defineProps<{
  open: boolean
  modelValue?: string | null
  disabled?: boolean
}>(), {
  modelValue: null,
  disabled: false,
})

const emit = defineEmits<{
  close: []
  select: [value: MarketingMediaSelection]
}>()

const authStore = useAuthStore()
const localeStore = useLocale()
const toastStore = useToastStore()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const loading = ref(false)
const uploading = ref(false)
const saving = ref(false)
const previewLoading = ref(false)
const media = ref<MediaDto[]>([])
const selectedId = ref<string | null>(props.modelValue ?? null)
const imageFilter = ref<ImageFilter>('all')
const altText = ref('')
const caption = ref('')
const previewUrl = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const internalOpen = ref(false)

const canUpload = computed(() => authStore.hasScope(CONTENT_SCOPES.media.upload))
const canEdit = computed(() => authStore.hasScope(CONTENT_SCOPES.edit))
const pickerOpen = computed(() => props.open || internalOpen.value)
const selectedMedia = computed(() => media.value.find((item) => item.id === selectedId.value) ?? null)

const filterOptions = computed(() => [
  { value: 'all', label: tr('Todas', 'All') },
  { value: 'jpeg', label: 'JPG / JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
])

function extension(fileName: string) {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? ''
}

const visibleMedia = computed(() => {
  if (imageFilter.value === 'all') return media.value
  return media.value.filter((item) => {
    const ext = extension(item.fileName)
    if (imageFilter.value === 'jpeg') return ext === 'jpg' || ext === 'jpeg'
    return ext === imageFilter.value
  })
})

const pickerItems = computed<DhMediaPickerItem[]>(() => visibleMedia.value.map((item) => ({
  id: item.id,
  name: item.fileName,
  kind: 'image',
  meta: item.contentType,
  ...(item.id === selectedId.value && previewUrl.value ? { thumbnailUrl: previewUrl.value } : {}),
})))

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function loadPreview(item: MediaDto | null) {
  releasePreview()
  if (!item) return
  previewLoading.value = true
  try {
    const response = await downloadFile(`/api/content/media/${item.id}/content`, item.fileName)
    previewUrl.value = URL.createObjectURL(response.blob)
  } catch (error) {
    toastStore.backendWarning(error, tr('No se pudo cargar la vista previa.', 'Preview could not be loaded.'))
  } finally {
    previewLoading.value = false
  }
}

async function loadLibrary() {
  loading.value = true
  try {
    const response = await ContentService.browseMedia({ pageNumber: 1, pageSize: 300, contentType: 'image/' })
    media.value = response.items.filter((item) => mediaKind(item.contentType, item.fileName) === 'image')
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo cargar la biblioteca de imágenes.', 'The image library could not be loaded.'))
  } finally {
    loading.value = false
  }
}

function syncSelectedDetails() {
  const item = selectedMedia.value
  altText.value = item?.altText ?? ''
  caption.value = item?.caption ?? ''
  void loadPreview(item)
}

function isSupportedImage(file: File) {
  return isAllowedMarketingFile(file) && mediaKind(file.type, file.name) === 'image'
}

function generatedAltText(file: File) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
}

function selectionFromMedia(item: MediaDto, fallbackAlt = ''): MarketingMediaSelection {
  return {
    id: item.id,
    fileName: item.fileName,
    altText: item.altText ?? fallbackAlt,
    caption: item.caption ?? '',
  }
}

async function uploadImage(file: File, autoSelect: boolean) {
  if (props.disabled || !canUpload.value || uploading.value) return null
  if (!isSupportedImage(file)) {
    toastStore.warning(
      tr('Formato no permitido', 'Unsupported format'),
      tr('Seleccione una imagen JPG, PNG, WebP o AVIF.', 'Choose a JPG, PNG, WebP or AVIF image.'),
    )
    return null
  }

  uploading.value = true
  const generatedAlt = generatedAltText(file)
  releasePreview()
  previewUrl.value = URL.createObjectURL(file)

  try {
    const uploaded = await ContentService.uploadMedia(file, generatedAlt)
    media.value = [uploaded, ...media.value.filter((item) => item.id !== uploaded.id)]
    selectedId.value = uploaded.id
    altText.value = uploaded.altText ?? generatedAlt
    caption.value = uploaded.caption ?? ''
    toastStore.success(tr('Imagen subida', 'Image uploaded'))

    if (autoSelect) emit('select', selectionFromMedia(uploaded, generatedAlt))
    return uploaded
  } catch (error) {
    releasePreview()
    toastStore.backendError(error, tr('No se pudo subir la imagen.', 'The image could not be uploaded.'))
    return null
  } finally {
    uploading.value = false
  }
}

function chooseUpload() {
  if (!props.disabled && canUpload.value) fileInput.value?.click()
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await uploadImage(file, false)
}

function handleDroppedFiles(files: File[]) {
  const file = files[0]
  if (file) void uploadImage(file, true)
}

function handleRejected(rejections: DhDropZoneRejection[]) {
  if (rejections.some((item) => item.reason === 'multiple')) {
    toastStore.warning(
      tr('Solo una imagen', 'One image only'),
      tr('Suelte una sola imagen a la vez.', 'Drop one image at a time.'),
    )
    return
  }

  toastStore.warning(
    tr('Formato no permitido', 'Unsupported format'),
    tr('Use una imagen JPG, PNG, WebP o AVIF.', 'Use a JPG, PNG, WebP or AVIF image.'),
  )
}

function openLibrary() {
  if (!props.disabled) internalOpen.value = true
}

function closeLibrary() {
  internalOpen.value = false
  emit('close')
}

async function saveDetails(showToast = true) {
  const item = selectedMedia.value
  if (!item || !canEdit.value || saving.value) return true
  const nextAlt = altText.value.trim()
  const nextCaption = caption.value.trim()
  if ((item.altText ?? '') === nextAlt && (item.caption ?? '') === nextCaption) return true

  saving.value = true
  try {
    await ContentService.updateMedia(item.id, {
      altText: nextAlt || null,
      caption: nextCaption || null,
      metadataJson: item.metadataJson ?? null,
    })
    media.value = media.value.map((candidate) => candidate.id === item.id
      ? { ...candidate, altText: nextAlt || null, caption: nextCaption || null }
      : candidate)
    if (showToast) toastStore.success(tr('Detalles de imagen actualizados', 'Image details updated'))
    return true
  } catch (error) {
    toastStore.backendError(error, tr('No se pudieron guardar los detalles de la imagen.', 'Image details could not be saved.'))
    return false
  } finally {
    saving.value = false
  }
}

async function confirmSelection(item: DhMediaPickerItem) {
  const current = media.value.find((candidate) => candidate.id === item.id)
  if (!current) return
  if (!(await saveDetails(false))) return
  emit('select', {
    id: current.id,
    fileName: current.fileName,
    altText: altText.value.trim(),
    caption: caption.value.trim(),
  })
  closeLibrary()
}

watch(() => props.modelValue, (value) => {
  if (!pickerOpen.value) selectedId.value = value ?? null
})

watch(selectedId, () => syncSelectedDetails())
watch(pickerOpen, async (open) => {
  if (!open) return
  selectedId.value = props.modelValue ?? selectedId.value
  await loadLibrary()
  syncSelectedDetails()
}, { immediate: true })

onBeforeUnmount(releasePreview)
</script>

<template>
  <div class="space-y-3">
    <DhDropZone
      :title="uploading ? tr('Subiendo imagen...', 'Uploading image...') : tr('Arrastre una imagen aquí', 'Drag an image here')"
      :description="tr('La imagen se subirá a Storage, se creará su referencia y quedará seleccionada automáticamente.', 'The image will be uploaded to Storage, referenced, and selected automatically.')"
      :browse-label="canUpload ? tr('Seleccionar desde equipo', 'Choose from computer') : undefined"
      accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
      :disabled="disabled || !canUpload || uploading"
      @files="handleDroppedFiles"
      @rejected="handleRejected"
    />

    <div class="flex justify-center">
      <DhButton
        :label="tr('Seleccionar desde biblioteca', 'Choose from library')"
        :icon="ImageIcon"
        variant="secondary"
        size="sm"
        :disabled="disabled"
        @click="openLibrary"
      />
    </div>

    <div v-if="previewLoading || previewUrl" class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <DhSkeleton v-if="previewLoading" height="10rem" rounded="lg" />
      <img
        v-else-if="previewUrl"
        :src="previewUrl"
        :alt="altText || selectedMedia?.fileName || tr('Vista previa de imagen', 'Image preview')"
        class="max-h-64 w-full rounded-xl object-contain"
      />
    </div>

    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="hidden" @change="handleUpload" />

    <DhMediaPicker
      v-model="selectedId"
      :open="pickerOpen"
      :items="pickerItems"
      :title="tr('Biblioteca de imágenes', 'Image library')"
      :search-placeholder="tr('Buscar imagen...', 'Search image...')"
      :empty-title="tr('No hay imágenes', 'No images')"
      :empty-description="tr('Cambie el filtro o suba una nueva imagen.', 'Change the filter or upload a new image.')"
      :confirm-label="tr('Seleccionar imagen', 'Select image')"
      :cancel-label="tr('Cancelar', 'Cancel')"
      :loading="loading"
      :filter-value="imageFilter"
      :filter-options="filterOptions"
      :upload-label="canUpload ? tr('Subir imagen', 'Upload image') : undefined"
      :upload-disabled="disabled || !canUpload"
      :uploading="uploading"
      :auto-close="false"
      @update:filter-value="imageFilter = String($event) as ImageFilter"
      @upload="chooseUpload"
      @select="confirmSelection"
      @close="closeLibrary"
    >
      <template #details="{ item }">
        <div v-if="item && selectedMedia" class="grid gap-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
          <div class="grid min-h-48 place-items-center overflow-hidden rounded-2xl bg-black/[0.04] dark:bg-white/[0.05]">
            <DhSkeleton v-if="previewLoading" class="h-full w-full" height="12rem" rounded="lg" />
            <img v-else-if="previewUrl" :src="previewUrl" :alt="altText || selectedMedia.fileName" class="max-h-72 w-full object-contain" />
            <div v-else class="flex flex-col items-center gap-2 p-8 text-center text-[var(--dh-text-muted)]">
              <ImageIcon class="h-10 w-10" />
              <span class="text-xs font-bold">{{ tr('Vista previa no disponible', 'Preview unavailable') }}</span>
            </div>
          </div>

          <div class="space-y-3">
            <DhInput
              v-model="altText"
              label="ALT Text"
              :placeholder="tr('Describa la imagen', 'Describe the image')"
              :disabled="disabled || !canEdit"
            />
            <DhTextarea
              v-model="caption"
              :label="tr('Caption', 'Caption')"
              :placeholder="tr('Pie o descripción de la imagen', 'Image caption or description')"
              :disabled="disabled || !canEdit"
              :rows="3"
            />
            <DhButton
              v-if="canEdit"
              :label="tr('Guardar detalles', 'Save details')"
              :icon="Save"
              variant="secondary"
              size="sm"
              :loading="saving"
              :disabled="disabled"
              @click="saveDetails()"
            />
          </div>
        </div>
      </template>
    </DhMediaPicker>
  </div>
</template>
