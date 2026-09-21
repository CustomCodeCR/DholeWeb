<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Pencil, Plus, Power, RefreshCw, Ship } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import {
  AGENT_EXECUTION_STRATEGIES,
  AGENT_PROVIDER_TYPES,
  type AgentExecutionStrategy,
  type AgentProviderDto,
  type AgentProviderType,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentProviderBadge from '@/modules/agent/components/AgentProviderBadge.vue'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const router = useRouter()
const { t } = useI18n()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()
const { formatDate } = useAgentFormatting()

const modalOpen = ref(false)
const confirmOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const pendingToggle = ref<AgentProviderDto | null>(null)

const form = reactive({
  code: '',
  name: '',
  providerType: 'GenericWeb' as AgentProviderType,
  baseUrl: '',
  defaultExecutionStrategy: 'Hermes' as AgentExecutionStrategy,
  metadataJson: '',
  isSystem: false,
})

const columns: DhTableColumn<AgentProviderDto>[] = [
  { key: 'name', label: t('agent.fields.name') },
  { key: 'code', label: t('agent.fields.code') },
  { key: 'providerType', label: t('agent.fields.providerType') },
  { key: 'baseUrl', label: t('agent.fields.baseUrl') },
  { key: 'defaultExecutionStrategy', label: t('agent.fields.strategy') },
  { key: 'isActive', label: t('agent.fields.status'), align: 'center' },
  { key: 'isSystem', label: t('agent.fields.system'), align: 'center' },
  { key: 'updatedAtUtc', label: t('agent.fields.updated'), },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const providerTypeOptions = AGENT_PROVIDER_TYPES.map((value) => ({
  value,
  label:
    value === 'Msc'
      ? 'MSC'
      : value === 'Pil'
        ? 'PIL'
        : value === 'CmaCgm'
          ? 'CMA CGM'
          : value === 'HapagLloyd'
            ? 'Hapag-Lloyd'
            : value === 'GenericWeb'
              ? t('agent.providers.genericWeb')
              : value,
}))

const strategyOptions = AGENT_EXECUTION_STRATEGIES.map((value) => ({ value, label: value }))

const title = computed(() => (editingId.value ? t('agent.providers.editTitle') : t('agent.providers.createTitle')))

function resetForm() {
  editingId.value = null
  form.code = ''
  form.name = ''
  form.providerType = 'GenericWeb'
  form.baseUrl = ''
  form.defaultExecutionStrategy = 'Hermes'
  form.metadataJson = ''
  form.isSystem = false
}

function validateJson(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    throw new Error(t('agent.validation.validJson', { field: label }))
  }
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

async function openEdit(row: AgentProviderDto) {
  try {
    const provider = await AgentService.getProvider(row.id)
    editingId.value = provider.id
    form.code = provider.code
    form.name = provider.name
    form.providerType = provider.providerType
    form.baseUrl = provider.baseUrl ?? ''
    form.defaultExecutionStrategy = provider.defaultExecutionStrategy
    form.metadataJson = provider.metadataJson ?? ''
    form.isSystem = provider.isSystem
    modalOpen.value = true
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadProvider'))
  }
}

async function save() {
  if (saving.value) return

  try {
    if (!form.code.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.code') }))
    if (!form.name.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.name') }))
    if (!form.providerType) throw new Error(t('agent.validation.required', { field: t('agent.fields.providerType') }))
    if (!form.defaultExecutionStrategy) throw new Error(t('agent.validation.required', { field: t('agent.fields.executionStrategy') }))

    const metadataJson = validateJson(form.metadataJson, 'MetadataJson')
    saving.value = true

    if (editingId.value) {
      await AgentService.updateProvider(editingId.value, {
        name: form.name.trim(),
        providerType: form.providerType,
        baseUrl: form.baseUrl.trim() || null,
        defaultExecutionStrategy: form.defaultExecutionStrategy,
        metadataJson,
      })
      toastStore.success(t('agent.messages.providerUpdated'))
    } else {
      await AgentService.createProvider({
        code: form.code.trim(),
        name: form.name.trim(),
        providerType: form.providerType,
        baseUrl: form.baseUrl.trim() || null,
        defaultExecutionStrategy: form.defaultExecutionStrategy,
        metadataJson,
        isSystem: form.isSystem,
      })
      toastStore.success(t('agent.messages.providerCreated'))
    }

    modalOpen.value = false
    await store.loadProviders()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning(t('agent.review.provider'), error.message)
    } else {
      toastStore.backendError(error, t('agent.errors.saveProvider'))
    }
  } finally {
    saving.value = false
  }
}

function askToggle(row: AgentProviderDto) {
  pendingToggle.value = row
  confirmOpen.value = true
}

async function confirmToggle() {
  const row = pendingToggle.value
  if (!row) return

  await AgentService.setProviderActive(row.id, !row.isActive)
  toastStore.success(t('agent.messages.stateUpdated'))
  confirmOpen.value = false
  pendingToggle.value = null
  await store.loadProviders()
}

onMounted(async () => {
  try {
    await store.loadProviders()
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadProviders'))
  }
})
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader :title="t('agent.providers.title')" :subtitle="t('agent.providers.subtitle')" :icon="Ship">
      <template #actions>
        <DhButton :label="t('agent.actions.refresh')" :icon="RefreshCw" variant="secondary" :loading="store.loading" @click="store.loadProviders()" />
        <DhButton v-if="permissions.canManageProviders.value" :label="t('agent.actions.create')" :icon="Plus" @click="openCreate" />
      </template>
    </DhPageHeader>

    <DhDataTable :columns="columns" :rows="store.providers" :loading="store.loading" :empty-text="t('agent.providers.empty')">
      <template #cell-providerType="{ row }"><AgentProviderBadge :provider-type="row.providerType" /></template>
      <template #cell-baseUrl="{ row }"><span class="break-all">{{ row.baseUrl || '—' }}</span></template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-isSystem="{ row }">{{ row.isSystem ? t('common.yes') : t('common.no') }}</template>
      <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc ?? row.createdAtUtc) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton :label="t('agent.providers.definitions')" variant="ghost" size="sm" @click="router.push({ path: '/agents/definitions', query: { providerId: row.id } })" />
          <DhButton v-if="permissions.canManageProviders.value" :label="t('agent.actions.edit')" :icon="Pencil" variant="secondary" size="sm" @click="openEdit(row)" />
          <DhButton
            v-if="permissions.canManageProviders.value"
            :label="row.isActive ? t('agent.actions.deactivate') : t('agent.actions.activate')"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="title" size="lg" @close="modalOpen = false">
      <form class="grid gap-4" @submit.prevent="save">
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="form.code" :label="t('agent.fields.code')" :disabled="saving || Boolean(editingId)" />
          <DhInput v-model="form.name" :label="t('agent.fields.name')" :disabled="saving" />
          <DhSelect v-model="form.providerType" :label="t('agent.fields.providerType')" :options="providerTypeOptions" :disabled="saving" />
          <DhSelect v-model="form.defaultExecutionStrategy" :label="t('agent.fields.executionStrategy')" :options="strategyOptions" :disabled="saving" />
          <div class="md:col-span-2">
            <DhInput v-model="form.baseUrl" :label="t('agent.fields.baseUrl')" placeholder="https://..." :disabled="saving" />
          </div>
        </div>
        <DhTextarea v-model="form.metadataJson" :label="t('agent.fields.metadataJson')" :rows="6" :disabled="saving" placeholder="{ }" />
        <DhSwitch v-if="!editingId" v-model="form.isSystem" :label="t('agent.providers.systemProvider')" :description="t('agent.providers.systemProviderDescription')" :disabled="saving" />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton :label="t('agent.actions.cancel')" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton type="submit" :label="editingId ? t('agent.actions.saveChanges') : t('agent.providers.createTitle')" :loading="saving" />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" :title="t('agent.providers.confirmState')" size="sm" @close="confirmOpen = false">
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? t('agent.confirm.deactivateTitle', { entity: t('agent.entities.provider') }) : t('agent.confirm.activateTitle', { entity: t('agent.entities.provider') })"
        :message="pendingToggle.isActive ? t('agent.confirm.deactivateQuestion', { name: pendingToggle.name }) : t('agent.confirm.activateQuestion', { name: pendingToggle.name })"
        :danger="pendingToggle.isActive"
        :confirm-label="pendingToggle.isActive ? t('agent.actions.deactivate') : t('agent.actions.activate')"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>
