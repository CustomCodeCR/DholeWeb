<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const route = useRoute()
const sellerEditRequestId = computed(() => String(route.params.requestId ?? '').trim() || null)
const sellerDuplicateRequestId = computed(() => {
  const value = route.query.duplicateRequestId
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null
})
const sellerModificationRateId = computed(() => {
  const value = route.query.modifyRateId
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null
})
</script>

<template>
  <PricingAlternativeWizardCrystal seller-request-mode
    :key="sellerDuplicateRequestId ?? sellerEditRequestId ?? sellerModificationRateId ?? 'new-request'"
    :seller-edit-request-id="sellerEditRequestId"
    :seller-duplicate-request-id="sellerDuplicateRequestId"
    :seller-modification-rate-id="sellerModificationRateId" />
</template>
