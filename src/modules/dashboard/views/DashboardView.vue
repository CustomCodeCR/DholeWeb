<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { PRICING_SCOPES, VIEW_SCOPES } from '@/core/auth/scopes'
import PricingRoleDashboard from '@/modules/dashboard/components/PricingRoleDashboard.vue'
import SellerRoleDashboard from '@/modules/dashboard/components/SellerRoleDashboard.vue'
import PricingRateRequestsPanel from '@/modules/pricing/components/PricingRateRequestsPanel.vue'

const { t } = useI18n()
const authStore = useAuthStore()

function isSuperUser(): boolean {
  return (
    authStore.hasRole('SuperUsuario') ||
    authStore.hasRole('SuperUser') ||
    authStore.hasRole('superusuario')
  )
}

const isSellerUser = computed(() => {
  const roleSeller = authStore.roles.some((role) => {
    const value = role.trim().toLowerCase()
    return value === 'vendedor' || value === 'seller' || value === 'ventas' || value.includes('vendedor') || value.includes('seller')
  })

  return roleSeller || (
    authStore.hasScope('pricing.rate-requests.create') &&
    !authStore.hasScope(PRICING_SCOPES.rates.update)
  )
})

const canUsePricing = computed(
  () =>
    isSuperUser() ||
    authStore.hasScope(VIEW_SCOPES.pricing) ||
    authStore.hasScope(VIEW_SCOPES.pricingRates) ||
    authStore.hasScope(VIEW_SCOPES.pricingImports) ||
    authStore.hasScope(VIEW_SCOPES.pricingDecisions),
)

const canManageSellerRequests = computed(() =>
  !isSellerUser.value && authStore.hasScope(PRICING_SCOPES.rates.update),
)
</script>

<template>
  <section class="space-y-6">
    <section class="dh-glass dh-liquid rounded-[36px] p-6">
      <div>
        <p class="text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">
          Bienvenido
        </p>
        <h1 class="mt-3 text-3xl font-black tracking-tight text-[var(--dh-text)] md:text-5xl">
          {{ authStore.userDisplayName || t('dashboard.operator') }}
        </h1>
      </div>
    </section>

    <SellerRoleDashboard v-if="isSellerUser" />

    <template v-else-if="canUsePricing">
      <PricingRateRequestsPanel v-if="canManageSellerRequests" />
      <PricingRoleDashboard />
    </template>
  </section>
</template>
