<script setup lang="ts">
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import type { AgentExtractionRouteDto } from '@/core/interfaces/agent'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'

defineProps<{
  rows: AgentExtractionRouteDto[]
  loading?: boolean
  canManage?: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [route: AgentExtractionRouteDto]
  delete: [route: AgentExtractionRouteDto]
}>()

const columns: DhTableColumn<AgentExtractionRouteDto>[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'polName', label: 'POL' },
  { key: 'poeName', label: 'POE' },
  { key: 'podName', label: 'POD' },
  { key: 'isActive', label: 'Activo', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]
</script>

<template>
  <section class="grid gap-4">
    <div v-if="canManage" class="flex justify-end">
      <DhButton label="Agregar ruta" :icon="Plus" @click="emit('create')" />
    </div>

    <DhDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="No hay rutas configuradas."
    >
      <template #cell-name="{ row }">{{ row.name || '—' }}</template>
      <template #cell-poeName="{ row }">{{ row.poeName || '—' }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-actions="{ row }">
        <div v-if="canManage" class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton label="Editar" :icon="Pencil" variant="secondary" size="sm" @click="emit('edit', row)" />
          <DhButton label="Eliminar" :icon="Trash2" variant="danger" size="sm" @click="emit('delete', row)" />
        </div>
      </template>
    </DhDataTable>
  </section>
</template>
