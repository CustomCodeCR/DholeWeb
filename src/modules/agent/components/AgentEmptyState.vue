<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { DhEmptyState } from '@/shared/components/atoms'

withDefaults(
  defineProps<{
    title: string
    description?: string
    actionLabel?: string
  }>(),
  {
    description: '',
    actionLabel: '',
  },
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <DhEmptyState
    :icon="Bot"
    :title="title"
    :description="description || undefined"
    :action-label="actionLabel || undefined"
    @action="emit('action')"
  />
</template>
