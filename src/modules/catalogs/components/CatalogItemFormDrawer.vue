<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import DhStorageImage from '@/shared/components/DhStorageImage.vue'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { StorageService } from '@/core/services/storageService'
import type { CatalogGroupDto, CatalogItemDto } from '@/core/interfaces/catalogs'
import MetadataEditor from '@/modules/catalogs/components/MetadataEditor.vue'

const props = defineProps<{
  group: CatalogGroupDto
  item?: CatalogItemDto
  nextSortOrder?: number
  onSaved?: () => Promise<void> | void
}>()

const { t } = useI18n()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)

interface WarehouseStoredImage {
  storageId: string
  fileName?: string
}

interface PendingWarehouseImage {
  id: string
  file: File
  previewUrl: string
}

interface WarehouseCarouselImage {
  key: string
  storageId?: string
  previewUrl?: string
  fileName?: string
  pendingId?: string
}

const pendingWarehouseImages = ref<PendingWarehouseImage[]>([])
const warehouseCarouselIndex = ref(0)

const form = ref({
  name: props.item?.name ?? '',
  slug: props.item?.slug ?? '',
  description: props.item?.description ?? '',
  value: props.item?.value ?? '',
  metadataJson: props.item?.metadataJson ?? null,
  sortOrder: props.item?.sortOrder ?? props.nextSortOrder ?? 1,
  isSystem: props.item?.isSystem ?? false,
})

const isEdit = computed(() => Boolean(props.item))
const isWarehouseGroup = computed(() => props.group.slug === 'pricing-warehouses')

const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create))
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update))

const canSave = computed(() => {
  return isEdit.value ? canUpdate.value : canCreate.value
})

type WarehouseImageMetadata = Record<string, unknown> & {
  imageStorageId?: string
  imageFileName?: string
  images?: Array<{
    storageId?: string
    fileName?: string
  }>
}

function parseMetadataJson(value?: string | null): WarehouseImageMetadata {
  if (!value?.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as WarehouseImageMetadata)
      : {}
  } catch {
    return {}
  }
}

function storedWarehouseImages(metadata: WarehouseImageMetadata): WarehouseStoredImage[] {
  const images: WarehouseStoredImage[] = []
  const seen = new Set<string>()

  const add = (storageId?: string, fileName?: string) => {
    const id = String(storageId ?? '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    images.push({ storageId: id, fileName: String(fileName ?? '').trim() || undefined })
  }

  if (Array.isArray(metadata.images)) {
    metadata.images.forEach((image) => add(image?.storageId, image?.fileName))
  }

  // Compatibilidad con los WHS creados cuando solo se permitía una imagen.
  add(metadata.imageStorageId, metadata.imageFileName)

  return images
}

const warehouseImageMetadata = computed(() => parseMetadataJson(form.value.metadataJson))
const warehouseStoredImages = computed(() => storedWarehouseImages(warehouseImageMetadata.value))
const warehouseCarouselImages = computed<WarehouseCarouselImage[]>(() => [
  ...warehouseStoredImages.value.map((image) => ({
    key: `stored:${image.storageId}`,
    storageId: image.storageId,
    fileName: image.fileName,
  })),
  ...pendingWarehouseImages.value.map((image) => ({
    key: `pending:${image.id}`,
    previewUrl: image.previewUrl,
    fileName: image.file.name,
    pendingId: image.id,
  })),
])
const activeWarehouseImage = computed(() => warehouseCarouselImages.value[warehouseCarouselIndex.value] ?? null)

watch(
  () => warehouseCarouselImages.value.length,
  (length) => {
    if (!length) {
      warehouseCarouselIndex.value = 0
      return
    }
    if (warehouseCarouselIndex.value >= length) warehouseCarouselIndex.value = length - 1
  },
)

function clearPendingWarehouseImages() {
  pendingWarehouseImages.value.forEach((image) => URL.revokeObjectURL(image.previewUrl))
  pendingWarehouseImages.value = []
  warehouseCarouselIndex.value = 0
}

function selectWarehouseImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return

  const accepted: PendingWarehouseImage[] = []
  let rejectedType = 0
  let rejectedSize = 0

  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      rejectedType += 1
      continue
    }

    if (file.size > 5 * 1024 * 1024) {
      rejectedSize += 1
      continue
    }

    const duplicate = pendingWarehouseImages.value.some((image) =>
      image.file.name === file.name &&
      image.file.size === file.size &&
      image.file.lastModified === file.lastModified,
    )
    if (duplicate) continue

    accepted.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }

  if (rejectedType) {
    toastStore.warning('Archivo no válido', `${rejectedType} imagen(es) fueron omitidas. Use JPG, PNG o WEBP.`)
  }
  if (rejectedSize) {
    toastStore.warning('Imagen muy grande', `${rejectedSize} imagen(es) fueron omitidas por superar 5 MB.`)
  }
  if (!accepted.length) return

  const firstNewIndex = warehouseStoredImages.value.length + pendingWarehouseImages.value.length
  pendingWarehouseImages.value.push(...accepted)
  warehouseCarouselIndex.value = firstNewIndex
}

