<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  subtitle: string
  icon: Component
  createLabel: string
}>()
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[32px] p-6">
    <div class="flex items-center gap-4">
      <div class="flex h-12 w-12 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]">
        <component :is="icon" class="h-6 w-6" />
      </div>
      <div>
        <h1 class="text-xl font-black text-[var(--dh-text)]">{{ title }}</h1>
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ subtitle }}</p>
      </div>
    </div>
  </section>
</template>
