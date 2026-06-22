<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhTextarea } from '@/shared/components/atoms'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { RolesService } from '@/core/services/rolesService'

const props = defineProps<{ onSaved?: () => Promise<void> | void }>()
const { t } = useI18n()
const modalStore = useModalStore()
const toastStore = useToastStore()
const loading = ref(false)
const name = ref('')
const description = ref('')

async function save() {
  try {
    loading.value = true
    await RolesService.create({
      name: name.value,
      description: description.value || null,
      isSystemRole: false,
    })
    toastStore.success('Guardado', 'Rol creado.')
    await props.onSaved?.()
    modalStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo crear el rol.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <DhInput v-model="name" :label="t('common.name')" />
    <DhTextarea v-model="description" :label="t('common.description')" />
    <div class="flex justify-end gap-2">
      <DhButton :label="t('common.cancel')" variant="secondary" @click="modalStore.close()" />
      <DhButton type="submit" :label="t('common.save')" :loading="loading" />
    </div>
  </form>
</template>