function removePendingWarehouseImage(pendingId: string) {
  const index = pendingWarehouseImages.value.findIndex((image) => image.id === pendingId)
  if (index < 0) return
  URL.revokeObjectURL(pendingWarehouseImages.value[index].previewUrl)
  pendingWarehouseImages.value.splice(index, 1)
}

function previousWarehouseImage() {
  const length = warehouseCarouselImages.value.length
  if (length <= 1) return
  warehouseCarouselIndex.value = (warehouseCarouselIndex.value - 1 + length) % length
}

function nextWarehouseImage() {
  const length = warehouseCarouselImages.value.length
  if (length <= 1) return
  warehouseCarouselIndex.value = (warehouseCarouselIndex.value + 1) % length
}

function selectWarehouseCarouselImage(index: number) {
  warehouseCarouselIndex.value = index
}

async function uploadWarehouseImages(entityId: string, metadataJson: string | null) {
  if (!isWarehouseGroup.value || !pendingWarehouseImages.value.length) return metadataJson

  const metadata = parseMetadataJson(metadataJson)
  const images = storedWarehouseImages(metadata)

  for (const [index, pendingImage] of pendingWarehouseImages.value.entries()) {
    const uploaded = await StorageService.uploadFile({
      file: pendingImage.file,
      sourceService: 'DholeWeb',
      entityType: 'PricingWarehouse',
      entityId,
      metadataJson: JSON.stringify({
        catalogGroupSlug: props.group.slug,
        warehouseName: form.value.name || null,
        imageIndex: images.length + index,
      }),
    })

    images.push({
      storageId: uploaded.id,
      fileName: uploaded.originalFileName || pendingImage.file.name,
    })
  }

  metadata.images = images.map((image) => ({
    storageId: image.storageId,
    fileName: image.fileName,
  }))

  // Conservamos los campos anteriores para cualquier pantalla/instalación que aún
  // consuma la imagen única del WHS. La primera imagen funciona como portada.
  metadata.imageStorageId = images[0]?.storageId
  metadata.imageFileName = images[0]?.fileName

  return JSON.stringify(metadata)
}

function resetCreateForm() {
  const nextSortOrder = Number(form.value.sortOrder || 0) + 1
  clearPendingWarehouseImages()

  form.value = {
    name: '',
    slug: '',
    description: '',
    value: '',
    metadataJson: null,
    sortOrder: nextSortOrder,
    isSystem: false,
  }
}

