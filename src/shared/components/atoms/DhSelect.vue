<script setup lang="ts">
export interface DhSelectOption { label: string; value: string | number; disabled?: boolean }

defineProps<{ modelValue: string | number | null; label?: string; placeholder?: string; options: DhSelectOption[]; error?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</span>
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      class="h-11 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none backdrop-blur-xl transition dh-focus-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="error && 'border-red-500'"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder !== ''" value="" disabled>{{ placeholder ?? 'Seleccione una opción' }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
    </select>
    <span v-if="error" class="mt-1 block text-xs font-semibold text-red-500">{{ error }}</span>
  </label>
</template>
