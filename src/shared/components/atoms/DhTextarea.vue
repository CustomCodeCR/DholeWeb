<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | null
    label?: string
    placeholder?: string
    rows?: number
    error?: string
    disabled?: boolean
    readonly?: boolean
  }>(),
  { rows: 4, disabled: false, readonly: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</span>
    <textarea
      :value="modelValue ?? ''"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      class="w-full resize-none rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none backdrop-blur-xl transition placeholder:font-medium placeholder:text-[var(--dh-text-muted)] dh-focus-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="error && 'border-red-500'"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <span v-if="error" class="mt-1 block text-xs font-semibold text-red-500">{{ error }}</span>
  </label>
</template>
