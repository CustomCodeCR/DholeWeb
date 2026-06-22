<script setup lang="ts">
import DhPageHeader from './DhPageHeader.vue'
import type { Component } from 'vue'

defineProps<{
  title: string
  subtitle?: string
  icon?: Component
}>()
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="title" :subtitle="subtitle" :icon="icon">
      <template #actions>
        <slot name="actions" />
      </template>
    </DhPageHeader>

    <div class="dh-glass dh-liquid rounded-[var(--dh-radius-xl)] p-6">
      <slot />
    </div>
  </section>
</template>
