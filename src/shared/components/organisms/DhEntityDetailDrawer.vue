<script setup lang="ts">
import DhDrawer from './DhDrawer.vue'

defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <DhDrawer :open="open" :title="title" size="lg" @close="emit('close')">
    <div class="space-y-5">
      <slot name="header" />

      <section class="rounded-[var(--dh-radius-lg)] border border-[var(--dh-border)] p-5">
        <slot />
      </section>

      <footer v-if="$slots.actions" class="flex justify-end gap-2">
        <slot name="actions" />
      </footer>
    </div>
  </DhDrawer>
</template>
