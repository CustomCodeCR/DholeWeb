<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const route = useRoute()
const requestId = computed(() => String(route.params.requestId ?? ''))
</script>

<template>
  <PricingAlternativeWizardCrystal :rate-request-id="requestId" />
</template>
