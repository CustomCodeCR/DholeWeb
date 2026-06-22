<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ title: string; subtitle?: string; icon?: Component }>()
</script>
<template>
  <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div class="flex items-center gap-4">
      <div v-if="icon" class="dh-glass dh-liquid flex h-14 w-14 items-center justify-center rounded-[24px] text-[var(--dh-primary)] shadow-[var(--dh-glow)]"><component :is="icon" class="h-6 w-6" /></div>
      <div>
        <h1 class="text-3xl font-black tracking-tight text-[var(--dh-text)]">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2"><slot name="actions" /></div>
  </header>
</template>
