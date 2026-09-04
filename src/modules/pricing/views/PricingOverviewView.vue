<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const route = useRoute()
const rateId = computed(() => typeof route.params.rateId === 'string' ? route.params.rateId : null)
const viewOnly = computed(() => route.query.mode === 'view')
</script>

<template>
  <PricingAlternativeWizardCrystal :rate-id="rateId" :view-only="viewOnly" />
</template>
