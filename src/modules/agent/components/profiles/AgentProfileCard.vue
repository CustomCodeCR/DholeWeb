<script setup lang="ts">
import { DhCard } from '@/shared/components/molecules'
import AgentProfileStatus from './AgentProfileStatus.vue'
import AgentProfileSummary from './AgentProfileSummary.vue'

defineProps<{
  name: string
  description?: string | null
  active: boolean
  routeCount?: number
  equipmentCount?: number
  captureCount?: number
  fieldCount?: number
}>()
</script>

<template>
  <DhCard :title="name" :subtitle="description || undefined" padding="md">
    <template #actions>
      <AgentProfileStatus :active="active" />
    </template>

    <AgentProfileSummary
      :routes="routeCount ?? 0"
      :equipment="equipmentCount ?? 0"
      :captures="captureCount ?? 0"
      :fields="fieldCount ?? 0"
    />

    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>

    <div v-if="$slots.actions" class="mt-5 flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </DhCard>
</template>
