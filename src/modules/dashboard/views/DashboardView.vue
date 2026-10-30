<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
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

const canViewAllCommercialRates = computed(() =>
  authStore.hasScope('pricing.rate-request.view-all'),
)

// Un usuario puede tener Pricing y Vendedor a la vez. No perder la capacidad de
// visualizar el dashboard comercial al calcular el dashboard predeterminado.
const hasSellerRole = computed(() => authStore.roles.some((role) => {
  const value = role.trim().toLowerCase()
  return value === 'vendedor'
    || value === 'seller'
    || value === 'ventas'
    || value.includes('vendedor')
    || value.includes('seller')
}))

const isSellerUser = computed(() => {
  const sellerCapability = hasSellerRole.value || authStore.hasScope('pricing.rate-request.create')
  return sellerCapability && !hasPricingOperatorAccess.value && !canViewAllCommercialRates.value
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
// Pricing + Vendedor puede alternar, aunque no tenga el rol SuperUsuario.
type DashboardRole = 'pricing' | 'seller'
const selectedDashboardRole = ref<DashboardRole>('pricing')
const canSelectDashboard = computed(() =>
  isSuperUser() || (hasSellerRole.value && canUsePricing.value),
)
const activeDashboardRole = computed<DashboardRole>(() =>
  canSelectDashboard.value
    ? selectedDashboardRole.value
    : (canViewAllCommercialRates.value || isSellerUser.value ? 'seller' : 'pricing'),
)
</script>

<template>
  <section class="space-y-6">
    <section class="dh-glass dh-liquid rounded-[36px] p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">
            Bienvenido
          </p>
          <h1 class="mt-3 break-words text-3xl font-black tracking-tight text-[var(--dh-text)] md:text-5xl">
            {{ authStore.userDisplayName || t('dashboard.operator') }}
          </h1>
        </div>
        <div v-if="canSelectDashboard" class="w-full shrink-0 sm:w-56">
          <label for="role-dashboard-selector" class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            Dashboard por rol
          </label>
          <div class="relative">
            <select
              id="role-dashboard-selector"
              v-model="selectedDashboardRole"
              class="w-full appearance-none rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] py-2.5 pl-3.5 pr-10 text-sm font-bold text-[var(--dh-text)] outline-none transition hover:border-[var(--dh-primary)] focus:border-[var(--dh-primary)] focus:ring-2 focus:ring-[rgb(var(--dh-primary-rgb)/0.2)]"
            >
              <option value="pricing">Pricing</option>
              <option value="seller">Vendedor</option>
            </select>
            <ChevronDown aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]" />
          </div>
        </div>
      </div>
    </section>

    <!-- SuperUsuario supervisa globalmente y puede operar lo propio. Un usuario
         Pricing + Vendedor consulta sus propias tarifas, no las de terceros. -->
    <SellerRoleDashboard
      v-if="activeDashboardRole === 'seller'"
      :admin-preview="isSuperUser() || (canViewAllCommercialRates && !canSelectDashboard)"
      :enable-seller-actions="authStore.hasScope('pricing.rate-request.create')"
    />

    <template v-else-if="canUsePricing">
      <PricingRateRequestsPanel v-if="canManageSellerRequests" />
      <PricingRoleDashboard />
    </template>
  </section>
</template>
