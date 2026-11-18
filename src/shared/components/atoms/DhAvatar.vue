<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Blobatar } from '@blobatar/vue'
import 'blobatar/motion.css'

const props = withDefaults(
  defineProps<{
    src?: string | null
    id?: string | number | null
    name?: string
    size?: 'sm' | 'md' | 'lg'
    status?: 'online' | 'offline' | 'busy' | 'none'
    fallback?: 'blobatar' | 'initials'
    animate?: boolean
  }>(),
  {
    size: 'md',
    status: 'none',
    fallback: 'blobatar',
    animate: false,
  },
)

const photoFailed = ref(false)
watch(() => props.src, () => { photoFailed.value = false })

const avatarSeed = computed(() => String(props.id ?? '').trim() || props.name?.trim() || '')
const pixelSize = computed(() => ({ sm: 32, md: 40, lg: 56 })[props.size])
const initials = computed(() => {
  if (!props.name?.trim()) return '?'
  return props.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
})
</script>

<template>
  <div class="relative inline-flex shrink-0">
    <img
      v-if="src && !photoFailed"
      :src="src"
      :alt="name || ''"
      class="rounded-full object-cover ring-2 ring-white/70 dark:ring-white/10"
      :class="[
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-14 w-14',
      ]"
      @error="photoFailed = true"
    />

    <Blobatar
      v-else-if="fallback === 'blobatar' && avatarSeed"
      :name="avatarSeed"
      :size="pixelSize"
      background="circle"
      :hue="210"
      :animate="animate ? 'hover' : undefined"
      :alt="name || ''"
      class="rounded-full ring-2 ring-white/70 dark:ring-white/10"
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
