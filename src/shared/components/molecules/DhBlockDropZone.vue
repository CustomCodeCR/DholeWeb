<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    label: string
    visible?: boolean
    disabled?: boolean
    acceptMimeType?: string
  }>(),
  {
    visible: false,
    disabled: false,
    acceptMimeType: '',
  },
)

const emit = defineEmits<{
  drop: [event: DragEvent]
}>()

const active = ref(false)

function accepts(event: DragEvent) {
  if (!props.acceptMimeType) return true
  return Array.from(event.dataTransfer?.types ?? []).includes(props.acceptMimeType)
}

function activate(event: DragEvent) {
  if (!props.visible || props.disabled || !accepts(event)) return
  event.preventDefault()
  event.stopPropagation()
  active.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function deactivate(event: DragEvent) {
  event.stopPropagation()
  active.value = false
}

function onDrop(event: DragEvent) {
  if (!props.visible || props.disabled || !accepts(event)) return
  event.preventDefault()
  event.stopPropagation()
  active.value = false
  emit('drop', event)
}

watch(() => props.visible, (visible) => {
  if (!visible) active.value = false
})
</script>

<template>
  <section
    v-if="visible"
    class="dh-block-drop-zone flex min-h-14 w-full items-center justify-center rounded-[var(--dh-radius-xl)] border-2 border-dashed px-4 py-3 text-center transition-all duration-150"
    :class="[
      active
        ? 'scale-[1.01] border-[var(--dh-primary)] dh-bg-primary-soft shadow-[var(--dh-shadow-sm)]'
        : 'border-[var(--dh-border)] bg-[var(--dh-input)]',
      disabled && 'cursor-not-allowed opacity-50',
    ]"
    :aria-label="label"
    @dragenter="activate"
    @dragover="activate"
    @dragleave="deactivate"
    @drop="onDrop"
  >
    <div class="pointer-events-none flex items-center justify-center gap-2 text-sm font-black" :class="active ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'">
      <Plus class="h-4 w-4" />
      <span>{{ label }}</span>
    </div>
  </section>
</template>
