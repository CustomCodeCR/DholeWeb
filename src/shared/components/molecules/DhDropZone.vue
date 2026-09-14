<script setup lang="ts">
import { ref } from 'vue'
import { UploadCloud } from 'lucide-vue-next'
import DhButton from '@/shared/components/atoms/DhButton.vue'

export interface DhDropZoneRejection {
  file: File
  reason: 'type' | 'size' | 'multiple'
}

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    browseLabel?: string
    accept?: string
    multiple?: boolean
    disabled?: boolean
    maxSizeBytes?: number
  }>(),
  {
    accept: '',
    multiple: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  files: [files: File[]]
  rejected: [rejections: DhDropZoneRejection[]]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function matchesAccept(file: File) {
  const rules = props.accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)

  if (!rules.length) return true

  return rules.some((rule) => {
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule)
    if (rule.endsWith('/*')) return file.type.toLowerCase().startsWith(rule.slice(0, -1))
    return file.type.toLowerCase() === rule
  })
}

function processFiles(source: FileList | File[]) {
  const incoming = Array.from(source)
  const accepted: File[] = []
  const rejected: DhDropZoneRejection[] = []

  incoming.forEach((file, index) => {
    if (!props.multiple && index > 0) {
      rejected.push({ file, reason: 'multiple' })
      return
    }
    if (!matchesAccept(file)) {
      rejected.push({ file, reason: 'type' })
      return
    }
    if (props.maxSizeBytes && file.size > props.maxSizeBytes) {
      rejected.push({ file, reason: 'size' })
      return
    }
    accepted.push(file)
  })

  if (accepted.length) emit('files', accepted)
  if (rejected.length) emit('rejected', rejected)
}

function openPicker() {
  if (!props.disabled) inputRef.value?.click()
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) processFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (props.disabled || !event.dataTransfer?.files) return
  processFiles(event.dataTransfer.files)
}
</script>

<template>
  <section
    class="flex min-w-0 flex-col items-center justify-center rounded-[var(--dh-radius-xl)] border border-dashed p-6 text-center transition"
    :class="[
      dragging
        ? 'border-[var(--dh-primary)] dh-bg-primary-soft'
        : 'border-[var(--dh-border)] bg-[var(--dh-input)]',
      disabled && 'cursor-not-allowed opacity-50',
    ]"
    @dragenter.prevent="!disabled && (dragging = true)"
    @dragover.prevent="!disabled && (dragging = true)"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="inputRef"
      type="file"
      class="sr-only"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onInput"
    />

    <div class="mb-3 grid h-12 w-12 place-items-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]">
      <UploadCloud class="h-6 w-6" />
    </div>
    <h3 class="text-sm font-bold text-[var(--dh-text)]">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-md text-sm leading-6 text-[var(--dh-text-muted)]">
      {{ description }}
    </p>
    <DhButton
      v-if="browseLabel"
      class="mt-4"
      :label="browseLabel"
      variant="secondary"
      size="sm"
      :disabled="disabled"
      @click="openPicker"
    />
  </section>
</template>
