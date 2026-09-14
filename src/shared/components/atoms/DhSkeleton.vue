<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    rounded?: 'sm' | 'md' | 'lg' | 'full'
    animated?: boolean
  }>(),
  {
    width: '100%',
    height: '1rem',
    rounded: 'md',
    animated: true,
  },
)
</script>

<template>
  <span
    aria-hidden="true"
    class="block bg-black/[0.08] dark:bg-white/[0.10]"
    :class="[
      animated && 'animate-pulse',
      rounded === 'sm' && 'rounded-lg',
      rounded === 'md' && 'rounded-2xl',
      rounded === 'lg' && 'rounded-[var(--dh-radius-xl)]',
      rounded === 'full' && 'rounded-full',
    ]"
    :style="{ width, height }"
  />
</template>
