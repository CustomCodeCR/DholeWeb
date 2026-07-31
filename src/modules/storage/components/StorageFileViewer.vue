<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertTriangle, FileText, Image as ImageIcon, LoaderCircle } from 'lucide-vue-next'
import { StorageService, storagePreviewKind } from '@/core/services/storageService'
import type { StorageFileDescriptor } from '@/core/interfaces/storage'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<StorageFileDescriptor>()
const toastStore = useToastStore()
const loading = ref(true)
const objectUrl = ref<string | null>(null)
const textContent = ref('')
const errorMessage = ref<string | null>(null)
const kind = computed(() => storagePreviewKind(props))

async function load() {
  loading.value = true
  errorMessage.value = null

  try {
    const blob = await StorageService.getContent(props.id)

    if (kind.value === 'image' || kind.value === 'pdf') {
      objectUrl.value = URL.createObjectURL(blob)
      return
    }

    if (kind.value === 'text') {
      textContent.value = await blob.text()
      return
    }

    errorMessage.value = 'Este formato no tiene una vista previa disponible.'
  } catch (error) {
    errorMessage.value = 'No se pudo cargar el contenido del archivo.'
    toastStore.backendError(error, errorMessage.value)
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <ImageIcon v-if="kind === 'image'" class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <FileText v-else class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div class="min-w-0">
        <p class="truncate font-black text-[var(--dh-text)]">{{ fileName }}</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ contentType || 'Tipo desconocido' }}
          <template v-if="sizeInBytes != null"> · {{ (sizeInBytes / 1024).toFixed(1) }} KB</template>
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex min-h-[420px] items-center justify-center rounded-[24px] bg-black/[0.025] dark:bg-white/[0.04]">
      <LoaderCircle class="h-8 w-8 animate-spin text-[var(--dh-primary)]" />
    </div>

    <div v-else-if="errorMessage" class="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-8 text-center">
      <AlertTriangle class="h-8 w-8 text-amber-600" />
      <p class="font-black text-[var(--dh-text)]">{{ errorMessage }}</p>
    </div>

    <img
      v-else-if="kind === 'image' && objectUrl"
      :src="objectUrl"
      :alt="fileName"
      class="mx-auto max-h-[72vh] max-w-full rounded-[24px] object-contain shadow-[var(--dh-shadow-lg)]"
    />

    <iframe
      v-else-if="kind === 'pdf' && objectUrl"
      :src="objectUrl"
      :title="fileName"
      class="h-[72vh] w-full rounded-[24px] border border-[var(--dh-border)] bg-white"
    />

    <pre
      v-else-if="kind === 'text'"
      class="dh-scrollbar max-h-[72vh] overflow-auto whitespace-pre-wrap break-words rounded-[24px] border border-[var(--dh-border)] bg-black/[0.025] p-5 text-sm leading-6 text-[var(--dh-text-soft)] dark:bg-white/[0.04]"
    >{{ textContent }}</pre>
  </div>
</template>
