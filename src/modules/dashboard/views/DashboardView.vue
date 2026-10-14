<script setup lang="ts">
import { computed, ref } from 'vue'
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

const hasPricingOperatorAccess = computed(() =>
  authStore.hasScope(PRICING_SCOPES.rates.create)
  || authStore.hasScope(PRICING_SCOPES.rates.update)
  || authStore.hasScope(PRICING_SCOPES.rates.delete)
  || authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin)
  || authStore.hasScope(PRICING_SCOPES.rates.approveFreight)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.review)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.approve)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.reject)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate),
)

const isSellerUser = computed(() => {
  const roleSeller = authStore.roles.some((role) => {
    const value = role.trim().toLowerCase()
    return value === 'vendedor'
      || value === 'seller'
      || value === 'ventas'
      || value.includes('vendedor')
      || value.includes('seller')
  })

  const sellerCapability = roleSeller || authStore.hasScope('pricing.rate-request.create')
  return sellerCapability && !hasPricingOperatorAccess.value
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

// El selector altera sólo la vista; nunca cambia la sesión ni sus permisos.
type DashboardRole = 'pricing' | 'seller'
const selectedDashboardRole = ref<DashboardRole>('pricing')
const activeDashboardRole = computed<DashboardRole>(() =>
  isSuperUser() ? selectedDashboardRole.value : (isSellerUser.value ? 'seller' : 'pricing'),
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

    <section
      v-if="isSuperUser()"
      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-black text-[var(--dh-text)]">Dashboard por rol</h2>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Seleccione la vista que desea consultar. No cambia su sesión ni los permisos de su cuenta.
          </p>
        </div>
        <div class="flex w-full gap-2 sm:w-auto" role="group" aria-label="Seleccionar dashboard por rol">
          <button
            type="button"
            :aria-pressed="activeDashboardRole === 'pricing'"
            class="flex-1 rounded-xl border px-4 py-2.5 text-sm font-black transition sm:flex-none"
            :class="activeDashboardRole === 'pricing'
              ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
              : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] hover:border-[var(--dh-primary)]'"
            @click="selectedDashboardRole = 'pricing'"
          >Pricing</button>
          <button
            type="button"
            :aria-pressed="activeDashboardRole === 'seller'"
            class="flex-1 rounded-xl border px-4 py-2.5 text-sm font-black transition sm:flex-none"
            :class="activeDashboardRole === 'seller'
              ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
              : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)] hover:border-[var(--dh-primary)]'"
            @click="selectedDashboardRole = 'seller'"
          >Vendedor</button>
        </div>
      </div>
    </section>

    <SellerRoleDashboard
      v-if="activeDashboardRole === 'seller'"
      :admin-preview="isSuperUser()"
    />

    <template v-else-if="canUsePricing">
      <PricingRateRequestsPanel v-if="canManageSellerRequests" />
      <PricingRoleDashboard />
    </template>
  </section>
</template>
