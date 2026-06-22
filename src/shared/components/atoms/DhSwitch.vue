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
  <label class="flex cursor-pointer items-center justify-between gap-4">
    <span>
      <span v-if="label" class="block text-sm font-semibold text-[var(--dh-text)]">
        {{ label }}
      </span>

      <span v-if="description" class="block text-xs text-[var(--dh-text-muted)]">
        {{ description }}
      </span>
    </span>

    <button
      type="button"
      :disabled="disabled"
      class="relative h-7 w-12 rounded-full border border-[var(--dh-border)] transition disabled:cursor-not-allowed disabled:opacity-50"
      :class="modelValue ? 'bg-[var(--dh-primary)]' : 'bg-[var(--dh-surface-strong)]'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition"
        :class="modelValue ? 'left-6' : 'left-1'"
      />
    </button>
  </label>
</template>
