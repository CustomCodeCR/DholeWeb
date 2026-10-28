<script setup lang="ts">
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null
    label?: string
    placeholder?: string
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'datetime-local' | 'date'
    icon?: Component
    error?: string
    disabled?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
  }>(),
  { type: 'text', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Enforce bounds on the actual input, not on its wrapping label.
function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  let value = input.value
  if (props.type === 'number' && props.min !== undefined && value.trim()) {
    const minimum = Number(props.min)
    if (Number.isFinite(minimum) && (value.trim() === '-' || Number(value) < minimum)) {
      value = String(minimum)
      input.value = value
    }
  }
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent) {
  if (props.type === 'number' && props.min !== undefined
    && Number(props.min) >= 0 && event.key === '-')
    event.preventDefault()
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</span>
    <div
      class="flex h-11 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl transition dh-focus-primary"
      :class="error && '!border-red-500 ring-2 ring-red-500/20'"
    >
      <component :is="icon" v-if="icon" class="h-4 w-4 text-[var(--dh-text-muted)]" />
      <input
        :value="modelValue ?? ''"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :min="min"
        :max="max"
        :step="step"
        :aria-invalid="Boolean(error)"
        class="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:font-medium placeholder:text-[var(--dh-text-muted)] disabled:cursor-not-allowed"
        @input="onInput"
        @keydown="onKeydown"
      />
    </div>
    <span v-if="error" class="mt-1 block text-xs font-semibold text-red-500">{{ error }}</span>
  </label>
</template>
