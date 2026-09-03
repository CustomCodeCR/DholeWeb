<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackagePlus, Ship } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import PricingOwnLclView from '@/modules/pricing/views/PricingOwnLclView.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const rateId = computed(() => typeof route.params.rateId === 'string' ? route.params.rateId : null)
const viewOnly = computed(() => route.query.mode === 'view')
const ownLcl = computed(() => route.query.workspace === 'own-lcl')
const canCreateOwnLcl = computed(() =>
  authStore.hasScope(PRICING_SCOPES.ownLclConsolidations.create),
)

function switchWorkspace(value: 'quote' | 'own-lcl') {
  if (value === 'own-lcl') {
    if (!canCreateOwnLcl.value) return
    void router.replace({ path: '/pricing', query: { workspace: 'own-lcl' } })
    return
  }
  void router.replace('/pricing')
}
</script>

<template>
  <div v-if="!rateId" class="mb-4 flex flex-wrap items-center gap-2">
    <DhButton
      label="Cotización"
      :icon="Ship"
      :variant="ownLcl ? 'secondary' : 'primary'"
      @click="switchWorkspace('quote')"
    />
    <DhButton
      v-if="canCreateOwnLcl"
      label="Crear LCL propio"
      :icon="PackagePlus"
      :variant="ownLcl ? 'primary' : 'secondary'"
      @click="switchWorkspace('own-lcl')"
    />
  </div>

  <PricingOwnLclView v-if="ownLcl && !rateId" />
  <PricingAlternativeWizardCrystal v-else :rate-id="rateId" :view-only="viewOnly" />
</template>
