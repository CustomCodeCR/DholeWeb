<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import type { AgentExtractionEquipmentDto } from '@/core/interfaces/agent'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'

const props = defineProps<{
  rows: AgentExtractionEquipmentDto[]
  loading?: boolean
  canManage?: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [equipment: AgentExtractionEquipmentDto]
  delete: [equipment: AgentExtractionEquipmentDto]
}>()

type EquipmentRow = AgentExtractionEquipmentDto & Record<string, unknown>

const equipmentRows = computed<EquipmentRow[]>(() => props.rows.map((row) => ({ ...row })))

const columns: DhTableColumn<EquipmentRow>[] = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Nombre' },
  { key: 'quantity', label: 'Cantidad', align: 'center' },
  { key: 'defaultWeightKg', label: 'Peso por defecto', align: 'right' },
  { key: 'isActive', label: 'Activo', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]
</script>

<template>
  <section class="grid gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-[var(--dh-text-muted)]">
        {{ rows.length }} equipo{{ rows.length === 1 ? '' : 's' }} configurado{{ rows.length === 1 ? '' : 's' }}
      </p>

      <DhButton
        v-if="canManage"
        label="Agregar equipo"
        :icon="Plus"
        @click="emit('create')"
      />
    </div>

    <div class="overflow-x-auto">
      <DhDataTable
        :columns="columns"
        :rows="equipmentRows"
        :loading="loading"
        empty-text="No hay equipos configurados."
      >
        <template #cell-defaultWeightKg="{ row }">
          {{ Number(row.defaultWeightKg).toLocaleString() }} kg
        </template>

        <template #cell-isActive="{ row }">
          <AgentStatusBadge :active="row.isActive" />
        </template>

        <template #cell-actions="{ row }">
          <div v-if="canManage" class="flex flex-wrap justify-end gap-2" @click.stop>
            <DhButton
              label="Editar"
              :icon="Pencil"
              variant="secondary"
              size="sm"
              @click="emit('edit', row)"
            />
            <DhButton
              label="Eliminar"
              :icon="Trash2"
              variant="danger"
              size="sm"
              @click="emit('delete', row)"
            />
          </div>
        </template>
      </DhDataTable>
    </div>
  </section>
</template>
