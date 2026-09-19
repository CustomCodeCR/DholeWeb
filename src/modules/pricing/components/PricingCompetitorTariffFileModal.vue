<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhModal } from '@/shared/components/organisms'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'
import { StorageService } from '@/core/services/storageService'
import type { StorageFileDto } from '@/core/interfaces/storage'

const props = defineProps<{
  open: boolean
  storageId: string | null
}>()

const emit = defineEmits<{ close: [] }>()
const loading = ref(false)
const error = ref('')
const file = ref<StorageFileDto | null>(null)

const descriptor = computed(() =>
  file.value
    ? {
        id: file.value.id,
        fileName: file.value.originalFileName,
        contentType: file.value.contentType,
        extension: file.value.extension,
        sizeInBytes: file.value.sizeInBytes,
      }
    : null,
)

async function load() {
  if (!props.open || !props.storageId) {
    file.value = null
    error.value = ''
    return
  }

  loading.value = true
  error.value = ''
  try {
    file.value = await StorageService.getFile(props.storageId)
  } catch {
    file.value = null
    error.value = 'No se pudo cargar el archivo asociado al tarifario.'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.storageId] as const,
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <DhModal :open="open" title="Tarifa de la competencia" size="xl" @close="emit('close')">
    <div
      v-if="loading"
      class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-10 text-center text-sm font-bold text-[var(--dh-text-muted)]"
    >
      Cargando archivo…
    </div>

    <div
      v-else-if="error"
      class="rounded-[22px] border border-red-500/20 bg-red-500/10 p-5 text-sm font-bold text-red-600"
    >
      {{ error }}
    </div>

    <StorageFileViewer v-else-if="descriptor" v-bind="descriptor" />
  </DhModal>
</template>
