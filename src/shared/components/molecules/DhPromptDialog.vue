<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput } from '@/shared/components/atoms'

const props = withDefaults(
  defineProps<{
    title: string
    message?: string
    label?: string
    placeholder?: string
    initialValue?: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm?: (value: string) => void | Promise<void>
    onCancel?: () => void
  }>(),
  { initialValue: '' },
)

const emit = defineEmits<{ confirm: [value: string]; cancel: [] }>()
const { t } = useI18n()
const value = ref(props.initialValue)
const loading = ref(false)

async function confirm() {
  if (!value.value.trim() || loading.value) return
  loading.value = true
  try {
    emit('confirm', value.value.trim())
    await props.onConfirm?.(value.value.trim())
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
  <div class="space-y-4">
    <div>
      <h3 class="break-words text-lg font-black text-[var(--dh-text)]">{{ title }}</h3>
      <p v-if="message" class="mt-1 break-words text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
        {{ message }}
      </p>
    </div>

    <DhInput
      v-model="value"
      :label="label"
      :placeholder="placeholder"
      @keydown.enter.prevent="confirm"
    />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton
        :label="cancelLabel || t('common.cancel')"
        variant="secondary"
        :disabled="loading"
        @click="cancel"
      />
      <DhButton
        :label="confirmLabel || t('common.confirm')"
        :loading="loading"
        :disabled="!value.trim()"
        @click="confirm"
      />
    </div>
  </div>
</template>
