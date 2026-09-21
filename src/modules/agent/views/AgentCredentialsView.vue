<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyRound, Pencil, Plus, Power, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import type { AgentCredentialDto } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentStatusBadge from '@/modules/agent/components/AgentStatusBadge.vue'
import AgentCredentialForm from '@/modules/agent/components/credentials/AgentCredentialForm.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const { t } = useI18n()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()
const { formatDate } = useAgentFormatting()

const modalOpen = ref(false)
const confirmOpen = ref(false)
const editingCredential = ref<AgentCredentialDto | null>(null)
const pendingToggle = ref<AgentCredentialDto | null>(null)
const verifyingId = ref<string | null>(null)

const columns: DhTableColumn<AgentCredentialDto>[] = [
  { key: 'name', label: t('agent.fields.name') },
  { key: 'providerId', label: t('agent.fields.provider') },
  { key: 'usernameMasked', label: t('agent.fields.username') },
  { key: 'hasPassword', label: t('agent.fields.password'), align: 'center' },
  { key: 'isActive', label: t('agent.fields.status'), align: 'center' },
  { key: 'createdAtUtc', label: t('agent.fields.created') },
  { key: 'updatedAtUtc', label: t('agent.fields.updatedAt') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const providersForForm = computed(() => store.providers)

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function openCreate() {
  editingCredential.value = null
  modalOpen.value = true
}

function openEdit(row: AgentCredentialDto) {
  editingCredential.value = row
  modalOpen.value = true
}

async function handleSaved() {
  modalOpen.value = false
  editingCredential.value = null
  await store.loadCredentials()
}

function askToggle(row: AgentCredentialDto) {
  pendingToggle.value = row
  confirmOpen.value = true
}

async function confirmToggle() {
  const row = pendingToggle.value
  if (!row) return

  try {
    await AgentService.credentials.setActive(row.id, !row.isActive)
    toastStore.success(t('agent.messages.stateUpdated'))
    confirmOpen.value = false
    pendingToggle.value = null
    await store.loadCredentials()
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.saveCredential'))
  }
}

async function verifyCredential(row: AgentCredentialDto) {
  if (verifyingId.value) return

  try {
    verifyingId.value = row.id
    await AgentService.credentials.verify(row.id)
    toastStore.success(t('agent.credentials.verified'))
  } catch (error) {
    toastStore.backendError(error, t('agent.credentials.verifyError'))
  } finally {
    verifyingId.value = null
  }
}

async function refresh() {
  try {
    await Promise.all([store.loadProviders(), store.loadCredentials()])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadCredentials'))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      :title="t('agent.credentials.title')"
      :subtitle="t('agent.credentials.subtitle')"
      :icon="KeyRound"
    >
      <template #actions>
        <DhButton
          :label="t('agent.actions.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="store.loading"
          @click="refresh"
        />
        <DhButton
          v-if="permissions.canManageCredentials.value"
          :label="t('agent.actions.create')"
          :icon="Plus"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <DhDataTable
      :columns="columns"
      :rows="store.credentials"
      :loading="store.loading"
      :empty-text="t('agent.credentials.empty')"
    >
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-usernameMasked="{ row }">{{ row.usernameMasked || '—' }}</template>
      <template #cell-hasPassword="{ row }">
        {{ row.hasPassword ? t('common.yes') : t('common.no') }}
      </template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-createdAtUtc="{ row }">{{ formatDate(row.createdAtUtc) }}</template>
      <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton
            v-if="permissions.canVerifyCredentials.value"
            :label="t('agent.credentials.verify')"
            :icon="ShieldCheck"
            variant="ghost"
            size="sm"
            :loading="verifyingId === row.id"
            @click="verifyCredential(row)"
          />
          <DhButton
            v-if="permissions.canManageCredentials.value"
            :label="t('agent.actions.edit')"
            :icon="Pencil"
            variant="secondary"
            size="sm"
            @click="openEdit(row)"
          />
          <DhButton
            v-if="permissions.canManageCredentials.value"
            :label="row.isActive ? t('agent.actions.deactivate') : t('agent.actions.activate')"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal
      :open="modalOpen"
      :title="editingCredential ? t('agent.credentials.editTitle') : t('agent.credentials.createTitle')"
      size="lg"
      @close="modalOpen = false"
    >
      <AgentCredentialForm
        :providers="providersForForm"
        :credential="editingCredential"
        @saved="handleSaved"
        @cancel="modalOpen = false"
      />
    </DhModal>

    <DhModal
      :open="confirmOpen"
      :title="t('agent.providers.confirmState')"
      size="sm"
      @close="confirmOpen = false"
    >
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? t('agent.confirm.deactivateTitle', { entity: t('agent.entities.credential') }) : t('agent.confirm.activateTitle', { entity: t('agent.entities.credential') })"
        :message="pendingToggle.isActive ? t('agent.confirm.deactivateQuestion', { name: pendingToggle.name }) : t('agent.confirm.activateQuestion', { name: pendingToggle.name })"
        :danger="pendingToggle.isActive"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>
