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
    class="inline-flex items-center justify-center gap-2 rounded-[18px] font-black tracking-tight transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' && 'h-9 px-3 text-xs',
      size === 'md' && 'h-11 px-4 text-sm',
      size === 'lg' && 'h-13 px-6 text-base',
      variant === 'primary' && 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)] hover:brightness-110',
      variant === 'secondary' && 'border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl hover:bg-[var(--dh-card-hover)]',
      variant === 'ghost' && 'text-[var(--dh-text-soft)] hover:bg-black/5 dark:hover:bg-white/10',
      variant === 'danger' && 'bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-700',
    ]"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <component :is="icon" v-else-if="icon" class="h-4 w-4" />
    <span v-if="label">{{ label }}</span>
    <slot />
  </button>
</template>
