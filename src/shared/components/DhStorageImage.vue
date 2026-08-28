<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ImageOff } from 'lucide-vue-next'
import { StorageService } from '@/core/services/storageService'

const props = withDefaults(
  defineProps<{
    fileId?: string | null
    alt?: string
  }>(),
  {
    fileId: null,
    alt: 'Imagen',
  },
)

const source = ref('')
const loading = ref(false)
const failed = ref(false)
let objectUrl = ''

function clearObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = ''
  source.value = ''
}

async function load() {
  clearObjectUrl()
  failed.value = false

  const fileId = props.fileId?.trim()
  if (!fileId) return

  try {
    loading.value = true
    const blob = await StorageService.getContent(fileId)
    objectUrl = URL.createObjectURL(blob)
    source.value = objectUrl
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.fileId, () => void load(), { immediate: true })
onBeforeUnmount(clearObjectUrl)
</script>

<template>
  <div class="relative grid place-items-center overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]">
    <img
      v-if="source"
      :src="source"
      :alt="alt"
      class="h-full w-full object-cover"
      loading="lazy"
    />
    <span v-else-if="loading" class="text-[11px] font-bold text-[var(--dh-text-muted)]">Cargando…</span>
    <div v-else class="flex flex-col items-center gap-1 text-[var(--dh-text-muted)]">
      <ImageOff class="h-5 w-5" />
      <span class="text-[10px] font-bold">{{ failed ? 'No disponible' : 'Sin imagen' }}</span>
    </div>
  </div>
</template>
