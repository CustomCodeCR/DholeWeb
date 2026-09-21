<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { DhEmptyState } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Perfiles de extracción"
      subtitle="Configure qué navieras, rutas, equipos y datos debe extraer Dhole Agent."
      :icon="Bot"
    />

    <DhEmptyState
      title="Los perfiles están en preparación"
      description="Feature blocked by backend contract: DholeAgentService todavía no expone el CRUD REST principal de AgentExtractionProfile."
      :icon="Bot"
    />
  </section>
</template>
