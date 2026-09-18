<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
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
  { danger: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const toastStore = useToastStore()
const loading = ref(false)
const { t } = useI18n()

const resolvedConfirmLabel = computed(() => props.confirmLabel || t('common.confirm'))
const resolvedCancelLabel = computed(() => props.cancelLabel || t('common.cancel'))

async function confirm() {
  emit('confirm')
  loading.value = true

  try {
    await props.onConfirm?.()
  } catch (error) {
    toastStore.backendError(error, t('common.actionError'))
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
      <div class="min-w-0">
        <h3 class="break-words text-lg font-black text-[var(--dh-text)]">{{ title }}</h3>
        <p class="mt-1 break-words text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">{{ message }}</p>
      </div>
    </div>
    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton :label="resolvedCancelLabel" variant="secondary" :disabled="loading" @click="cancel" />
      <DhButton :label="resolvedConfirmLabel" :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="confirm" />
    </div>
  </div>
</template>
