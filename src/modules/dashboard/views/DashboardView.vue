<script setup lang="ts">
import { Activity, KeyRound, MonitorCheck, Shield, Users } from 'lucide-vue-next'
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

const cards = computed(() =>
  [
    {
      title: t('sidebar.users'),
      value: 'Auth',
      icon: Users,
      path: '/auth/users',
      description: t('dashboard.openUsers'),
      scope: VIEW_SCOPES.users,
    },
    {
      title: t('sidebar.roles'),
      value: 'RBAC',
      icon: Shield,
      path: '/auth/roles',
      description: t('dashboard.openRoles'),
      scope: VIEW_SCOPES.roles,
    },
    {
      title: t('sidebar.scopes'),
      value: 'Scopes',
      icon: KeyRound,
      path: '/auth/scopes',
      description: t('dashboard.openScopes'),
      scope: VIEW_SCOPES.scopes,
    },
    {
      title: t('sidebar.sessions'),
      value: 'JWT',
      icon: MonitorCheck,
      path: '/auth/sessions',
      description: t('dashboard.openSessions'),
      scope: VIEW_SCOPES.sessions,
    },
  ].filter((card) => authStore.hasScope(card.scope)),
)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('dashboard.title')" :subtitle="t('dashboard.subtitle')" :icon="Activity" />

    <div v-if="cards.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="card in cards"
        :key="card.path"
        class="dh-glass dh-liquid dh-card-hover rounded-[32px] p-5 text-left"
        @click="router.push(card.path)"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ card.title }}</p>
            <h2 class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ card.value }}</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ card.description }}</p>
          </div>
          <div class="flex h-12 w-12 items-center justify-center rounded-[22px] bg-red-500/10 text-[var(--dh-primary)]">
            <component :is="card.icon" class="h-6 w-6" />
          </div>
        </div>
        <DhBadge class="mt-5" label="Online" variant="success" />
      </button>
    </div>

    <section v-else class="dh-glass dh-liquid rounded-[32px] p-6">
      <p class="text-sm font-bold text-[var(--dh-text)]">No hay módulos visibles para este usuario.</p>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        Asigne scopes de tipo view para mostrar accesos en el dashboard y en el sidebar.
      </p>
    </section>
  </section>
</template>
