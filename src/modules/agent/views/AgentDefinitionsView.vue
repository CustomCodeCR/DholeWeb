<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FileCode2, Pencil, Plus, Power, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import {
  AGENT_ACTION_TYPES,
  AGENT_EXECUTION_STRATEGIES,
  type AgentActionType,
  type AgentDefinitionDto,
  type AgentExecutionStrategy,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const route = useRoute()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()

const modalOpen = ref(false)
const confirmOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const pendingToggle = ref<AgentDefinitionDto | null>(null)
const providerFilter = ref(typeof route.query.providerId === 'string' ? route.query.providerId : '')

const form = reactive({
  providerId: '',
  code: '',
  name: '',
  description: '',
  actionType: 'SearchOceanRates' as AgentActionType,
  executionStrategy: 'Hermes' as AgentExecutionStrategy,
  configurationJson: '',
})

const columns: DhTableColumn<AgentDefinitionDto>[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Código' },
  { key: 'providerId', label: 'Provider' },
  { key: 'actionType', label: 'Action Type' },
  { key: 'executionStrategy', label: 'Execution Strategy' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

const providerOptions = computed(() => [
  ...store.providers.map((provider) => ({ value: provider.id, label: `${provider.name} · ${provider.code}` })),
])
const providerFilterOptions = computed(() => [
  { value: '', label: 'Todos los providers' },
  ...providerOptions.value,
])
const actionTypeOptions = AGENT_ACTION_TYPES.map((value) => ({ value, label: value }))
const strategyOptions = AGENT_EXECUTION_STRATEGIES.map((value) => ({ value, label: value }))
const filteredDefinitions = computed(() =>
  providerFilter.value
    ? store.definitions.filter((definition) => definition.providerId === providerFilter.value)
    : store.definitions,
)

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function resetForm() {
  editingId.value = null
  form.providerId = providerFilter.value || store.activeProviders[0]?.id || ''
  form.code = ''
  form.name = ''
  form.description = ''
  form.actionType = 'SearchOceanRates'
  form.executionStrategy = 'Hermes'
  form.configurationJson = ''
}

function validateConfiguration() {
  const value = form.configurationJson.trim()
  if (!value) return null
  try {
    JSON.parse(value)
    return value
  } catch {
    throw new Error('ConfigurationJson debe contener JSON válido.')
  }
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

async function openEdit(row: AgentDefinitionDto) {
  try {
    const definition = await AgentService.getDefinition(row.id)
    editingId.value = definition.id
    form.providerId = definition.providerId
    form.code = definition.code
    form.name = definition.name
    form.description = definition.description ?? ''
    form.actionType = definition.actionType
    form.executionStrategy = definition.executionStrategy
    form.configurationJson = definition.configurationJson ?? ''
    modalOpen.value = true
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la definición.')
  }
}

async function save() {
  if (saving.value) return
  try {
    if (!form.providerId) throw new Error('Provider es obligatorio.')
    if (!form.code.trim()) throw new Error('Code es obligatorio.')
    if (!form.name.trim()) throw new Error('Name es obligatorio.')
    if (!form.actionType) throw new Error('Action Type es obligatorio.')
    if (!form.executionStrategy) throw new Error('Execution Strategy es obligatorio.')

    const configurationJson = validateConfiguration()
    saving.value = true

    if (editingId.value) {
      await AgentService.updateDefinition(editingId.value, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        actionType: form.actionType,
        executionStrategy: form.executionStrategy,
        configurationJson,
      })
      toastStore.success('Definición actualizada')
    } else {
      await AgentService.createDefinition({
        providerId: form.providerId,
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        actionType: form.actionType,
        executionStrategy: form.executionStrategy,
        configurationJson,
      })
      toastStore.success('Definición creada')
    }

    modalOpen.value = false
    await store.loadDefinitions()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) toastStore.warning('Revise la definición', error.message)
    else toastStore.backendError(error, 'No se pudo guardar la definición.')
  } finally {
    saving.value = false
  }
}

function askToggle(row: AgentDefinitionDto) {
  pendingToggle.value = row
  confirmOpen.value = true
}

async function confirmToggle() {
  const row = pendingToggle.value
  if (!row) return
  await AgentService.setDefinitionActive(row.id, !row.isActive)
  toastStore.success(row.isActive ? 'Definición desactivada' : 'Definición activada')
  confirmOpen.value = false
  pendingToggle.value = null
  await store.loadDefinitions()
}

async function refresh() {
  try {
    await Promise.all([store.loadProviders(), store.loadDefinitions()])
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las definiciones.')
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader title="Definiciones" subtitle="Acciones y configuración de cada provider." :icon="FileCode2">
      <template #actions>
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="store.loading" @click="refresh" />
        <DhButton v-if="permissions.canManageDefinitions.value" label="Crear" :icon="Plus" @click="openCreate" />
      </template>
    </DhPageHeader>

    <div class="max-w-md">
      <DhSelect v-model="providerFilter" label="Provider" :options="providerFilterOptions" placeholder="" />
    </div>

    <DhDataTable :columns="columns" :rows="filteredDefinitions" :loading="store.loading" empty-text="No hay definiciones disponibles.">
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton v-if="permissions.canManageDefinitions.value" label="Editar" :icon="Pencil" variant="secondary" size="sm" @click="openEdit(row)" />
          <DhButton
            v-if="permissions.canManageDefinitions.value"
            :label="row.isActive ? 'Desactivar' : 'Activar'"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="editingId ? 'Editar definición' : 'Nueva definición'" size="lg" @close="modalOpen = false">
      <form class="grid gap-4" @submit.prevent="save">
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="form.providerId" label="Provider" :options="providerOptions" :disabled="saving || Boolean(editingId)" />
          <DhInput v-model="form.code" label="Code" :disabled="saving || Boolean(editingId)" />
          <DhInput v-model="form.name" label="Name" :disabled="saving" />
          <DhSelect v-model="form.actionType" label="Action Type" :options="actionTypeOptions" :disabled="saving" />
          <DhSelect v-model="form.executionStrategy" label="Execution Strategy" :options="strategyOptions" :disabled="saving" />
        </div>
        <DhTextarea v-model="form.description" label="Description" :rows="3" :disabled="saving" />
        <DhTextarea v-model="form.configurationJson" label="ConfigurationJson" :rows="8" :disabled="saving" placeholder="{ }" />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton type="submit" :label="editingId ? 'Guardar cambios' : 'Crear definición'" :loading="saving" />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" title="Confirmar cambio de estado" size="sm" @close="confirmOpen = false">
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? 'Desactivar definición' : 'Activar definición'"
        :message="`¿Desea ${pendingToggle.isActive ? 'desactivar' : 'activar'} ${pendingToggle.name}?`"
        :danger="pendingToggle.isActive"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>
