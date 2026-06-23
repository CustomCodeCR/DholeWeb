<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
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

const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create))
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update))

const canSave = computed(() => {
  return isEdit.value ? canUpdate.value : canCreate.value
})

function resetCreateForm() {
  const nextSortOrder = Number(form.value.sortOrder || 0) + 1

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
      await CatalogItemsService.update(props.item.id, {
        name: form.value.name,
        description: form.value.description || null,
        value: form.value.value || null,
        metadataJson: form.value.metadataJson,
        sortOrder: form.value.sortOrder,
      })

      toastStore.success('Guardado', t('catalogs.itemSaved'))
      await props.onSaved?.()
      drawerStore.close()
      return
    }

    await CatalogItemsService.createForGroup(props.group.id, {
      name: form.value.name,
      slug: form.value.slug || null,
      description: form.value.description || null,
      value: form.value.value || null,
      metadataJson: form.value.metadataJson,
      sortOrder: form.value.sortOrder,
      isSystem: form.value.isSystem,
    })

    toastStore.success('Guardado', 'Item creado correctamente. Puede agregar otro.')
    await props.onSaved?.()
    resetCreateForm()
  } catch (error) {
    toastStore.backendError(error, t('catalogs.saveItemError'))
  } finally {
    loading.value = false
  }
}
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
