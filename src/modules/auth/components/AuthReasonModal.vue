<script setup lang="ts">
import { ref } from 'vue'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  title: string
  message?: string
  reasonLabel?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: (reason: string | null) => Promise<void> | void
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const reason = ref('')
const loading = ref(false)

async function confirm() {
  loading.value = true
  try {
    await props.onConfirm(reason.value.trim() || null)
    modalStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo completar la acción.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="space-y-5">
    <div>
      <h3 class="text-lg font-black text-[var(--dh-text)]">{{ title }}</h3>
      <p v-if="message" class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ message }}</p>
    </div>

    <DhTextarea v-model="reason" :label="reasonLabel ?? 'Motivo'" placeholder="Opcional" />

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="modalStore.close()" />
      <DhButton :label="confirmLabel" :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="confirm" />
    </div>
  </section>
</template>
