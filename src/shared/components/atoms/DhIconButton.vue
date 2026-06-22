<script setup lang="ts">
import type { Component } from 'vue'
withDefaults(defineProps<{ icon: Component; label?: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; disabled?: boolean }>(), { variant: 'ghost', size: 'md', disabled: false })
const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>
<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-[18px] transition-all duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' && 'h-9 w-9', size === 'md' && 'h-11 w-11', size === 'lg' && 'h-13 w-13',
      variant === 'primary' && 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]',
      variant === 'secondary' && 'border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl hover:bg-[var(--dh-card-hover)]',
      variant === 'ghost' && 'text-[var(--dh-text-soft)] hover:bg-black/5 dark:hover:bg-white/10',
      variant === 'danger' && 'text-red-600 hover:bg-red-500/10',
    ]"
    @click="emit('click', $event)"
  ><component :is="icon" class="h-4 w-4" /></button>
</template>
