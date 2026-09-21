<script setup lang="ts">
import type { Component } from 'vue'
import { DhCard } from '@/shared/components/molecules'

defineProps<{
  label: string
  value: string | number
  description?: string
  icon?: Component
}>()
</script>

<template>
  <DhCard :icon="icon" padding="sm">
    <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</p>
    <p class="mt-2 break-words text-2xl font-black text-[var(--dh-text)] sm:text-3xl">{{ value }}</p>
    <p v-if="description" class="mt-1 break-words text-xs font-semibold text-[var(--dh-text-muted)]">
      {{ description }}
    </p>
  </DhCard>
</template>
