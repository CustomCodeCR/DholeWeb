<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhBadge } from '@/shared/components/atoms'

const props = defineProps<{
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}>()

const { t } = useI18n()
const label = computed(() =>
  props.active
    ? props.activeLabel ?? t('agent.status.active')
    : props.inactiveLabel ?? t('agent.status.inactive'),
)
</script>

<template>
  <DhBadge :label="label" :variant="active ? 'success' : 'neutral'" />
</template>
