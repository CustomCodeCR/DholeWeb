<script setup lang="ts">
import { ref } from 'vue'
import { DhButton, DhPasswordInput } from '@/shared/components/atoms'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { UsersService } from '@/core/services/usersService'

const props = defineProps<{ userId: string; onSaved?: () => Promise<void> | void }>()
const modalStore = useModalStore()
const toastStore = useToastStore()
const password = ref('')
const loading = ref(false)

async function save() {
  if (!password.value) {
    toastStore.warning('Contraseña requerida')
    return
  }

  loading.value = true
  try {
    await UsersService.changePassword(props.userId, { password: password.value })
    toastStore.success('Contraseña actualizada')
    await props.onSaved?.()
    modalStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar la contraseña.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <DhPasswordInput v-model="password" label="Nueva contraseña" placeholder="Digite la nueva contraseña" />

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="modalStore.close()" />
      <DhButton type="submit" label="Guardar contraseña" :loading="loading" />
    </div>
  </form>
</template>
