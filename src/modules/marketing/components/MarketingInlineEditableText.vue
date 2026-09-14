<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Pencil } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder: string
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{
  save: [value: string]
  activate: []
}>()

const editing = ref(false)
const draft = ref(props.modelValue)
const editorRef = ref<HTMLElement | null>(null)

watch(() => props.modelValue, (value) => {
  if (!editing.value) draft.value = value
})

async function startEdit() {
  if (props.disabled) return
  emit('activate')
  draft.value = props.modelValue
  editing.value = true
  await nextTick()
  editorRef.value?.focus()
  const selection = window.getSelection?.()
  if (selection && editorRef.value) {
    const range = document.createRange()
    range.selectNodeContents(editorRef.value)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

function syncDraft(event: Event) {
  draft.value = (event.currentTarget as HTMLElement).textContent ?? ''
}

function commit() {
  if (!editing.value) return
  const value = draft.value.trim()
  editing.value = false
  emit('save', value)
}

function cancel() {
  if (!editing.value) return
  draft.value = props.modelValue
  editing.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  }
}
</script>

<template>
  <button
    v-if="!editing"
    type="button"
    class="group/inline mt-2 flex max-w-full items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)] focus-visible:border-[var(--dh-primary)] focus-visible:outline-none"
    :disabled="disabled"
    :aria-label="placeholder"
    @click.stop="startEdit"
  >
    <span
      class="min-w-0 truncate text-sm font-semibold"
      :class="modelValue ? 'text-[var(--dh-text)]' : 'text-[var(--dh-text-muted)]'"
    >{{ modelValue || placeholder }}</span>
    <Pencil class="h-3.5 w-3.5 shrink-0 text-[var(--dh-text-muted)] opacity-0 transition group-hover/inline:opacity-100" />
  </button>

  <span
    v-else
    ref="editorRef"
    contenteditable="true"
    role="textbox"
    class="mt-2 block min-h-9 rounded-xl border border-[var(--dh-primary)] bg-[var(--dh-input)] px-2 py-1.5 text-sm font-semibold text-[var(--dh-text)] outline-none shadow-[0_0_0_3px_color-mix(in_srgb,var(--dh-primary)_12%,transparent)]"
    @click.stop
    @input="syncDraft"
    @blur="commit"
    @keydown="handleKeydown"
  >{{ draft }}</span>
</template>
