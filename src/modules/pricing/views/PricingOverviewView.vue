<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackagePlus } from 'lucide-vue-next'
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
const canCreateOwnLcl = computed(() =>
  authStore.hasScope(PRICING_SCOPES.ownLclConsolidations.create),
)
const ownLcl = computed(() =>
  !rateId.value && route.query.workspace === 'own-lcl' && canCreateOwnLcl.value,
)

function openOwnLcl() {
  if (!canCreateOwnLcl.value) return
  void router.replace({ path: '/pricing', query: { workspace: 'own-lcl' } })
}
</script>

<template>
  <div v-if="!rateId && !ownLcl && canCreateOwnLcl" class="mb-4 flex items-center gap-2">
    <DhButton
      label="Crear LCL propio"
      :icon="PackagePlus"
      variant="secondary"
      @click="openOwnLcl"
    />
  </div>

  <PricingOwnLclView v-if="ownLcl" />
  <PricingAlternativeWizardCrystal v-else :rate-id="rateId" :view-only="viewOnly" />
</template>
