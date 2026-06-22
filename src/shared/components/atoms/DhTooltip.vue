<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string
    position?: 'top' | 'bottom' | 'left' | 'right'
  }>(),
  {
    position: 'top',
  },
)
</script>

<template>
  <span class="group relative inline-flex">
    <slot />

    <span
      class="pointer-events-none absolute z-50 whitespace-nowrap rounded-xl bg-[var(--dh-black)] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100"
      :class="[
        position === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
        position === 'bottom' && 'left-1/2 top-full mt-2 -translate-x-1/2',
        position === 'left' && 'right-full top-1/2 mr-2 -translate-y-1/2',
        position === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
      ]"
    >
      {{ text }}
    </span>
  </span>
</template>
