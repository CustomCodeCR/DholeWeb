<script setup lang="ts">
export interface DhSelectOption { label: string; value: string | number; disabled?: boolean }

defineProps<{ modelValue: string | number | null; label?: string; placeholder?: string; options: DhSelectOption[]; error?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
</script>

<template>
  <label class="dh-select-wrap block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</span>
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      class="dh-select h-11 w-full rounded-[18px] border border-[var(--dh-border)] px-3 text-sm font-semibold shadow-[var(--dh-shadow-sm)] outline-none transition dh-focus-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="error && 'border-red-500'"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder !== ''" value="" disabled>{{ placeholder ?? 'Seleccione una opción' }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
    </select>
    <span v-if="error" class="mt-1 block text-xs font-semibold text-red-500">{{ error }}</span>
  </label>
</template>

<style scoped>
.dh-select-wrap {
  position: relative;
  z-index: 0;
  min-width: 0;
  isolation: isolate;
}

.dh-select-wrap:focus-within {
  z-index: 80;
}

.dh-select {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 100%;
  background-color: var(--dh-input);
  color: var(--dh-text);
  color-scheme: light;
  -webkit-appearance: menulist;
  appearance: auto;
}

.dh-select option,
.dh-select optgroup {
  background-color: #ffffff;
  color: #030202;
}

:global(.dark) .dh-select {
  color-scheme: dark;
}

:global(.dark) .dh-select option,
:global(.dark) .dh-select optgroup {
  background-color: #18181b;
  color: #ffffff;
}

@supports (-webkit-touch-callout: none) {
  .dh-select {
    -webkit-appearance: menulist;
    appearance: menulist;
  }
}
</style>
