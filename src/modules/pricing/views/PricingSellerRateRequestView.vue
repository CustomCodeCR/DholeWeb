<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import SellerGuideButton from '@/modules/pricing/components/SellerGuideButton.vue'

const route = useRoute()
const activeWizardStep = ref(1)
function syncTourStep() {
  const active = document.querySelector('.pricing-crystal-shell .crystal-step--active')
  const number = Number(active?.querySelector('span')?.textContent?.trim())
  if (number >= 1 && number <= 9) activeWizardStep.value = number
}
let observer: MutationObserver | null = null
onMounted(() => {
  syncTourStep()
  observer = new MutationObserver(syncTourStep)
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => { observer?.disconnect() })
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
  <div data-seller-guide="request-intro" class="space-y-3">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <SellerGuideButton context="request" :modification="Boolean(sellerModificationRateId)"
        :step="activeWizardStep" />
    </div>
    <PricingAlternativeWizardCrystal seller-request-mode
      :key="sellerDuplicateRequestId ?? sellerEditRequestId ?? sellerModificationRateId ?? 'new-request'"
      :seller-edit-request-id="sellerEditRequestId"
      :seller-duplicate-request-id="sellerDuplicateRequestId"
      :seller-modification-rate-id="sellerModificationRateId" />
  </div>
</template>
