<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    label?: string
    icon?: Component
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
  }>(),
  { type: 'button', variant: 'primary', size: 'md', loading: false, disabled: false },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex min-w-0 max-w-full touch-manipulation select-none items-center justify-center gap-2 rounded-[18px] font-black tracking-tight transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' && 'min-h-9 px-3 py-2 text-xs max-sm:min-h-11',
      size === 'md' && 'min-h-11 px-4 py-2.5 text-sm',
      size === 'lg' && 'min-h-13 px-6 py-3 text-base',
      variant === 'primary' && 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)] hover:brightness-110',
      variant === 'secondary' && 'border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl hover:bg-[var(--dh-card-hover)]',
      variant === 'ghost' && 'text-[var(--dh-text-soft)] hover:bg-black/5 dark:hover:bg-white/10',
      variant === 'danger' && 'bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-700',
    ]"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <component :is="icon" v-else-if="icon" class="h-4 w-4 shrink-0" />
    <span v-if="label" class="min-w-0 break-words text-center leading-tight">{{ label }}</span>
    <slot />
  </button>
</template>
