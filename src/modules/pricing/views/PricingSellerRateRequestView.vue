<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const route = useRoute()
const sellerEditRequestId = computed(() => String(route.params.requestId ?? '').trim() || null)
const sellerModificationRateId = computed(() => {
  const value = route.query.modifyRateId
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null
})
</script>

<template>
  <PricingAlternativeWizardCrystal seller-request-mode
    :seller-edit-request-id="sellerEditRequestId"
    :seller-modification-rate-id="sellerModificationRateId" />
</template>
