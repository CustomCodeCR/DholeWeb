<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    as?: 'div' | 'section' | 'article' | 'button'
    title?: string
    subtitle?: string
    icon?: Component
    interactive?: boolean
    padding?: 'sm' | 'md' | 'lg'
  }>(),
  {
    as: 'section',
    interactive: false,
    padding: 'md',
  },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? 'button' : undefined"
    class="dh-glass dh-liquid min-w-0 rounded-[var(--dh-radius-xl)] text-left"
    :class="[
      padding === 'sm' && 'p-4',
      padding === 'md' && 'p-5 sm:p-6',
      padding === 'lg' && 'p-5 sm:p-7 lg:p-8',
      interactive && 'dh-card-hover touch-manipulation cursor-pointer',
    ]"
    @click="emit('click', $event)"
  >
    <header v-if="title || subtitle || icon || $slots.header || $slots.actions" class="mb-5 flex min-w-0 items-start gap-3">
      <div
        v-if="icon"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]"
      >
        <component :is="icon" class="h-5 w-5" />
      </div>

      <div class="min-w-0 flex-1">
        <slot name="header">
          <h2 v-if="title" class="text-lg font-black text-[var(--dh-text)]">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1 text-sm font-semibold leading-5 text-[var(--dh-text-muted)]">
            {{ subtitle }}
          </p>
        </slot>
      </div>

      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </component>
</template>
