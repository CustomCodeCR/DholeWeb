<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackagePlus, Ship } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import PricingLclWizard from '@/modules/pricing/components/PricingLclWizard.vue'
import PricingOwnLclView from '@/modules/pricing/views/PricingOwnLclView.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const rateId = computed(() => typeof route.params.rateId === 'string' ? route.params.rateId : null)
const viewOnly = computed(() => route.query.mode === 'view')
const canCreateOwnLcl = computed(() =>
  authStore.hasScope(PRICING_SCOPES.ownLclConsolidations.create),
)
const ownLcl = computed(() =>
  !rateId.value && route.query.workspace === 'own-lcl' && canCreateOwnLcl.value,
)
const lclMode = computed(() =>
  !rateId.value && !ownLcl.value && route.query.pricingMode === 'lcl',
)

// Mantiene separados los tres espacios de cotización sin perder los flujos LCL ya existentes.
function switchWorkspace(value: 'quote' | 'lcl' | 'own-lcl') {
  if (value === 'own-lcl') {
    if (!canCreateOwnLcl.value) return
    void router.replace({ path: '/pricing', query: { workspace: 'own-lcl' } })
    return
  }

  if (value === 'lcl') {
    void router.replace({ path: '/pricing', query: { pricingMode: 'lcl' } })
    return
  }

  void router.replace('/pricing')
}
</script>

<template>
  <div v-if="!rateId" class="mb-4 flex flex-wrap items-center gap-2">
    <DhButton
      label="FCL / Estándar"
      :icon="Ship"
      :variant="!lclMode && !ownLcl ? 'primary' : 'secondary'"
      @click="switchWorkspace('quote')"
    />
    <DhButton
      label="LCL"
      :icon="Ship"
      :variant="lclMode ? 'primary' : 'secondary'"
      @click="switchWorkspace('lcl')"
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
  <PricingLclWizard v-else-if="lclMode" />
  <PricingAlternativeWizardCrystal v-else :rate-id="rateId" :view-only="viewOnly" />
</template>
