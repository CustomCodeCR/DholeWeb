<script setup lang="ts">
import { computed, ref } from 'vue'
import { FilePlus2, Files, Trash2, UploadCloud } from 'lucide-vue-next'

// This is a controlled selection component: no files are uploaded until the
// parent saves, so retrying a failed upload never duplicates a CRM record.
const props = withDefaults(defineProps<{
  modelValue: File[]
  disabled?: boolean
  label?: string
}>(), { disabled: false, label: 'Documentos adjuntos' })
const emit = defineEmits<{ 'update:modelValue': [files: File[]] }>()
const picker = ref<HTMLInputElement | null>(null)
const dragDepth = ref(0)
const validationMessage = ref('')
const isDragging = computed(() => !props.disabled && dragDepth.value > 0)
const totalBytes = computed(() => props.modelValue.reduce((sum, file) => sum + file.size, 0))
const MAX_FILE_BYTES = 100 * 1024 * 1024

function formatSize(bytes: number): string {
  return bytes >= 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : (bytes / 1024).toFixed(1) + ' KB'
}
function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}
function addFiles(input: FileList | File[]) {
  if (props.disabled) return
  const merged = [...props.modelValue]
  const rejected: string[] = []
  for (const file of Array.from(input)) {
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      rejected.push(file.name)
      continue
    }
    if (!merged.some(existing => sameFile(existing, file))) merged.push(file)
  }
  emit('update:modelValue', merged)
  validationMessage.value = rejected.length
    ? rejected.length + ' archivo(s) omitidos: deben pesar entre 1 byte y 100 MB.'
    : ''
}
function selectFiles(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) addFiles(target.files)
  target.value = '' // Allows selecting the same file again after removing it.
}
function openPicker() {
  if (!props.disabled) picker.value?.click()
}
function onDragEnter() {
  if (!props.disabled) dragDepth.value++
}
function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}
function onDrop(event: DragEvent) {
  dragDepth.value = 0
  if (!props.disabled && event.dataTransfer?.files) addFiles(event.dataTransfer.files)
}
function removeFile(index: number) {
  if (props.disabled) return
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
  validationMessage.value = ''
}
</script>

<template>
  <div class="space-y-3" data-crm-file-dropzone>
    <p class="text-xs font-extrabold text-[var(--dh-text)]">{{ label }}</p>
    <div role="group" :aria-label="'Arrastrar o seleccionar ' + label.toLowerCase()"
      class="rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-7"
      :class="[
        isDragging ? 'border-[var(--dh-primary)] bg-[var(--dh-primary-light)]' : 'border-[var(--dh-border)] bg-[var(--dh-shell)]',
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-[var(--dh-primary)]',
      ]"
      @dragenter.prevent.stop="onDragEnter"
      @dragover.prevent.stop
      @dragleave.prevent.stop="onDragLeave"
      @drop.prevent.stop="onDrop">
      <UploadCloud class="mx-auto mb-2 h-8 w-8 text-[var(--dh-primary)]" aria-hidden="true" />
      <p class="text-sm font-bold text-[var(--dh-text)]">
        {{ isDragging ? 'Soltá los archivos aquí' : 'Arrastrá y soltá tus documentos aquí' }}
      </p>
      <p class="mt-1 text-xs text-[var(--dh-text-muted)]">O seleccioná archivos desde tu dispositivo.</p>
      <input ref="picker" type="file" multiple class="sr-only" tabindex="-1"
        :disabled="disabled" :aria-label="'Elegir ' + label.toLowerCase()" @change="selectFiles" />
      <button type="button" class="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold text-[var(--dh-text)] hover:bg-[var(--dh-card)] disabled:opacity-50"
        :disabled="disabled" @click="openPicker">
        <FilePlus2 class="h-4 w-4" aria-hidden="true" />Seleccionar archivos
      </button>
      <p class="mt-2 text-[11px] text-[var(--dh-text-muted)]">
        Sin límite de cantidad por selección · máximo 100 MB por archivo
      </p>
    </div>
    <p v-if="validationMessage" role="alert" class="text-xs font-semibold text-red-500">{{ validationMessage }}</p>
    <div v-if="modelValue.length" class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--dh-text-muted)]">
        <span class="inline-flex items-center gap-2 font-bold"><Files class="h-4 w-4" />{{ modelValue.length }} {{ modelValue.length === 1 ? 'archivo listo' : 'archivos listos' }} para guardar</span>
        <span>{{ formatSize(totalBytes) }} en total</span>
      </div>
      <ul class="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-label="Archivos pendientes de adjuntar">
        <li v-for="(file, index) in modelValue" :key="file.name + ':' + file.size + ':' + file.lastModified"
          class="flex items-center justify-between gap-3 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-xs">
          <span class="min-w-0 flex-1 break-all text-[var(--dh-text)]">{{ file.name }}</span>
          <span class="shrink-0 text-[var(--dh-text-muted)]">{{ formatSize(file.size) }}</span>
          <button type="button" class="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
            :aria-label="'Quitar ' + file.name" :disabled="disabled" @click="removeFile(index)">
            <Trash2 class="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
