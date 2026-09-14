<script setup lang="ts">
import { ref } from 'vue'
import { GripVertical } from 'lucide-vue-next'

export interface DhSortableItem {
  id: string
  disabled?: boolean
  [key: string]: unknown
}

const props = defineProps<{
  modelValue: DhSortableItem[]
  itemLabel?: (item: DhSortableItem, index: number) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [items: DhSortableItem[]]
  reorder: [items: DhSortableItem[], from: number, to: number]
}>()

const draggingIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function reorder(from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= props.modelValue.length || to >= props.modelValue.length) return
  if (props.modelValue[from]?.disabled) return

  const next = [...props.modelValue]
  const [moved] = next.splice(from, 1)
  if (!moved) return
  next.splice(to, 0, moved)
  emit('update:modelValue', next)
  emit('reorder', next, from, to)
}

function onDragStart(index: number, event: DragEvent) {
  if (props.modelValue[index]?.disabled) {
    event.preventDefault()
    return
  }
  draggingIndex.value = index
  event.dataTransfer?.setData('text/plain', props.modelValue[index]?.id ?? '')
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  if (draggingIndex.value !== null) reorder(draggingIndex.value, index)
  draggingIndex.value = null
  overIndex.value = null
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (!event.altKey || props.modelValue[index]?.disabled) return
  if (event.key === 'ArrowUp' && index > 0) {
    event.preventDefault()
    reorder(index, index - 1)
  }
  if (event.key === 'ArrowDown' && index < props.modelValue.length - 1) {
    event.preventDefault()
    reorder(index, index + 1)
  }
}
</script>

<template>
  <div class="min-w-0 space-y-2">
    <div
      v-for="(item, index) in modelValue"
      :key="item.id"
      tabindex="0"
      :draggable="!item.disabled"
      :aria-label="itemLabel?.(item, index)"
      class="flex min-w-0 items-stretch rounded-[var(--dh-radius-xl)] border bg-[var(--dh-input)] transition focus:outline-none focus:ring-2 focus:ring-[var(--dh-primary)]/40"
      :class="[
        overIndex === index ? 'border-[var(--dh-primary)] dh-bg-primary-soft' : 'border-[var(--dh-border)]',
        draggingIndex === index && 'opacity-50',
        item.disabled && 'opacity-50',
      ]"
      @dragstart="onDragStart(index, $event)"
      @dragend="draggingIndex = null; overIndex = null"
      @dragover.prevent="overIndex = index"
      @dragleave="overIndex === index && (overIndex = null)"
      @drop.prevent="onDrop(index)"
      @keydown="onKeydown(index, $event)"
    >
      <div class="flex w-10 shrink-0 items-center justify-center text-[var(--dh-text-muted)]">
        <GripVertical class="h-4 w-4" />
      </div>
      <div class="min-w-0 flex-1 p-2">
        <slot name="item" :item="item" :index="index" :dragging="draggingIndex === index">
          <span class="text-sm font-semibold text-[var(--dh-text)]">{{ item.id }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>
