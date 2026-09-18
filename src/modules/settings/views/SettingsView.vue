<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ContactRound, DatabaseZap, Keyboard, Palette, RefreshCcw, Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { DhButton } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import DatabaseMaintenanceView from './DatabaseMaintenanceView.vue'
import EmployeeDirectorySettingsView from './EmployeeDirectorySettingsView.vue'
import EnvironmentRecoveryView from './EnvironmentRecoveryView.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const showDirectory = computed(() => route.query.section === 'extensions')
const showDatabaseMaintenance = computed(
  () => route.query.section === 'database-maintenance' && authStore.hasRole('SuperUsuario'),
)
const showEnvironmentRecovery = computed(
  () => route.query.section === 'environment-recovery' && authStore.hasRole('SuperUsuario'),
)
const isSuperUser = computed(() => authStore.hasRole('SuperUsuario'))

const cards = computed(() => {
  const items = [
    {
      title: t('settings.appearance'),
      description: t('settings.appearanceDescription'),
      icon: Palette,
      path: '/settings/appearance',
    },
    {
      title: t('settings.directory'),
      description: t('settings.directoryDescription'),
      icon: ContactRound,
      path: '/settings?section=extensions',
    },
    {
      title: t('settings.shortcuts'),
      description: t('settings.shortcutsDescription'),
      icon: Keyboard,
      path: '/settings/shortcuts',
    },
  ]

  if (isSuperUser.value) {
    items.push(
      {
        title: t('settings.databaseMaintenance'),
        description: t('settings.databaseMaintenanceDescription'),
        icon: DatabaseZap,
        path: '/settings?section=database-maintenance',
      },
      {
        title: t('settings.environmentRecovery'),
        description: t('settings.environmentRecoveryDescription'),
        icon: RefreshCcw,
        path: '/settings?section=environment-recovery',
      },
    )
  }

  return items
})
</script>

<template>
  <section v-if="showDirectory" class="space-y-4">
    <DhButton
      :label="t('settings.backToSettings')"
      variant="secondary"
      :icon="ArrowLeft"
      @click="router.push('/settings')"
    />
    <EmployeeDirectorySettingsView />
  </section>

  <section v-else-if="showDatabaseMaintenance" class="space-y-4">
    <DhButton
      :label="t('settings.backToSettings')"
      variant="secondary"
      :icon="ArrowLeft"
      @click="router.push('/settings')"
    />
    <DatabaseMaintenanceView />
  </section>

  <section v-else-if="showEnvironmentRecovery" class="space-y-4">
    <DhButton
      :label="t('settings.backToSettings')"
      variant="secondary"
      :icon="ArrowLeft"
      @click="router.push('/settings')"
    />
    <EnvironmentRecoveryView />
  </section>

  <section v-else class="space-y-4 sm:space-y-6">
    <DhPageHeader :title="t('settings.title')" :subtitle="t('settings.subtitle')" :icon="Settings" />

    <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      <DhCard
        v-for="card in cards"
        :key="card.path"
        as="button"
        :interactive="true"
        :title="card.title"
        :subtitle="card.description"
        :icon="card.icon"
        @click="router.push(card.path)"
      />
    </div>
  </section>
</template>
