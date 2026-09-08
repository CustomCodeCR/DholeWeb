<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ContactRound, DatabaseZap, Keyboard, Palette, RotateCcwKey, Settings } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { DhButton } from '@/shared/components/atoms'
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
      description: 'Tema, idioma y branding por cliente.',
      icon: Palette,
      path: '/settings/appearance',
    },
    {
      title: 'Directorio de extensiones',
      description: 'Empleados, departamentos, extensiones, correos y celulares.',
      icon: ContactRound,
      path: '/settings?section=extensions',
    },
    {
      title: t('settings.shortcuts'),
      description: 'Atajos configurables en el navegador.',
      icon: Keyboard,
      path: '/settings/shortcuts',
    },
  ]

  if (isSuperUser.value) {
    items.push(
      {
        title: 'Mantenimiento de bases de datos',
        description: 'Vaciar tablas o bases de datos de forma controlada en el ambiente actual.',
        icon: DatabaseZap,
        path: '/settings?section=database-maintenance',
      },
      {
        title: 'Regenerar datos del ambiente',
        description: 'Volver a crear datos iniciales desde el .env actual de producción o staging.',
        icon: RotateCcwKey,
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
      label="Volver a Configuración"
      variant="secondary"
      :icon="ArrowLeft"
      @click="router.push('/settings')"
    />
    <EmployeeDirectorySettingsView />
  </section>

  <section v-else-if="showDatabaseMaintenance" class="space-y-4">
    <DhButton
      label="Volver a Configuración"
      variant="secondary"
      :icon="ArrowLeft"
      @click="router.push('/settings')"
    />
    <DatabaseMaintenanceView />
  </section>

  <section v-else-if="showEnvironmentRecovery" class="space-y-4">
    <DhButton
      label="Volver a Configuración"
      variant="secondary"
      :icon="ArrowLeft"
      @click="router.push('/settings')"
    />
    <EnvironmentRecoveryView />
  </section>

  <section v-else class="space-y-6">
    <DhPageHeader :title="t('settings.title')" :subtitle="t('settings.subtitle')" :icon="Settings" />
    <div class="grid gap-4 md:grid-cols-2">
      <button
        v-for="card in cards"
        :key="card.path"
        class="dh-glass dh-liquid dh-card-hover rounded-[32px] p-6 text-left"
        @click="router.push(card.path)"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-[22px] dh-bg-primary-soft text-[var(--dh-primary)]"
          >
            <component :is="card.icon" class="h-6 w-6" />
          </div>
          <div>
            <h3 class="text-lg font-black text-[var(--dh-text)]">{{ card.title }}</h3>
            <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ card.description }}</p>
          </div>
        </div>
      </button>
    </div>
  </section>
</template>
