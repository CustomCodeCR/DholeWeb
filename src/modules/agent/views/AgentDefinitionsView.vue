<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()
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
  { key: 'name', label: t('agent.fields.name') },
  { key: 'code', label: t('agent.fields.code') },
  { key: 'providerId', label: t('agent.fields.provider') },
  { key: 'actionType', label: t('agent.fields.actionType') },
  { key: 'executionStrategy', label: t('agent.fields.executionStrategy') },
  { key: 'isActive', label: t('agent.fields.status'), align: 'center' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const providerOptions = computed(() => [
  ...store.providers.map((provider) => ({ value: provider.id, label: `${provider.name} · ${provider.code}` })),
])
const providerFilterOptions = computed(() => [
  { value: '', label: t('agent.definitions.allProviders') },
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
    throw new Error(t('agent.validation.validJson', { field: t('agent.fields.configurationJson') }))
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
    toastStore.backendError(error, t('agent.errors.loadDefinition'))
  }
}

async function save() {
  if (saving.value) return
  try {
    if (!form.providerId) throw new Error(t('agent.validation.required', { field: t('agent.fields.provider') }))
    if (!form.code.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.code') }))
    if (!form.name.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.name') }))
    if (!form.actionType) throw new Error(t('agent.validation.required', { field: t('agent.fields.actionType') }))
    if (!form.executionStrategy) throw new Error(t('agent.validation.required', { field: t('agent.fields.executionStrategy') }))

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
      toastStore.success(t('agent.messages.definitionUpdated'))
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
      toastStore.success(t('agent.messages.definitionCreated'))
    }

    modalOpen.value = false
    await store.loadDefinitions()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) toastStore.warning(t('agent.review.definition'), error.message)
    else toastStore.backendError(error, t('agent.errors.saveDefinition'))
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
  toastStore.success(t('agent.messages.stateUpdated'))
  confirmOpen.value = false
  pendingToggle.value = null
  await store.loadDefinitions()
}

async function refresh() {
  try {
    await Promise.all([store.loadProviders(), store.loadDefinitions()])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadDefinitions'))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader :title="t('agent.definitions.title')" :subtitle="t('agent.definitions.subtitle')" :icon="FileCode2">
      <template #actions>
        <DhButton :label="t('agent.actions.refresh')" :icon="RefreshCw" variant="secondary" :loading="store.loading" @click="refresh" />
        <DhButton v-if="permissions.canManageDefinitions.value" :label="t('agent.actions.create')" :icon="Plus" @click="openCreate" />
      </template>
    </DhPageHeader>

    <div class="max-w-md">
      <DhSelect v-model="providerFilter" :label="t('agent.fields.provider')" :options="providerFilterOptions" placeholder="" />
    </div>

    <DhDataTable :columns="columns" :rows="filteredDefinitions" :loading="store.loading" :empty-text="t('agent.definitions.empty')">
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton v-if="permissions.canManageDefinitions.value" :label="t('agent.actions.edit')" :icon="Pencil" variant="secondary" size="sm" @click="openEdit(row)" />
          <DhButton
            v-if="permissions.canManageDefinitions.value"
            :label="row.isActive ? t('agent.actions.deactivate') : t('agent.actions.activate')"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="editingId ? t('agent.definitions.editTitle') : t('agent.definitions.createTitle')" size="lg" @close="modalOpen = false">
      <form class="grid gap-4" @submit.prevent="save">
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="form.providerId" :label="t('agent.fields.provider')" :options="providerOptions" :disabled="saving || Boolean(editingId)" />
          <DhInput v-model="form.code" :label="t('agent.fields.code')" :disabled="saving || Boolean(editingId)" />
          <DhInput v-model="form.name" :label="t('agent.fields.name')" :disabled="saving" />
          <DhSelect v-model="form.actionType" :label="t('agent.fields.actionType')" :options="actionTypeOptions" :disabled="saving" />
          <DhSelect v-model="form.executionStrategy" :label="t('agent.fields.executionStrategy')" :options="strategyOptions" :disabled="saving" />
        </div>
        <DhTextarea v-model="form.description" :label="t('agent.fields.description')" :rows="3" :disabled="saving" />
        <DhTextarea v-model="form.configurationJson" :label="t('agent.fields.configurationJson')" :rows="8" :disabled="saving" placeholder="{ }" />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton :label="t('agent.actions.cancel')" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton type="submit" :label="editingId ? t('agent.actions.saveChanges') : t('agent.definitions.createTitle')" :loading="saving" />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" :title="t('agent.providers.confirmState')" size="sm" @close="confirmOpen = false">
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? t('agent.confirm.deactivateTitle', { entity: t('agent.entities.definition') }) : t('agent.confirm.activateTitle', { entity: t('agent.entities.definition') })"
        :message="pendingToggle.isActive ? t('agent.confirm.deactivateQuestion', { name: pendingToggle.name }) : t('agent.confirm.activateQuestion', { name: pendingToggle.name })"
        :danger="pendingToggle.isActive"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>
