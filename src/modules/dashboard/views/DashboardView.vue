<script setup lang="ts">
import {
  Activity,
  ClipboardList,
  TrendingUp,
  KeyRound,
  ListTree,
  MonitorCheck,
  ServerCog,
  Shield,
  Users,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DhPageHeader } from '@/shared/components/organisms'
import { DhBadge } from '@/shared/components/atoms'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

function isSuperUser(): boolean {
  return authStore.hasRole('SuperUsuario') || authStore.hasRole('SuperUser') || authStore.hasRole('superusuario')
}

const cards = computed(() =>
  [
    {
      title: t('sidebar.users'),
      value: t('dashboard.values.auth'),
      icon: Users,
      path: '/auth/users',
      description: t('dashboard.openUsers'),
      visible: authStore.hasScope(VIEW_SCOPES.users),
    },
    {
      title: t('sidebar.roles'),
      value: t('dashboard.values.rbac'),
      icon: Shield,
      path: '/auth/roles',
      description: t('dashboard.openRoles'),
      visible: authStore.hasScope(VIEW_SCOPES.roles),
    },
    {
      title: t('sidebar.scopes'),
      value: t('dashboard.values.scopes'),
      icon: KeyRound,
      path: '/auth/scopes',
      description: t('dashboard.openScopes'),
      visible: authStore.hasScope(VIEW_SCOPES.scopes),
    },
    {
      title: t('sidebar.sessions'),
      value: t('dashboard.values.jwt'),
      icon: MonitorCheck,
      path: '/auth/sessions',
      description: t('dashboard.openSessions'),
      visible: authStore.hasScope(VIEW_SCOPES.sessions),
    },
    {
      title: t('sidebar.catalogs'),
      value: t('dashboard.values.config'),
      icon: ListTree,
      path: '/config/catalogs',
      description: t('dashboard.openCatalogs'),
      visible: authStore.hasScope(VIEW_SCOPES.catalogs),
    },
    {
      title: t('sidebar.pricing'),
      value: t('dashboard.values.pricing'),
      icon: TrendingUp,
      path: '/pricing',
      description: t('dashboard.openPricing'),
      visible:
        authStore.hasScope(VIEW_SCOPES.pricing) ||
        authStore.hasScope(VIEW_SCOPES.pricingRates) ||
        authStore.hasScope(VIEW_SCOPES.pricingImports) ||
        authStore.hasScope(VIEW_SCOPES.pricingDecisions),
    },
    {
      title: t('sidebar.audits'),
      value: t('dashboard.values.audit'),
      icon: ClipboardList,
      path: '/auditlogs/events',
      description: t('dashboard.openAudits'),
      visible: authStore.hasScope(VIEW_SCOPES.auditLogs),
    },
    {
      title: t('sidebar.monitoring'),
      value: t('dashboard.values.monitoring'),
      icon: ServerCog,
      path: '/monitoring/services',
      description: t('dashboard.openMonitoring'),
      visible: isSuperUser(),
    },
  ].filter((card) => card.visible),
)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('dashboard.title')" :subtitle="t('dashboard.subtitle')" :icon="Activity" />

    <section class="dh-glass dh-liquid rounded-[36px] p-6">
      <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p class="text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">
            {{ t('dashboard.welcome') }}
          </p>
          <h2 class="mt-3 text-3xl font-black tracking-tight text-[var(--dh-text)] md:text-5xl">
            {{ authStore.userDisplayName || t('dashboard.operator') }}
          </h2>
          <p class="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--dh-text-muted)]">
            {{ t('dashboard.description') }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
              {{ t('dashboard.visibleModules') }}
            </p>
            <p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ cards.length }}</p>
          </div>
          <div class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
              {{ t('dashboard.sessionStatus') }}
            </p>
            <p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ t('common.active') }}</p>
          </div>
        </div>
      </div>
    </section>

    <div v-if="cards.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="card in cards"
        :key="card.path"
        class="dh-glass dh-liquid dh-card-hover rounded-[32px] p-5 text-left"
        @click="router.push(card.path)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ card.title }}</p>
            <h2 class="mt-2 truncate text-2xl font-black text-[var(--dh-text)]">{{ card.value }}</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ card.description }}</p>
          </div>
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] dh-bg-primary-soft text-[var(--dh-primary)]">
            <component :is="card.icon" class="h-6 w-6" />
          </div>
        </div>
        <DhBadge class="mt-5" :label="t('common.available')" variant="success" />
      </button>
    </div>

    <section v-else class="dh-glass dh-liquid rounded-[32px] p-6">
      <p class="text-sm font-bold text-[var(--dh-text)]">{{ t('dashboard.noModules') }}</p>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        {{ t('dashboard.noModulesHint') }}
      </p>
    </section>
  </section>
</template>
