<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const route = useRoute()
const sellerEditRequestId = computed(() => String(route.params.requestId ?? '').trim() || null)
</script>

<template>
  <PricingAlternativeWizardCrystal seller-request-mode :seller-edit-request-id="sellerEditRequestId" />
</template>
