<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import type { AgentEndpointCaptureDto } from '@/core/interfaces/agent'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'

const props = defineProps<{
  rows: AgentEndpointCaptureDto[]
  loading?: boolean
  canManage?: boolean
}>()

const emit = defineEmits<{
  create: []
  edit: [capture: AgentEndpointCaptureDto]
  delete: [capture: AgentEndpointCaptureDto]
}>()

type CaptureRow = AgentEndpointCaptureDto & Record<string, unknown>

const captureRows = computed<CaptureRow[]>(() => props.rows.map((row) => ({ ...row })))

const columns: DhTableColumn<CaptureRow>[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'httpMethod', label: 'Method' },
  { key: 'urlPattern', label: 'Pattern' },
  { key: 'matchType', label: 'Match Type' },
  { key: 'captureRequest', label: 'Request', align: 'center' },
  { key: 'captureResponse', label: 'Response', align: 'center' },
  { key: 'isRequired', label: 'Required', align: 'center' },
  { key: 'timeoutSeconds', label: 'Timeout', align: 'right' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]
</script>

<template>
  <section class="grid gap-4">
    <div v-if="canManage" class="flex justify-end">
      <DhButton label="Agregar endpoint" :icon="Plus" @click="emit('create')" />
    </div>

    <div class="overflow-x-auto">
      <DhDataTable
        :columns="columns"
        :rows="captureRows"
        :loading="loading"
        empty-text="No hay reglas de captura configuradas."
      >
        <template #cell-captureRequest="{ row }">{{ row.captureRequest ? 'Sí' : 'No' }}</template>
        <template #cell-captureResponse="{ row }">{{ row.captureResponse ? 'Sí' : 'No' }}</template>
        <template #cell-isRequired="{ row }">{{ row.isRequired ? 'Sí' : 'No' }}</template>
        <template #cell-timeoutSeconds="{ row }">{{ row.timeoutSeconds }} s</template>
        <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>

        <template #cell-actions="{ row }">
          <div v-if="canManage" class="flex flex-wrap justify-end gap-2" @click.stop>
            <DhButton
              label="Editar / probar"
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
