<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import PricingRateExistingWizardStable from '@/modules/pricing/components/PricingRateExistingWizardStable.vue'
import PricingOwnLclView from '@/modules/pricing/views/PricingOwnLclView.vue'

const route = useRoute()
const authStore = useAuthStore()
const rateId = computed(() => typeof route.params.rateId === 'string' ? route.params.rateId : null)
const viewOnly = computed(() => route.query.mode === 'view')
const canCreateOwnLcl = computed(() =>
  authStore.hasScope(PRICING_SCOPES.ownLclConsolidations.create),
)
const ownLcl = computed(() =>
  !rateId.value && route.query.workspace === 'own-lcl' && canCreateOwnLcl.value,
)

</script>

<template>
  <PricingOwnLclView v-if="ownLcl" />
  <PricingRateExistingWizardStable v-else-if="rateId" :rate-id="rateId" :view-only="viewOnly" />
  <PricingAlternativeWizardCrystal v-else :rate-id="null" :view-only="false" />
</template>
