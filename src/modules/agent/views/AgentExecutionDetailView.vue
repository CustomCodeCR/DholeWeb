<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Activity, ArrowLeft, Ban, RefreshCw } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhCard, DhConfirmDialog } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import type { AgentExecutionDto, AgentExecutionStatus } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentExecutionStatusBadge from '@/modules/agent/components/AgentExecutionStatusBadge.vue'
import AgentJsonViewer from '@/modules/agent/components/AgentJsonViewer.vue'
import AgentRateResult from '@/modules/agent/components/AgentRateResult.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const route = useRoute()
const router = useRouter()
const store = useAgentStore()
const toastStore = useToastStore()
const permissions = useAgentPermissions()
const { formatDate, formatDuration } = useAgentFormatting()

const execution = ref<AgentExecutionDto | null>(null)
const loading = ref(false)
const cancelOpen = ref(false)
const cancelling = ref(false)

const executionId = computed(() => String(route.params.id ?? ''))
const canCancel = computed(
  () =>
    permissions.canCancelExecutions.value &&
    Boolean(execution.value) &&
    ['Pending', 'Queued', 'Running', 'WaitingForAuthentication'].includes(
      execution.value?.status as AgentExecutionStatus,
    ),
)

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function definitionName(id: string) {
  return store.definitions.find((definition) => definition.id === id)?.name ?? id
}

function credentialName(id: string | null) {
  if (!id) return '—'
  return store.credentials.find((credential) => credential.id === id)?.name ?? id
}

function scheduleName(id: string | null) {
  if (!id) return '—'
  return store.schedules.find((schedule) => schedule.id === id)?.name ?? id
}

async function loadReferenceData() {
  const tasks: Promise<unknown>[] = []

  if (permissions.canViewProviders.value) tasks.push(store.loadProviders())
  if (permissions.canViewDefinitions.value) tasks.push(store.loadDefinitions())
  if (permissions.canViewCredentials.value) tasks.push(store.loadCredentials())
  if (permissions.canViewSchedules.value) tasks.push(store.loadSchedules())

  await Promise.allSettled(tasks)
}

async function refresh(showToast = false) {
  if (!executionId.value || loading.value) return

  try {
    loading.value = true
    const [row] = await Promise.all([
      AgentService.getExecution(executionId.value),
      loadReferenceData(),
    ])
    execution.value = row
    store.upsertExecution(row)
    if (showToast) toastStore.success('Ejecución actualizada')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la ejecución.')
  } finally {
    loading.value = false
  }
}

async function cancelExecution() {
  if (!execution.value || cancelling.value) return

  try {
    cancelling.value = true
    await AgentService.cancelExecution(execution.value.id)
    toastStore.success('Cancelación solicitada')
    cancelOpen.value = false
    await refresh()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cancelar la ejecución.')
  } finally {
    cancelling.value = false
  }
}

const metadata = computed(() => {
  const row = execution.value
  if (!row) return []

  return [
    ['Execution ID', row.id],
    ['Status', row.status],
    ['Provider', providerName(row.providerId)],
    ['Definition', definitionName(row.agentDefinitionId)],
    ['Schedule', scheduleName(row.scheduleId)],
    ['Credential', credentialName(row.credentialId)],
    ['Created', formatDate(row.createdAtUtc)],
    ['Started', formatDate(row.startedAt)],
    ['Completed', formatDate(row.completedAt)],
    ['Duration', formatDuration(row.durationMs)],
    ['Attempt / MaxAttempts', `${row.attempt} / ${row.maxAttempts}`],
    ['CorrelationId', row.correlationId],
    ['TraceId', row.traceId ?? '—'],
  ]
})

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      :title="execution ? `Ejecución ${execution.id}` : 'Detalle de ejecución'"
      subtitle="Estado, entrada y resultado de DholeAgentService."
      :icon="Activity"
    >
      <template #actions>
        <DhButton label="Volver" :icon="ArrowLeft" variant="ghost" @click="router.push('/agents/executions')" />
        <DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="loading"
          @click="refresh(true)"
        />
        <DhButton
          v-if="canCancel"
          label="Cancelar"
          :icon="Ban"
          variant="danger"
          @click="cancelOpen = true"
        />
      </template>
    </DhPageHeader>

    <template v-if="execution">
      <DhCard title="Resumen de ejecución">
        <div class="mb-5">
          <AgentExecutionStatusBadge :status="execution.status" />
        </div>

        <dl class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="item in metadata"
            :key="String(item[0])"
            class="min-w-0 rounded-[18px] border border-[var(--dh-border)] p-3"
          >
            <dt class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              {{ item[0] }}
            </dt>
            <dd class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
              {{ item[1] || '—' }}
            </dd>
          </div>
        </dl>
      </DhCard>

      <DhCard title="Input">
        <AgentJsonViewer :value="execution.inputJson" />
      </DhCard>

      <DhCard title="Result">
        <AgentRateResult v-if="execution.outputJson" :value="execution.outputJson" />
        <p v-else class="py-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          La ejecución todavía no tiene output.
        </p>
      </DhCard>

      <DhCard v-if="execution.errorCode || execution.errorMessage" title="Error">
        <div class="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4">
          <p v-if="execution.errorCode" class="break-all text-sm font-black text-red-700 dark:text-red-300">
            {{ execution.errorCode }}
          </p>
          <p v-if="execution.errorMessage" class="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-red-700 dark:text-red-300">
            {{ execution.errorMessage }}
          </p>
        </div>
      </DhCard>
    </template>

    <DhCard v-else-if="loading">
      <p class="py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        Cargando ejecución...
      </p>
    </DhCard>

    <DhCard v-else>
      <p class="py-10 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        No fue posible cargar la ejecución.
      </p>
    </DhCard>

    <DhModal :open="cancelOpen" title="Cancelar ejecución" size="sm" @close="cancelOpen = false">
      <DhConfirmDialog
        v-if="execution"
        title="Cancelar ejecución"
        :message="`¿Desea cancelar la ejecución ${execution.id}?`"
        confirm-label="Cancelar ejecución"
        danger
        :on-confirm="cancelExecution"
        @cancel="cancelOpen = false"
      />
    </DhModal>
  </div>
</template>
