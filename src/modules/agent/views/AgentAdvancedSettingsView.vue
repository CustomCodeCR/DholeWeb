<script setup lang="ts">
import { CalendarClock, ChevronRight, FileCode2, Globe2, KeyRound, Settings, Ship } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'

const router = useRouter()
const permissions = useAgentPermissions()

const sections = [
  {
    title: 'Navieras y providers',
    description: 'Configuración técnica de providers disponibles para Agent.',
    icon: Ship,
    path: '/agents/providers',
    visible: permissions.canViewProviders,
  },
  {
    title: 'Definiciones',
    description: 'Acciones y estrategias técnicas del runtime.',
    icon: FileCode2,
    path: '/agents/definitions',
    visible: permissions.canViewDefinitions,
  },
  {
    title: 'Credenciales',
    description: 'Administración global de accesos mientras se completa el wizard por perfil.',
    icon: KeyRound,
    path: '/agents/credentials',
    visible: permissions.canViewCredentials,
  },
  {
    title: 'Operación Maersk',
    description: 'Circuit breaker, colas, perfiles e incidentes de Hermes.',
    icon: Globe2,
    path: '/agents/maersk',
    visible: permissions.canViewMaerskOperations,
  },
  {
    title: 'Sesiones web',
    description: 'Browser profiles y estado de autenticación.',
    icon: Globe2,
    path: '/agents/browser-profiles',
    visible: permissions.canViewBrowserProfiles,
  },
  {
    title: 'Programaciones técnicas',
    description: 'Vista heredada de schedules durante la migración a perfiles.',
    icon: CalendarClock,
    path: '/agents/schedules',
    visible: permissions.canViewSchedules,
  },
]
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Configuración avanzada"
      subtitle="Herramientas técnicas de Agent. La operación diaria debe realizarse desde Perfiles de extracción."
      :icon="Settings"
    />

    <div class="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DhCard
        v-for="section in sections.filter((item) => item.visible.value)"
        :key="section.path"
        as="button"
        :title="section.title"
        :subtitle="section.description"
        :icon="section.icon"
        interactive
        padding="sm"
        class="group w-full"
        @click="router.push(section.path)"
      >
        <template #actions>
          <span
            class="inline-flex h-10 items-center gap-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 text-xs font-black text-[var(--dh-text-soft)] transition group-hover:border-[var(--dh-primary)]/40 group-hover:text-[var(--dh-primary)]"
          >
            <span class="hidden sm:inline">Abrir</span>
            <ChevronRight class="h-4 w-4" />
          </span>
        </template>
      </DhCard>
    </div>
  </section>
</template>
