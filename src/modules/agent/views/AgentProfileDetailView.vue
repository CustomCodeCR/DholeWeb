<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { DhEmptyState } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Perfil de extracción"
      subtitle="Resumen, rutas, equipos, endpoints, campos, Hermes, programación y ejecuciones."
      :icon="Bot"
    />

    <DhEmptyState
      title="Detalle pendiente del contrato principal"
      description="Feature blocked by backend contract: falta GET /api/agents/extraction-profiles/{id}."
      :icon="Bot"
    />
  </section>
</template>
