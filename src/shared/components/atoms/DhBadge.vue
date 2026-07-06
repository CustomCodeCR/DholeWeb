<script setup lang="ts">
withDefaults(defineProps<{ label?: string; variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' }>(), { variant: 'neutral' })
</script>
<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black"
    :class="[
      variant === 'primary' && 'dh-border-primary-soft dh-bg-primary-soft text-[var(--dh-primary)]',
      variant === 'success' && 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400',
      variant === 'warning' && 'border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
      variant === 'danger' && 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
      variant === 'neutral' && 'border-[var(--dh-border)] bg-black/5 text-[var(--dh-text-soft)] dark:bg-white/10',
    ]"
  ><slot>{{ label }}</slot></span>
</template>
