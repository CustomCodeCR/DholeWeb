<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogGroupsService } from '@/core/services/catalogGroupsService'
import type { CatalogGroupDto } from '@/core/interfaces/catalogs'
import MetadataEditor from '@/modules/catalogs/components/MetadataEditor.vue'

const props = defineProps<{
  group?: CatalogGroupDto
  onSaved?: () => Promise<void> | void
}>()

const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)

const form = ref({
  name: props.group?.name ?? '',
  slug: props.group?.slug ?? '',
  description: props.group?.description ?? '',
  metadataJson: props.group?.metadataJson ?? null,
  isSystem: props.group?.isSystem ?? false,
})

const isEdit = computed(() => Boolean(props.group))
const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.create))
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.update))
const canSave = computed(() => (isEdit.value ? canUpdate.value : canCreate.value))

async function save() {
  if (!canSave.value) {
    toastStore.warning('Sin permiso', 'No tiene permiso para guardar este catálogo.')
    return
  }

  try {
    loading.value = true

    if (props.group) {
      await CatalogGroupsService.update(props.group.id, {
        name: form.value.name,
        description: form.value.description || null,
        metadataJson: form.value.metadataJson,
      })
    } else {
      await CatalogGroupsService.create({
        name: form.value.name,
        slug: form.value.slug || null,
        description: form.value.description || null,
        metadataJson: form.value.metadataJson,
        isSystem: form.value.isSystem,
      })
    }

    toastStore.success('Guardado', 'Catálogo guardado correctamente.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el catálogo.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput
        v-model="form.name"
        label="Nombre"
        placeholder="Tipos de contenedores"
        :disabled="!canSave"
      />

      <DhInput
        v-if="!isEdit"
        v-model="form.slug"
        label="Slug"
        placeholder="tipos-contenedores"
        :disabled="!canSave"
      />

      <DhInput
        v-model="form.description"
        label="Descripción"
        placeholder="Catálogo para clasificación de contenedores"
        :disabled="!canSave"
        class="md:col-span-2"
      />

      <DhSwitch v-if="!isEdit" v-model="form.isSystem" label="Catálogo de sistema" />
    </div>

    <MetadataEditor v-model="form.metadataJson" />

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" label="Guardar" :loading="loading" :disabled="!canSave" />
    </div>
  </form>
</template>
