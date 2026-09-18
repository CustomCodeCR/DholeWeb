<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: number
    label?: string
    help?: string
    valueLabel?: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

function readValue(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="block min-w-0">
    <span
      v-if="label || valueLabel"
      class="mb-1.5 flex min-w-0 items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
    >
      <span v-if="label" class="min-w-0 truncate">{{ label }}</span>
      <span v-if="valueLabel" class="shrink-0 text-[var(--dh-text-soft)]">{{ valueLabel }}</span>
    </span>

    <input
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="dh-range h-11 w-full cursor-pointer accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40"
      @input="emit('update:modelValue', readValue($event))"
      @change="emit('change', readValue($event))"
    />

    <span v-if="help" class="mt-1.5 block text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
      {{ help }}
    </span>
  </label>
</template>
