<script setup lang="ts">
import { computed } from 'vue'
import DhMultiSelect from './DhMultiSelect.vue'
import { useI18n } from 'vue-i18n'
export interface DhSelectOption { label: string; value: string | number; disabled?: boolean }

const props = defineProps<{ searchable?: boolean; modelValue: string | number | null; label?: string; placeholder?: string; options: DhSelectOption[]; error?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
const { t } = useI18n()
const searchableOptions = computed(() => props.options.filter(option => !option.disabled).map(option => ({ label: option.label, value: String(option.value) })))
const selectedValue = computed(() => props.modelValue == null || props.modelValue === '' ? [] : [String(props.modelValue)])
function selectSearchValue(values: string[]) {
  const option = props.options.find(item => String(item.value) === values[0] && !item.disabled)
  emit('update:modelValue', option?.value ?? '')
}
</script>

<template>
  <DhMultiSelect v-if="searchable" :model-value="selectedValue" :options="searchableOptions" :label="label" :placeholder="placeholder ?? t('common.select')" :disabled="disabled" :error="error" single @update:model-value="selectSearchValue" />
  <label v-else class="dh-select-wrap block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</span>
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      class="dh-select h-11 w-full rounded-[18px] border border-[var(--dh-border)] px-3 text-sm font-semibold shadow-[var(--dh-shadow-sm)] outline-none transition dh-focus-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="error && '!border-red-500 ring-2 ring-red-500/20'"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder !== ''" value="" disabled>{{ placeholder ?? t('common.select') }}</option>
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
