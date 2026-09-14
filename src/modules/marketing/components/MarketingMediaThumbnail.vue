<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { File as FileIcon, FileImage, FileText, Film } from 'lucide-vue-next'
import { downloadFile } from '@/core/api/fetchConfig'
import { mediaKind } from '@/core/media/mediaLibrary'
import type { MediaDto } from '@/core/interfaces/content'
import DhSkeleton from '@/shared/components/atoms/DhSkeleton.vue'

const props = defineProps<{ item: MediaDto }>()

const rootRef = ref<HTMLElement | null>(null)
const previewUrl = ref('')
const loading = ref(false)
const failed = ref(false)
let observer: IntersectionObserver | null = null

const kind = computed(() => mediaKind(props.item.contentType, props.item.fileName))

function releasePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function loadThumbnail() {
  if (kind.value !== 'image' || loading.value || previewUrl.value || failed.value) return
  loading.value = true
  try {
    const response = await downloadFile(
      `/api/content/media/${props.item.id}/content`,
      props.item.fileName,
    )
    previewUrl.value = URL.createObjectURL(response.blob)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (kind.value !== 'image') return
  if (typeof IntersectionObserver === 'undefined') {
    void loadThumbnail()
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    observer?.disconnect()
    observer = null
    void loadThumbnail()
  }, { rootMargin: '180px' })

  if (rootRef.value) observer.observe(rootRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  releasePreview()
})
</script>

<template>
  <div
    ref="rootRef"
    class="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-black/[0.04] text-[var(--dh-text-muted)] dark:bg-white/[0.05]"
  >
    <DhSkeleton v-if="loading" class="absolute inset-0 h-full w-full" height="100%" />
    <img
      v-else-if="previewUrl"
      :src="previewUrl"
      :alt="item.altText || item.fileName"
      loading="lazy"
      class="h-full w-full object-cover"
    />
    <FileImage v-else-if="kind === 'image'" class="h-10 w-10 opacity-45" />
    <Film v-else-if="kind === 'video'" class="h-10 w-10 opacity-45" />
    <FileText v-else-if="kind === 'pdf'" class="h-10 w-10 opacity-45" />
    <FileIcon v-else class="h-10 w-10 opacity-45" />
  </div>
</template>
