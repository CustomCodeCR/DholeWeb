<script setup lang="ts">
import { CalendarClock, FileCode2, Globe2, KeyRound, Settings, Ship } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { DhButton } from '@/shared/components/atoms'
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

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DhCard
        v-for="section in sections.filter((item) => item.visible.value)"
        :key="section.path"
        :title="section.title"
        :subtitle="section.description"
        :icon="section.icon"
      >
        <DhButton
          label="Abrir"
          variant="secondary"
          class="mt-2"
          @click="router.push(section.path)"
        />
      </DhCard>
    </div>
  </section>
</template>
