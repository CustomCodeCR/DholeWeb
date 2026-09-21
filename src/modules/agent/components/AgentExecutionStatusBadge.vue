<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhBadge } from '@/shared/components/atoms'
import type { AgentExecutionStatus } from '@/core/interfaces/agent'

const props = defineProps<{ status: AgentExecutionStatus | string }>()
const { t } = useI18n()

const variant = computed<'primary' | 'success' | 'warning' | 'danger' | 'neutral'>(() => {
  if (props.status === 'Completed') return 'success'
  if (props.status === 'Running') return 'primary'
  if (props.status === 'Failed') return 'danger'
  if (props.status === 'Cancelled' || props.status === 'PartiallyCompleted') return 'warning'
  if (props.status === 'WaitingForAuthentication') return 'warning'
  return 'neutral'
})

const label = computed(() => {
  const key = `agent.status.${props.status}`
  const translated = t(key)
  return translated === key ? props.status : translated
})
</script>

<template>
  <DhBadge :label="label" :variant="variant" />
</template>
