<script setup lang="ts">
import type { Component } from 'vue'
import DhButton from './DhButton.vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
  actionLabel?: string
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <section
    class="dh-glass dh-liquid flex min-h-64 flex-col items-center justify-center rounded-[var(--dh-radius-xl)] p-8 text-center"
  >
    <div
      v-if="icon"
      class="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl dh-bg-primary-soft text-[var(--dh-primary)]"
    >
      <component :is="icon" class="h-7 w-7" />
    </div>

    <h3 class="text-base font-bold text-[var(--dh-text)]">
      {{ title }}
    </h3>

    <p v-if="description" class="mt-2 max-w-sm text-sm leading-6 text-[var(--dh-text-muted)]">
      {{ description }}
    </p>

    <DhButton v-if="actionLabel" class="mt-5" :label="actionLabel" @click="emit('action')" />
  </section>
</template>
