<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const batchId = typeof route.params.batchId === 'string' ? route.params.batchId : ''
  router.replace({
    path: '/pricing/imports',
    query: batchId ? { importBatchId: batchId } : undefined,
  })
})
</script>

<template>
  <div class="p-6 text-sm font-semibold text-[var(--dh-text-muted)]">Abriendo la revisión de tarifas…</div>
</template>
