<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'
import type { AgentExecutionStatus } from '@/core/interfaces/agent'

const props = defineProps<{ status: AgentExecutionStatus | string }>()

const variant = computed<'primary' | 'success' | 'warning' | 'danger' | 'neutral'>(() => {
  if (props.status === 'Completed') return 'success'
  if (props.status === 'Running') return 'primary'
  if (props.status === 'Failed') return 'danger'
  if (props.status === 'Cancelled' || props.status === 'PartiallyCompleted') return 'warning'
  if (props.status === 'WaitingForAuthentication') return 'warning'
  return 'neutral'
})

const label = computed(() => {
  const labels: Record<string, string> = {
    Pending: 'Pendiente',
    Queued: 'En cola',
    Running: 'Ejecutando',
    WaitingForAuthentication: 'Esperando autenticación',
    Completed: 'Completada',
    PartiallyCompleted: 'Parcial',
    Failed: 'Fallida',
    Cancelled: 'Cancelada',
  }

  return labels[props.status] ?? props.status
})
</script>

<template>
  <DhBadge :label="label" :variant="variant" />
</template>
