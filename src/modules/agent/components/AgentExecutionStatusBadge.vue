<script setup lang="ts">
import AgentExecutionStatusBadge from './executions/AgentExecutionStatusBadge.vue'
import type { AgentExecutionStatus } from '@/core/interfaces/agent'

defineProps<{ status: AgentExecutionStatus | string }>()
</script>

<template>
  <AgentExecutionStatusBadge :status="status" />
</template>
