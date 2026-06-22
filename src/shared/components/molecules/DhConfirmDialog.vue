<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import { useToastStore } from '@/core/stores/toastStore'

const props = withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
  }>(),
  { confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', danger: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const toastStore = useToastStore()
const loading = ref(false)

async function confirm() {
  emit('confirm')
  loading.value = true

  try {
    await props.onConfirm?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo completar la acción.')
  } finally {
    loading.value = false
  }
}

function cancel() {
  emit('cancel')
  props.onCancel?.()
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex gap-3">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-red-500/10 text-red-500">
        <AlertTriangle class="h-5 w-5" />
      </div>
      <div>
        <h3 class="text-lg font-black text-[var(--dh-text)]">{{ title }}</h3>
        <p class="mt-1 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">{{ message }}</p>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <DhButton :label="cancelLabel" variant="secondary" :disabled="loading" @click="cancel" />
      <DhButton :label="confirmLabel" :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="confirm" />
    </div>
  </div>
</template>
