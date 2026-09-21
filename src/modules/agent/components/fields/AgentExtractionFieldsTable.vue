<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import type { AgentExtractionFieldDto } from '@/core/interfaces/agent'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'

const props = defineProps<{
  rows: AgentExtractionFieldDto[]
  loading?: boolean
  canManage?: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [field: AgentExtractionFieldDto]
  delete: [field: AgentExtractionFieldDto]
}>()

type FieldRow = AgentExtractionFieldDto & Record<string, unknown>

const fieldRows = computed<FieldRow[]>(() => props.rows.map((row) => ({ ...row })))

const columns: DhTableColumn<FieldRow>[] = [
  { key: 'key', label: 'Key' },
  { key: 'label', label: 'Nombre' },
  { key: 'dataType', label: 'Tipo' },
  { key: 'sourceType', label: 'Origen' },
  { key: 'required', label: 'Required', align: 'center' },
  { key: 'jsonPath', label: 'JsonPath' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]
</script>

<template>
  <section class="grid gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-[var(--dh-text-muted)]">
        Defina únicamente los datos que realmente necesita conservar de cada extracción.
      </p>

      <DhButton
        v-if="canManage"
        label="Agregar campo"
        :icon="Plus"
        @click="emit('create')"
      />
    </div>

    <div class="overflow-x-auto">
      <DhDataTable
        :columns="columns"
        :rows="fieldRows"
        :loading="loading"
        empty-text="No hay campos de extracción configurados."
      >
        <template #cell-required="{ row }">{{ row.required ? 'Sí' : 'No' }}</template>
        <template #cell-jsonPath="{ row }">{{ row.jsonPath || '—' }}</template>
        <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>

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
