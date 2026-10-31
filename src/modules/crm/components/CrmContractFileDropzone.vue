<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { FileCheck2, FileUp, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: File | null
  disabled?: boolean
  label?: string
}>(), { disabled: false, label: 'Documento firmado' })
const emit = defineEmits<{ 'update:modelValue': [file: File | null] }>()
const fileId = useId()
const dragging = ref(false)
const error = ref('')
const accepted = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']
const formats = accepted.join(',')
const size = computed(() => props.modelValue ? (props.modelValue.size / 1024 / 1024).toFixed(2) : '')
function choose(file: File | null) {
  if (!file || props.disabled) return
  const extension = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
  if (!accepted.includes(extension)) {
    error.value = 'Formato no permitido. Seleccioná PDF, Word o imagen.'
    return
  }
  if (file.size > 25 * 1024 * 1024) {
    error.value = 'El archivo supera el límite de 25 MB.'
    return
  }
  error.value = ''
  emit('update:modelValue', file)
}
function fromInput(event: Event) {
  const input = event.target as HTMLInputElement
  choose(input.files?.[0] ?? null)
  input.value = ''
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  dragging.value = false
  choose(event.dataTransfer?.files?.[0] ?? null)
}
</script>

<template>
  <div class="space-y-2" data-crm-contract-dropzone>
    <p class="text-sm font-bold">{{ label }}</p>
    <div class="relative rounded-2xl border-2 border-dashed p-5 text-center transition-colors"
      :class="dragging ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10' : 'border-[var(--dh-border)] bg-[var(--dh-shell)]'"
      @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
      <div v-if="modelValue" class="flex flex-wrap items-center justify-center gap-3">
        <FileCheck2 class="h-6 w-6 text-[var(--dh-primary)]" />
        <div class="min-w-0 text-left">
          <p class="break-all text-sm font-semibold">{{ modelValue.name }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">{{ size }} MB · Listo para adjuntar</p>
        </div>
        <button type="button" :disabled="disabled" class="rounded-xl border border-[var(--dh-border)] p-2"
          aria-label="Quitar archivo" @click="emit('update:modelValue', null)"><X class="h-4 w-4" /></button>
      </div>
      <div v-else class="flex flex-col items-center gap-2">
        <FileUp class="h-7 w-7 text-[var(--dh-primary)]" />
        <p class="text-sm font-semibold">Arrastrá el documento aquí</p>
        <p class="text-xs text-[var(--dh-text-muted)]">o seleccioná un archivo desde tu equipo</p>
      </div>
      <input :id="fileId" class="sr-only" type="file" :accept="formats" :disabled="disabled"
        aria-label="Seleccionar documento de crédito" @change="fromInput" />
      <label :for="fileId" class="mt-3 inline-flex cursor-pointer items-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-2 text-sm font-bold"
        :class="disabled && 'pointer-events-none opacity-50'">{{ modelValue ? 'Cambiar archivo' : 'Seleccionar archivo' }}</label>
    </div>
    <p class="text-xs text-[var(--dh-text-muted)]">PDF, Word, JPG o PNG · máximo 25 MB. El sistema lo relaciona con el contrato automáticamente.</p>
    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>
