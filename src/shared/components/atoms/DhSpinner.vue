<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    label?: string
  }>(),
  {
    size: 'md',
  },
)
</script>

<template>
  <div class="inline-flex items-center gap-3 text-[var(--dh-text-soft)]">
    <span
      class="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      :class="[size === 'sm' && 'h-4 w-4', size === 'md' && 'h-6 w-6', size === 'lg' && 'h-9 w-9']"
    />

    <span v-if="label" class="text-sm font-medium">
      {{ label }}
    </span>
  </div>
</template>
