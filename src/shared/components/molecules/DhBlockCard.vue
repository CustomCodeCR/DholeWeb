<script setup lang="ts">
import type { Component } from 'vue'

export interface DhBlockCardItem {
  id: string
  title: string
  description?: string
  category?: string
  icon?: Component
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    item: DhBlockCardItem
    selected?: boolean
    draggable?: boolean
  }>(),
  {
    selected: false,
    draggable: false,
  },
)

const emit = defineEmits<{
  select: [item: DhBlockCardItem]
  dragstart: [event: DragEvent, item: DhBlockCardItem]
}>()

function select() {
  if (!props.item.disabled) emit('select', props.item)
}
</script>

<template>
  <button
    type="button"
    class="group flex w-full min-w-0 items-start gap-3 rounded-[var(--dh-radius-xl)] border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="
      selected
        ? 'border-[var(--dh-primary)] dh-bg-primary-soft shadow-[var(--dh-shadow-sm)]'
        : 'border-[var(--dh-border)] bg-[var(--dh-input)] hover:bg-[var(--dh-card-hover)]'
    "
    :disabled="item.disabled"
    :draggable="draggable && !item.disabled"
    @click="select"
    @dragstart="emit('dragstart', $event, item)"
  >
    <div
      class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black/[0.05] text-[var(--dh-text-soft)] dark:bg-white/[0.08]"
      :class="selected && 'text-[var(--dh-primary)]'"
    >
      <component :is="item.icon" v-if="item.icon" class="h-5 w-5" />
      <slot v-else name="icon" :item="item" />
    </div>

    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-bold text-[var(--dh-text)]">{{ item.title }}</span>
      <span v-if="item.description" class="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--dh-text-muted)]">
        {{ item.description }}
      </span>
    </span>

    <slot name="end" :item="item" :selected="selected" />
  </button>
</template>
