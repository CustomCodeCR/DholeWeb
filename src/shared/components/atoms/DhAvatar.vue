<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string
    size?: 'sm' | 'md' | 'lg'
    status?: 'online' | 'offline' | 'busy' | 'none'
  }>(),
  {
    size: 'md',
    status: 'none',
  },
)

const initials = computed(() => {
  if (!props.name) return '?'

  return props.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('')
})
</script>

<template>
  <div class="relative inline-flex shrink-0">
    <img
      v-if="src"
      :src="src"
      :alt="name"
      class="rounded-full object-cover ring-2 ring-white/70 dark:ring-white/10"
      :class="[
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-14 w-14',
      ]"
    />

    <span
      v-else
      class="inline-flex items-center justify-center rounded-full bg-[var(--dh-primary)] font-bold text-white ring-2 ring-white/70 dark:ring-white/10"
      :class="[
        size === 'sm' && 'h-8 w-8 text-xs',
        size === 'md' && 'h-10 w-10 text-sm',
        size === 'lg' && 'h-14 w-14 text-base',
      ]"
    >
      {{ initials }}
    </span>

    <span
      v-if="status !== 'none'"
      class="absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-[var(--dh-black)]"
      :class="[
        size === 'sm' && 'h-2.5 w-2.5',
        size === 'md' && 'h-3 w-3',
        size === 'lg' && 'h-4 w-4',
        status === 'online' && 'bg-green-500',
        status === 'offline' && 'bg-zinc-400',
        status === 'busy' && 'bg-red-500',
      ]"
    />
  </div>
</template>
