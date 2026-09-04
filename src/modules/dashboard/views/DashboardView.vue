<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import PricingRoleDashboard from '@/modules/dashboard/components/PricingRoleDashboard.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

function isSuperUser(): boolean {
  return (
    authStore.hasRole('SuperUsuario') ||
    authStore.hasRole('SuperUser') ||
    authStore.hasRole('superusuario')
  )
}

function isPrivilegedUser(): boolean {
  return (
    isSuperUser() ||
    authStore.hasRole('SuperAdmin') ||
    authStore.hasRole('Administrador') ||
    authStore.hasRole('Administrator') ||
    authStore.hasRole('Admin')
  )
}

const isPricingUser = computed(
  () =>
    authStore.hasRole('Pricing') ||
    authStore.roles.some((role) => role.trim().toLowerCase().includes('pricing')),
)

const redirectToPricing = computed(() => isPricingUser.value && !isPrivilegedUser())

const canUsePricing = computed(
  () =>
    isSuperUser() ||
    authStore.hasScope(VIEW_SCOPES.pricing) ||
    authStore.hasScope(VIEW_SCOPES.pricingRates) ||
    authStore.hasScope(VIEW_SCOPES.pricingImports) ||
    authStore.hasScope(VIEW_SCOPES.pricingDecisions),
)

onMounted(async () => {
  if (redirectToPricing.value) await router.replace('/pricing')
})
</script>

<template>
  <section v-if="!redirectToPricing" class="space-y-6">
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
