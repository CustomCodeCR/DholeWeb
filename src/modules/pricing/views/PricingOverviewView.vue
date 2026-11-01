<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import PricingWizardBoundary from '@/modules/pricing/components/PricingWizardBoundary.vue'
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
  <!-- The production/master quote detail uses the same wizard's complete
       read-only screen 9, not the simplified PricingRateReadOnlyView drawer. -->
  <PricingWizardBoundary v-else>
    <PricingAlternativeWizardCrystal
      :key="rateId ? `${rateId}:${viewOnly ? 'view' : 'edit'}` : 'new'"
      :rate-id="rateId"
      :view-only="Boolean(rateId) && viewOnly"
    />
  </PricingWizardBoundary>
</template>