async function save() {
  if (!canSave.value) {
    toastStore.warning('Sin permiso', 'No tiene permiso para guardar este item.')
    return
  }

  try {
    loading.value = true

    if (props.item) {
      const metadataJson = await uploadWarehouseImages(props.item.id, form.value.metadataJson)

      await CatalogItemsService.update(props.item.id, {
        name: form.value.name,
        description: form.value.description || null,
        value: form.value.value || null,
        metadataJson,
        sortOrder: form.value.sortOrder,
      })

      form.value.metadataJson = metadataJson
      clearPendingWarehouseImages()
      toastStore.success('Guardado', t('catalogs.itemSaved'))
      await props.onSaved?.()
      drawerStore.close()
      return
    }

    const createdId = await CatalogItemsService.createForGroup(props.group.id, {
      name: form.value.name,
      slug: form.value.slug || null,
      description: form.value.description || null,
      value: form.value.value || null,
      metadataJson: form.value.metadataJson,
      sortOrder: form.value.sortOrder,
      isSystem: form.value.isSystem,
    })

    const metadataJson = await uploadWarehouseImages(createdId, form.value.metadataJson)
    if (metadataJson !== form.value.metadataJson) {
      await CatalogItemsService.update(createdId, {
        name: form.value.name,
        description: form.value.description || null,
        value: form.value.value || null,
        metadataJson,
        sortOrder: form.value.sortOrder,
      })
    }

    toastStore.success('Guardado', 'Item creado correctamente. Puede agregar otro.')
    await props.onSaved?.()
    resetCreateForm()
  } catch (error) {
    toastStore.backendError(error, t('catalogs.saveItemError'))
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(clearPendingWarehouseImages)
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
        {{ t('catalogs.group') }}
      </p>

      <p class="mt-1 text-sm font-black text-[var(--dh-text)]">
        {{ group.name }}
      </p>

      <p class="mt-1 text-xs font-bold text-[var(--dh-primary)]">
        {{ group.slug }}
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <DhInput
        v-model="form.name"
        :label="t('common.name')"
        :placeholder="t('catalogs.itemNamePlaceholder')"
        :disabled="!canSave"
      />

      <DhInput
        v-if="!isEdit"
        v-model="form.slug"
        :label="t('common.slug')"
        :placeholder="t('catalogs.itemSlugPlaceholder')"
        :disabled="!canSave"
      />

      <DhInput
        v-model="form.value"
        :label="t('common.value')"
        :placeholder="t('catalogs.itemValuePlaceholder')"
        :disabled="!canSave"
      />

      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">
          {{ t('common.order') }}
        </span>

        <input
          v-model.number="form.sortOrder"
          type="number"
          min="1"
          class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!canSave"
        />
      </label>

      <DhInput
        v-model="form.description"
        :label="t('common.description')"
        :placeholder="t('catalogs.itemDescriptionPlaceholder')"
        :disabled="!canSave"
        class="md:col-span-2"
      />

      <DhSwitch v-if="!isEdit" v-model="form.isSystem" :label="t('catalogs.systemItem')" />
    </div>

    <section
      v-if="isWarehouseGroup"
      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
    >
      <div class="space-y-4">
        <div>
          <p class="text-sm font-black text-[var(--dh-text)]">Imágenes del WHS</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Puede cargar varias fotos JPG, PNG o WEBP de hasta 5 MB cada una. La primera imagen queda como portada y todas se conservan en el carrusel del WHS.
          </p>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]"
        >
          <div class="aspect-[16/9] w-full">
            <img
              v-if="activeWarehouseImage?.previewUrl"
              :src="activeWarehouseImage.previewUrl"
              :alt="`Vista previa de ${form.name || 'WHS'}`"
              class="h-full w-full object-cover"
            />
            <DhStorageImage
              v-else-if="activeWarehouseImage?.storageId"
              :file-id="activeWarehouseImage.storageId"
              :alt="`Imagen de ${form.name || 'WHS'}`"
              class="h-full w-full"
            />
            <div
              v-else
              class="grid h-full w-full place-items-center px-4 text-center text-xs font-bold text-[var(--dh-text-muted)]"
            >
              Sin imágenes. Puede seleccionar varias fotografías del WHS.
            </div>
          </div>

          <template v-if="warehouseCarouselImages.length > 1">
            <button
              type="button"
              aria-label="Imagen anterior"
              class="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/45 text-xl font-black text-white shadow-lg backdrop-blur transition hover:bg-black/65"
              @click="previousWarehouseImage"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Imagen siguiente"
              class="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/45 text-xl font-black text-white shadow-lg backdrop-blur transition hover:bg-black/65"
              @click="nextWarehouseImage"
            >
              ›
            </button>
            <span
              class="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur"
            >
              {{ warehouseCarouselIndex + 1 }} / {{ warehouseCarouselImages.length }}
            </span>
          </template>
        </div>

        <div v-if="warehouseCarouselImages.length > 1" class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="(image, index) in warehouseCarouselImages"
            :key="image.key"
            type="button"
            class="h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[var(--dh-input)] transition"
            :class="index === warehouseCarouselIndex ? 'border-[var(--dh-primary)]' : 'border-[var(--dh-border)] opacity-75 hover:opacity-100'"
            :aria-label="`Ver imagen ${index + 1}`"
            @click="selectWarehouseCarouselImage(index)"
          >
            <img
              v-if="image.previewUrl"
              :src="image.previewUrl"
              alt=""
              class="h-full w-full object-cover"
            />
            <DhStorageImage
              v-else-if="image.storageId"
              :file-id="image.storageId"
              alt=""
              class="h-full w-full"
            />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <label
            class="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-xs font-black text-[var(--dh-text)] transition hover:border-[var(--dh-primary)]"
            :class="!canSave ? 'pointer-events-none opacity-60' : ''"
          >
            {{ warehouseCarouselImages.length ? 'Agregar más imágenes' : 'Cargar imágenes' }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              class="hidden"
              :disabled="!canSave"
              @change="selectWarehouseImages"
            />
          </label>

          <DhButton
            v-if="activeWarehouseImage?.pendingId"
            type="button"
            label="Quitar imagen seleccionada"
            variant="ghost"
            size="sm"
            @click="removePendingWarehouseImage(activeWarehouseImage.pendingId)"
          />

          <span
            v-if="warehouseCarouselImages.length"
            class="text-xs font-bold text-[var(--dh-text-muted)]"
          >
            {{ warehouseStoredImages.length }} guardada(s) · {{ pendingWarehouseImages.length }} nueva(s)
          </span>
        </div>

        <p
          v-if="activeWarehouseImage?.fileName"
          class="truncate text-xs font-bold text-[var(--dh-primary)]"
        >
          {{ activeWarehouseImage.fileName }}
        </p>
      </div>
    </section>

    <MetadataEditor v-model="form.metadataJson" />

    <div class="flex justify-end gap-2">
      <DhButton
        type="button"
        :label="t('common.close')"
        variant="secondary"
        @click="drawerStore.close()"
      />

      <DhButton
        type="submit"
        :label="isEdit ? t('common.save') : 'Guardar y agregar otro'"
        :loading="loading"
        :disabled="!canSave"
      />
    </div>
  </form>
</template>
