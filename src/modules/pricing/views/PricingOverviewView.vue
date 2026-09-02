<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import PricingLclWizard from '@/modules/pricing/components/PricingLclWizard.vue'

const route = useRoute()
const router = useRouter()
const rateId = computed(() => typeof route.params.rateId === 'string' ? route.params.rateId : null)
const viewOnly = computed(() => route.query.mode === 'view')
const lclMode = computed(() => !rateId.value && route.query.pricingMode === 'lcl')

function setPricingMode(mode: 'standard' | 'lcl') {
  const query = { ...route.query }
  if (mode === 'lcl') query.pricingMode = 'lcl'
  else delete query.pricingMode
  void router.replace({ query })
}
</script>

<template>
  <div v-if="!rateId" class="pricing-mode-bar">
    <span>Flujo de cotización</span>
    <button :class="{ active: !lclMode }" @click="setPricingMode('standard')">FCL / Estándar</button>
    <button :class="{ active: lclMode }" @click="setPricingMode('lcl')">LCL</button>
  </div>

  <PricingLclWizard v-if="lclMode" />
  <PricingAlternativeWizardCrystal v-else :rate-id="rateId" :view-only="viewOnly" />
</template>

<style scoped>
.pricing-mode-bar {
  max-width: 1500px;
  margin: 14px auto 0;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.pricing-mode-bar span { margin-right: 4px; color: #687287; font-size: 12px; font-weight: 700; }
.pricing-mode-bar button { border: 1px solid #d8dde7; background: #fff; color: #2b364b; border-radius: 10px; padding: 8px 12px; font-weight: 750; cursor: pointer; }
.pricing-mode-bar button.active { background: #172033; color: #fff; border-color: #172033; }
@media (max-width: 640px) { .pricing-mode-bar { padding: 0 12px; justify-content: stretch; flex-wrap: wrap; } .pricing-mode-bar span { width: 100%; } .pricing-mode-bar button { flex: 1; } }
</style>
