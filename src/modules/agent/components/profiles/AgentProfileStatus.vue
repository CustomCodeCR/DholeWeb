<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'

const props = defineProps<{ active: boolean }>()

const label = computed(() => (props.active ? 'Activo' : 'Inactivo'))
const variant = computed(() => (props.active ? 'success' : 'neutral'))
</script>

<template>
  <DhBadge :label="label" :variant="variant" />
</template>
