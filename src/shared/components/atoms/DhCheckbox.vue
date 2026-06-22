<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  description?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label class="flex cursor-pointer items-start gap-3">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="mt-1 h-4 w-4 rounded border-[var(--dh-border)] accent-[var(--dh-primary)] disabled:cursor-not-allowed"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />

    <span>
      <span v-if="label" class="block text-sm font-semibold text-[var(--dh-text)]">
        {{ label }}
      </span>

      <span v-if="description" class="block text-xs text-[var(--dh-text-muted)]">
        {{ description }}
      </span>
    </span>
  </label>
</template>
