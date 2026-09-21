<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'
import type { AgentProviderType } from '@/core/interfaces/agent'

const props = defineProps<{ providerType: AgentProviderType | string }>()

const label = computed(() => {
  const labels: Record<string, string> = {
    Maersk: 'Maersk',
    Msc: 'MSC',
    Pil: 'PIL',
    CmaCgm: 'CMA CGM',
    HapagLloyd: 'Hapag-Lloyd',
    GenericWeb: 'Web genérica',
  }

  return labels[props.providerType] ?? props.providerType
})
</script>

<template>
  <DhBadge :label="label" variant="primary" />
</template>
