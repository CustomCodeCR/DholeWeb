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
  <section class="dh-glass dh-liquid rounded-[24px] p-4 sm:rounded-[32px] sm:p-6">
    <div class="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
      <div class="dh-bg-primary-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-[var(--dh-primary)] sm:h-12 sm:w-12 sm:rounded-[20px]">
        <component :is="icon" class="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div class="min-w-0">
        <h1 class="break-words text-lg font-black leading-tight text-[var(--dh-text)] sm:text-xl">{{ title }}</h1>
        <p class="mt-1 break-words text-sm font-semibold leading-5 text-[var(--dh-text-muted)]">{{ subtitle }}</p>
      </div>
    </div>
  </section>
</template>
