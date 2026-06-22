<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    modelValue: string | number | null
    label?: string
    placeholder?: string
    type?: 'text' | 'email' | 'password' | 'number' | 'search'
    icon?: Component
    error?: string
    disabled?: boolean
  }>(),
  { type: 'text', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</span>
    <div
      class="flex h-11 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl transition focus-within:border-[var(--dh-primary)] focus-within:ring-4 focus-within:ring-red-500/10"
      :class="error && 'border-red-500'"
    >
      <component :is="icon" v-if="icon" class="h-4 w-4 text-[var(--dh-text-muted)]" />
      <input
        :value="modelValue ?? ''"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        class="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:font-medium placeholder:text-[var(--dh-text-muted)] disabled:cursor-not-allowed"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <span v-if="error" class="mt-1 block text-xs font-semibold text-red-500">{{ error }}</span>
  </label>
</template>
