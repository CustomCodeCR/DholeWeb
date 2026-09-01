<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-vue-next'
import { StorageService } from '@/core/services/storageService'

const props = withDefaults(
  defineProps<{
    fileId?: string | null
    alt?: string
  }>(),
  {
    fileId: null,
    alt: 'Imagen',
  },
)

const attrs = useAttrs()
const source = ref('')
const loading = ref(false)
const failed = ref(false)
const galleryFileIds = ref<string[]>([])
const galleryIndex = ref(0)
let objectUrl = ''
let loadSequence = 0

const autoWarehouseGallery = computed(() => {
  const classes = String(attrs.class ?? '')
  // La tarjeta FCA usa esta miniatura compacta. El editor de Config usa h-full/w-full
  // y ya tiene su propio carrusel, por lo que no debemos duplicar controles allí.
  return classes.includes('h-28') && classes.includes('w-28')
})

const activeFileId = computed(() =>
  galleryFileIds.value[galleryIndex.value] ?? props.fileId?.trim() ?? '',
)

function clearObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = ''
  source.value = ''
}

function normalizedImageIds(items: Array<{ id: string; createdAt?: string | null }>, coverId: string) {
  const ordered = [...items]
    .sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
    .map((item) => item.id)
    .filter(Boolean)

  const unique = [...new Set(ordered)]
  if (!unique.includes(coverId)) unique.unshift(coverId)
  return unique
}

async function resolveWarehouseGallery(fileId: string) {
  galleryFileIds.value = [fileId]
  galleryIndex.value = 0
  if (!autoWarehouseGallery.value) return

  try {
    const file = await StorageService.getFile(fileId)
    const warehouseReference = file.references?.find((reference) =>
      reference.entityType === 'PricingWarehouse' && Boolean(reference.entityId),
    )
    if (!warehouseReference?.entityId) return

    const page = await StorageService.browse({
      pageNumber: 1,
      pageSize: 250,
      entityType: 'PricingWarehouse',
    })

    const relatedImages = page.items.filter((candidate) =>
      candidate.entityId === warehouseReference.entityId &&
      String(candidate.contentType ?? '').toLowerCase().startsWith('image/'),
    )

    galleryFileIds.value = normalizedImageIds(relatedImages, fileId)
    galleryIndex.value = Math.max(0, galleryFileIds.value.indexOf(fileId))
  } catch {
    // Si no se puede resolver la galería, la imagen de portada sigue funcionando.
    galleryFileIds.value = [fileId]
    galleryIndex.value = 0
  }
}

async function loadContent() {
  const sequence = ++loadSequence
  clearObjectUrl()
  failed.value = false

  const fileId = activeFileId.value
  if (!fileId) return

  try {
    loading.value = true
    const blob = await StorageService.getContent(fileId)
    if (sequence !== loadSequence) return
    objectUrl = URL.createObjectURL(blob)
    source.value = objectUrl
  } catch {
    if (sequence === loadSequence) failed.value = true
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function load() {
  const fileId = props.fileId?.trim()
  clearObjectUrl()
  galleryFileIds.value = []
  galleryIndex.value = 0
  failed.value = false
  if (!fileId) return

  await resolveWarehouseGallery(fileId)
  await loadContent()
}

function previousImage() {
  const length = galleryFileIds.value.length
  if (length <= 1) return
  galleryIndex.value = (galleryIndex.value - 1 + length) % length
}

function nextImage() {
  const length = galleryFileIds.value.length
  if (length <= 1) return
  galleryIndex.value = (galleryIndex.value + 1) % length
}

watch(() => props.fileId, () => void load(), { immediate: true })
watch(galleryIndex, () => void loadContent())
onBeforeUnmount(() => {
  loadSequence += 1
  clearObjectUrl()
})
</script>

<template>
  <div class="relative grid place-items-center overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]">
    <img
      v-if="source"
      :src="source"
      :alt="alt"
      class="h-full w-full object-cover"
      loading="lazy"
    />
    <span v-else-if="loading" class="text-[11px] font-bold text-[var(--dh-text-muted)]">Cargando…</span>
    <div v-else class="flex flex-col items-center gap-1 text-[var(--dh-text-muted)]">
      <ImageOff class="h-5 w-5" />
      <span class="text-[10px] font-bold">{{ failed ? 'No disponible' : 'Sin imagen' }}</span>
    </div>

    <template v-if="autoWarehouseGallery && galleryFileIds.length > 1">
      <button
        type="button"
        aria-label="Imagen anterior del WHS"
        class="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/55 text-white shadow-md backdrop-blur transition hover:bg-black/75"
        @click.stop="previousImage"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Imagen siguiente del WHS"
        class="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/55 text-white shadow-md backdrop-blur transition hover:bg-black/75"
        @click.stop="nextImage"
      >
        <ChevronRight class="h-4 w-4" />
      </button>
      <span class="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur">
        {{ galleryIndex + 1 }}/{{ galleryFileIds.length }}
      </span>
    </template>
  </div>
</template>
