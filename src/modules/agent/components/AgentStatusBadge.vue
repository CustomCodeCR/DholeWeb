<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'

const props = withDefaults(
  defineProps<{
    active: boolean
    activeLabel?: string
    inactiveLabel?: string
  }>(),
  {
    activeLabel: 'Activo',
    inactiveLabel: 'Inactivo',
  },
)

const label = computed(() => (props.active ? props.activeLabel : props.inactiveLabel))
</script>

<template>
  <DhBadge :label="label" :variant="active ? 'success' : 'neutral'" />
</template>
