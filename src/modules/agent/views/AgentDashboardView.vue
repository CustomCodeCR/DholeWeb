<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Activity,
  Bot,
  CalendarClock,
  CircleAlert,
  Play,
  RefreshCw,
  Ship,
} from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import AgentExecutionStatusBadge from '@/modules/agent/components/AgentExecutionStatusBadge.vue'
import AgentMetricCard from '@/modules/agent/components/AgentMetricCard.vue'
import { useAgentFormatting } from '@/modules/agent/composables/useAgentFormatting'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const router = useRouter()
const toastStore = useToastStore()
const store = useAgentStore()
const permissions = useAgentPermissions()
const { formatDate } = useAgentFormatting()

const manualOpen = ref(false)
const submitting = ref(false)

function tomorrowIsoDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

const manualForm = reactive({
  providerId: '',
  definitionId: '',
  credentialId: '',
  pol: '',
  pod: '',
  containerType: '40HC',
  quantity: '1',
  weightKg: '15000',
  commodity: 'FAK',
  cargoReadyDate: tomorrowIsoDate(),
  instruction: '',
  priority: '0',
  maxAttempts: '3',
})

const providerOptions = computed(() =>
  store.activeProviders.map((provider) => ({
    label: `${provider.name} · ${provider.code}`,
    value: provider.id,
  })),
)

const availableDefinitions = computed(() =>
  store.definitions.filter(
    (definition) => definition.providerId === manualForm.providerId && definition.isActive,
  ),
)

const definitionOptions = computed(() =>
  availableDefinitions.value.map((definition) => ({
    label: `${definition.name} · ${definition.actionType}`,
    value: definition.id,
  })),
)

const credentialOptions = computed(() => [
  { label: 'Sin credencial', value: '' },
  ...store.credentials
    .filter((credential) => credential.providerId === manualForm.providerId && credential.isActive)
    .map((credential) => ({ label: credential.name, value: credential.id })),
])

const selectedDefinition = computed(() =>
  store.definitions.find((definition) => definition.id === manualForm.definitionId),
)

watch(
  () => manualForm.providerId,
  (providerId) => {
    const definition = store.definitions.find(
      (item) => item.providerId === providerId && item.isActive,
    )
    const credential = store.credentials.find(
      (item) => item.providerId === providerId && item.isActive,
    )
    manualForm.definitionId = definition?.id ?? ''
    manualForm.credentialId = credential?.id ?? ''
  },
)

function resetManualDefaults() {
  const provider = store.activeProviders[0]
  manualForm.providerId = provider?.id ?? ''
}

function buildManualInputJson() {
  const quantity = Number(manualForm.quantity)
  const weightKg = Number(manualForm.weightKg)

  if (!manualForm.pol.trim()) throw new Error('POL es obligatorio.')
  if (!manualForm.pod.trim()) throw new Error('POD es obligatorio.')
  if (!manualForm.containerType.trim()) throw new Error('Container Type es obligatorio.')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity debe ser mayor que cero.')
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Weight Kg debe ser mayor que cero.')
  if (!manualForm.cargoReadyDate) throw new Error('Cargo Ready Date es obligatorio.')

  return JSON.stringify({
    pol: manualForm.pol.trim(),
    pod: manualForm.pod.trim(),
    containerType: manualForm.containerType.trim(),
    quantity,
    weightKg,
    commodity: manualForm.commodity.trim() || 'FAK',
    cargoReadyDate: manualForm.cargoReadyDate,
    ...(manualForm.instruction.trim() ? { instruction: manualForm.instruction.trim() } : {}),
  })
}

async function refresh(showToast = false) {
  const results = await store.loadDashboard()
  if (showToast) {
    const rejected = results.filter((result) => result.status === 'rejected').length
    if (rejected) {
      toastStore.warning('Actualización parcial', 'Algunas fuentes no pudieron actualizarse.')
    } else {
      toastStore.success('Dhole Agent actualizado')
    }
  }
  if (!manualForm.providerId) resetManualDefaults()
}

async function createManualExecution() {
  if (submitting.value) return

  try {
    if (!manualForm.providerId) throw new Error('Seleccione un provider.')
    if (!manualForm.definitionId) throw new Error('Seleccione una definición.')

    const priority = Number(manualForm.priority)
    const maxAttempts = Number(manualForm.maxAttempts)
    if (!Number.isInteger(priority) || priority < 0) throw new Error('Priority debe ser 0 o mayor.')
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error('Max Attempts debe ser mayor que cero.')
    }

    const inputJson = buildManualInputJson()
    submitting.value = true

    const id = await AgentService.createExecution({
      agentDefinitionId: manualForm.definitionId,
      providerId: manualForm.providerId,
      credentialId: manualForm.credentialId || null,
      priority,
      inputJson,
      maxAttempts,
      correlationId: null,
      traceId: null,
    })

    manualOpen.value = false
    toastStore.success('Ejecución creada', 'La extracción fue enviada a DholeAgentService.')
    await router.push(`/agents/executions/${id}`)
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning('Revise la extracción', error.message)
    } else {
      toastStore.backendError(error, 'No se pudo crear la ejecución.')
    }
  } finally {
    submitting.value = false
  }
}

