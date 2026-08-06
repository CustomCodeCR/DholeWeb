<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import PricingRoleDashboard from '@/modules/dashboard/components/PricingRoleDashboard.vue'

const { t } = useI18n()
const authStore = useAuthStore()

function isSuperUser(): boolean {
  return (
    authStore.hasRole('SuperUsuario') ||
    authStore.hasRole('SuperUser') ||
    authStore.hasRole('superusuario')
  )
}

const canUsePricing = computed(
  () =>
    isSuperUser() ||
    authStore.hasScope(VIEW_SCOPES.pricing) ||
    authStore.hasScope(VIEW_SCOPES.pricingRates) ||
    authStore.hasScope(VIEW_SCOPES.pricingImports) ||
    authStore.hasScope(VIEW_SCOPES.pricingDecisions),
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

    <PricingRoleDashboard v-if="canUsePricing" />
  </section>
</template>
