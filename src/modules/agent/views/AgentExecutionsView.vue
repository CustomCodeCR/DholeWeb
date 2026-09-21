<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Ban, Eye, History, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import {
  AGENT_EXECUTION_STATUSES,
  type AgentExecutionDto,
  type AgentExecutionStatus,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentExecutionStatusBadge from '@/modules/agent/components/AgentExecutionStatusBadge.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const router = useRouter()
const { t } = useI18n()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()
const { formatDate, formatDuration } = useAgentFormatting()

const statusFilter = ref('')
const takeFilter = ref('100')
const cancelOpen = ref(false)
const cancelling = ref(false)
const pendingCancel = ref<AgentExecutionDto | null>(null)

const columns: DhTableColumn<AgentExecutionDto>[] = [
  { key: 'createdAtUtc', label: t('agent.fields.date') },
  { key: 'providerId', label: t('agent.fields.provider') },
  { key: 'agentDefinitionId', label: t('agent.fields.definition') },
  { key: 'executionType', label: t('agent.fields.type') },
  { key: 'status', label: t('agent.fields.status') },
  { key: 'attempt', label: t('agent.fields.attempt') },
  { key: 'durationMs', label: t('agent.fields.duration') },
  { key: 'correlationId', label: t('agent.fields.correlationId') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const statusOptions = [
  { value: '', label: t('agent.executions.allStatuses') },
  ...AGENT_EXECUTION_STATUSES.map((value) => ({ value, label: value })),
]

const canCancelStatus = (status: AgentExecutionStatus) =>
  ['Pending', 'Queued', 'Running', 'WaitingForAuthentication'].includes(status)

const normalizedTake = computed(() => {
  const take = Number(takeFilter.value)
  return Number.isInteger(take) && take > 0 ? Math.min(take, 500) : 100
})

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function definitionName(id: string) {
  return store.definitions.find((definition) => definition.id === id)?.name ?? id
}

async function refresh() {
  try {
    await Promise.all([
      store.loadProviders(),
      store.loadDefinitions(),
      store.loadExecutions(
        normalizedTake.value,
        statusFilter.value ? (statusFilter.value as AgentExecutionStatus) : undefined,
      ),
    ])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadExecutions'))
  }
}

function askCancel(row: AgentExecutionDto) {
  pendingCancel.value = row
  cancelOpen.value = true
}

async function confirmCancel() {
  const execution = pendingCancel.value
  if (!execution || cancelling.value) return

  try {
    cancelling.value = true
    await AgentService.cancelExecution(execution.id)
    toastStore.success(t('agent.messages.cancellationRequested'))
    cancelOpen.value = false
    pendingCancel.value = null
    await refresh()
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.cancelExecution'))
  } finally {
    cancelling.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      :title="t('agent.executions.title')"
      :subtitle="t('agent.executions.subtitle')"
      :icon="History"
    >
      <template #actions>
        <DhButton
          :label="t('agent.actions.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="store.loading"
          @click="refresh"
        />
      </template>
    </DhPageHeader>

    <section class="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
      <DhSelect
        v-model="statusFilter"
        :label="t('agent.fields.status')"
        :options="statusOptions"
        placeholder=""
      />
      <DhInput v-model="takeFilter" label="Take" type="number" />
      <DhButton :label="t('agent.actions.applyFilters')" variant="secondary" :loading="store.loading" @click="refresh" />
    </section>

    <DhDataTable
      :columns="columns"
      :rows="store.executions"
      :loading="store.loading"
      :empty-text="t('agent.executions.empty')"
      @row-click="(row) => router.push(`/agents/executions/${row.id}`)"
    >
      <template #cell-createdAtUtc="{ row }">{{ formatDate(row.createdAtUtc) }}</template>
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-agentDefinitionId="{ row }">{{ definitionName(row.agentDefinitionId) }}</template>
      <template #cell-status="{ row }"><AgentExecutionStatusBadge :status="row.status" /></template>
      <template #cell-attempt="{ row }">{{ row.attempt }} / {{ row.maxAttempts }}</template>
      <template #cell-durationMs="{ row }">{{ formatDuration(row.durationMs) }}</template>
      <template #cell-correlationId="{ row }"><span class="break-all">{{ row.correlationId }}</span></template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton
            :label="t('agent.actions.view')"
            :icon="Eye"
            variant="ghost"
            size="sm"
            @click="router.push(`/agents/executions/${row.id}`)"
          />
          <DhButton
            v-if="permissions.canCancelExecutions.value && canCancelStatus(row.status)"
            :label="t('agent.actions.cancel')"
            :icon="Ban"
            variant="danger"
            size="sm"
            @click="askCancel(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="cancelOpen" :title="t('agent.executions.cancelTitle')" size="sm" @close="cancelOpen = false">
      <DhConfirmDialog
        v-if="pendingCancel"
        :title="t('agent.executions.cancelTitle')"
        :message="t('agent.executions.cancelQuestion', { id: pendingCancel.id })"
        :confirm-label="t('agent.executions.cancelTitle')"
        danger
        :on-confirm="confirmCancel"
        @cancel="cancelOpen = false"
      />
    </DhModal>
  </div>
</template>
