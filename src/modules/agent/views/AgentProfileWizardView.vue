<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Settings2 } from 'lucide-vue-next'
import { DhEmptyState } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

const route = useRoute()
const editing = computed(() => Boolean(route.params.id))
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      :title="editing ? 'Editar perfil de extracción' : 'Nuevo perfil de extracción'"
      subtitle="El asistente se habilitará por etapas conforme estén disponibles los contratos reales del backend."
      :icon="Settings2"
    />

    <DhEmptyState
      title="Asistente preparado"
      description="Feature blocked by backend contract: falta el endpoint real para crear y actualizar AgentExtractionProfile."
      :icon="Settings2"
    />
  </section>
</template>
