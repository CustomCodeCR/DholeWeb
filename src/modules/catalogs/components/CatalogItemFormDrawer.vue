<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
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
const warehouseImageFile = ref<File | null>(null)
const warehouseImagePreviewUrl = ref('')

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

const warehouseImageMetadata = computed(() => parseMetadataJson(form.value.metadataJson))

function clearWarehouseImagePreview() {
  if (warehouseImagePreviewUrl.value) URL.revokeObjectURL(warehouseImagePreviewUrl.value)
  warehouseImagePreviewUrl.value = ''
}

function resetWarehouseImageSelection() {
  clearWarehouseImagePreview()
  warehouseImageFile.value = null
}

function selectWarehouseImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toastStore.warning('Archivo no válido', 'Seleccione una imagen del WHS.')
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    toastStore.warning('Imagen muy grande', 'La imagen del WHS no puede superar 8 MB.')
    return
  }

  clearWarehouseImagePreview()
  warehouseImageFile.value = file
  warehouseImagePreviewUrl.value = URL.createObjectURL(file)
}

function mergeWarehouseImageMetadata(
  metadataJson: string | null,
  imageStorageId: string,
  imageFileName: string,
) {
  const metadata = parseMetadataJson(metadataJson)
  metadata.imageStorageId = imageStorageId
  metadata.imageFileName = imageFileName
  return JSON.stringify(metadata)
}

async function uploadWarehouseImage(entityId: string, metadataJson: string | null) {
  if (!isWarehouseGroup.value || !warehouseImageFile.value) return metadataJson

  const uploaded = await StorageService.uploadFile({
    file: warehouseImageFile.value,
    sourceService: 'DholeWeb',
    entityType: 'PricingWarehouse',
    entityId,
    metadataJson: JSON.stringify({
      catalogGroupSlug: props.group.slug,
      warehouseName: form.value.name || null,
    }),
  })

  return mergeWarehouseImageMetadata(
    metadataJson,
    uploaded.id,
    uploaded.originalFileName || warehouseImageFile.value.name,
  )
}

function resetCreateForm() {
  const nextSortOrder = Number(form.value.sortOrder || 0) + 1
  resetWarehouseImageSelection()

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
      const metadataJson = await uploadWarehouseImage(props.item.id, form.value.metadataJson)

      await CatalogItemsService.update(props.item.id, {
        name: form.value.name,
        description: form.value.description || null,
        value: form.value.value || null,
        metadataJson,
        sortOrder: form.value.sortOrder,
      })

      form.value.metadataJson = metadataJson
      resetWarehouseImageSelection()
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

    const metadataJson = await uploadWarehouseImage(createdId, form.value.metadataJson)
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

onBeforeUnmount(clearWarehouseImagePreview)
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
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="h-28 w-28 shrink-0">
          <img
            v-if="warehouseImagePreviewUrl"
            :src="warehouseImagePreviewUrl"
            alt="Vista previa del WHS"
            class="h-full w-full rounded-2xl border border-[var(--dh-border)] object-cover"
          />
          <DhStorageImage
            v-else-if="warehouseImageMetadata.imageStorageId"
            :file-id="warehouseImageMetadata.imageStorageId"
            :alt="`Imagen de ${form.name || 'WHS'}`"
            class="h-full w-full"
          />
          <div
            v-else
            class="grid h-full w-full place-items-center rounded-2xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-input)] px-2 text-center text-[10px] font-bold text-[var(--dh-text-muted)]"
          >
            Sin imagen
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-black text-[var(--dh-text)]">Imagen del WHS</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Cargue una foto JPG, PNG o WEBP. Se mostrará como una miniatura cuadrada junto a los datos del WHS en FCA.
          </p>
          <p
            v-if="warehouseImageFile || warehouseImageMetadata.imageFileName"
            class="mt-2 truncate text-xs font-bold text-[var(--dh-primary)]"
          >
            {{ warehouseImageFile?.name || warehouseImageMetadata.imageFileName }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <label
              class="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-xs font-black text-[var(--dh-text)] transition hover:border-[var(--dh-primary)]"
              :class="!canSave ? 'pointer-events-none opacity-60' : ''"
            >
              {{ warehouseImageMetadata.imageStorageId || warehouseImageFile ? 'Reemplazar imagen' : 'Cargar imagen' }}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                :disabled="!canSave"
                @change="selectWarehouseImage"
              />
            </label>
            <DhButton
              v-if="warehouseImageFile"
              type="button"
              label="Cancelar selección"
              variant="ghost"
              size="sm"
              @click="resetWarehouseImageSelection"
            />
          </div>
        </div>
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