function openManual() {
  resetManualDefaults()
  manualOpen.value = true
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      title="Dhole Agent"
      subtitle="Operación, automatización y extracciones de DholeAgentService."
      :icon="Bot"
    >
      <template #actions>
        <DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="store.loading"
          @click="refresh(true)"
        />
        <DhButton
          v-if="permissions.canCreateSchedules.value"
          label="Nueva programación"
          :icon="CalendarClock"
          variant="secondary"
          @click="router.push('/agents/schedules')"
        />
        <DhButton
          v-if="permissions.canCreateExecutions.value"
          label="Nueva extracción"
          :icon="Play"
          @click="openManual"
        />
      </template>
    </DhPageHeader>

    <section
      v-if="!store.serviceOnline"
      class="flex min-w-0 items-start gap-3 rounded-[22px] border border-red-500/20 bg-red-500/10 p-4 text-red-700 dark:text-red-300"
    >
      <CircleAlert class="mt-0.5 h-5 w-5 shrink-0" />
      <div class="min-w-0">
        <p class="font-black">DholeAgentService Offline</p>
        <p class="mt-1 text-sm font-semibold">
          No fue posible confirmar el health del servicio. Los datos visibles pueden estar desactualizados.
        </p>
      </div>
    </section>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AgentMetricCard
        label="Estado DholeAgentService"
        :value="store.serviceOnline ? 'Online' : 'Offline'"
        :icon="Activity"
        :description="store.lastRefreshAt ? `Actualizado ${formatDate(store.lastRefreshAt.toISOString())}` : 'Sin actualizar'"
      />
      <AgentMetricCard
        label="Providers activos"
        :value="store.activeProviders.length"
        :icon="Ship"
      />
      <AgentMetricCard
        label="Programaciones activas"
        :value="store.activeSchedules.length"
        :icon="CalendarClock"
      />
      <AgentMetricCard
        label="Ejecuciones en proceso"
        :value="store.runningExecutions.length"
        :icon="Activity"
      />
      <AgentMetricCard
        label="Ejecuciones fallidas"
        :value="store.failedExecutions.length"
        :icon="CircleAlert"
      />
      <AgentMetricCard
        label="Próxima ejecución"
        :value="store.nextSchedule?.nextExecutionAt ? formatDate(store.nextSchedule.nextExecutionAt) : '—'"
        :icon="CalendarClock"
        :description="store.nextSchedule?.name"
      />
    </section>

    <DhCard v-if="permissions.canViewExecutions.value" title="Ejecuciones recientes" subtitle="Últimas ejecuciones conocidas por el frontend.">
      <div v-if="store.executions.length" class="grid gap-2">
        <button
          v-for="execution in store.executions.slice(0, 6)"
          :key="execution.id"
          type="button"
          class="flex min-w-0 flex-col gap-2 rounded-[18px] border border-[var(--dh-border)] p-3 text-left transition hover:bg-[var(--dh-card-hover)] sm:flex-row sm:items-center sm:justify-between"
          @click="router.push(`/agents/executions/${execution.id}`)"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-black text-[var(--dh-text)]">{{ execution.executionType }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ formatDate(execution.createdAtUtc) }}</p>
          </div>
          <AgentExecutionStatusBadge :status="execution.status" />
        </button>
      </div>
      <p v-else class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">No hay ejecuciones disponibles.</p>
    </DhCard>

    <DhModal :open="manualOpen" title="Nueva extracción manual" size="lg" @close="manualOpen = false">
      <form class="grid gap-4" @submit.prevent="createManualExecution">
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect
            v-model="manualForm.providerId"
            label="Provider"
            :options="providerOptions"
            :disabled="submitting"
          />
          <DhSelect
            v-model="manualForm.definitionId"
            label="Definition"
            :options="definitionOptions"
            :disabled="submitting || !manualForm.providerId"
          />
          <DhSelect
            v-model="manualForm.credentialId"
            label="Credential opcional"
            :options="credentialOptions"
            placeholder=""
            :disabled="submitting || !manualForm.providerId"
          />
          <div class="rounded-[18px] border border-[var(--dh-border)] p-3">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Action Type</p>
            <p class="mt-1 text-sm font-bold text-[var(--dh-text)]">{{ selectedDefinition?.actionType ?? '—' }}</p>
          </div>
          <DhInput v-model="manualForm.pol" label="POL" :disabled="submitting" />
          <DhInput v-model="manualForm.pod" label="POD" :disabled="submitting" />
          <DhInput v-model="manualForm.containerType" label="Container Type" :disabled="submitting" />
          <DhInput v-model="manualForm.quantity" label="Quantity" type="number" :disabled="submitting" />
          <DhInput v-model="manualForm.weightKg" label="Weight Kg" type="number" :disabled="submitting" />
          <DhInput v-model="manualForm.commodity" label="Commodity" :disabled="submitting" />
          <DhInput v-model="manualForm.cargoReadyDate" label="Cargo Ready Date" type="date" :disabled="submitting" />
          <DhInput v-model="manualForm.priority" label="Priority" type="number" :disabled="submitting" />
          <DhInput v-model="manualForm.maxAttempts" label="Max Attempts" type="number" :disabled="submitting" />
        </div>

        <DhTextarea
          v-model="manualForm.instruction"
          label="Instruction opcional"
          :rows="4"
          :disabled="submitting"
        />

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton
            label="Cancelar"
            variant="secondary"
            :disabled="submitting"
            @click="manualOpen = false"
          />
          <DhButton
            type="submit"
            label="Crear ejecución"
            :icon="Play"
            :loading="submitting"
          />
        </div>
      </form>
    </DhModal>
  </div>
</template>
