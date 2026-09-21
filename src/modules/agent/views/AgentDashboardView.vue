<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Circle,
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
const { t } = useI18n()
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
  { label: t('agent.schedules.noCredential'), value: '' },
  ...store.credentials
    .filter((credential) => credential.providerId === manualForm.providerId && credential.isActive)
    .map((credential) => ({ label: credential.name, value: credential.id })),
])

const selectedDefinition = computed(() =>
  store.definitions.find((definition) => definition.id === manualForm.definitionId),
)

const setupSteps = computed(() => [
  {
    key: 'provider',
    title: t('agent.guide.providerTitle'),
    description: t('agent.guide.providerDescription'),
    done: store.activeProviders.length > 0,
    path: '/agents/providers',
    canOpen: permissions.canViewProviders.value,
  },
  {
    key: 'credential',
    title: t('agent.guide.credentialTitle'),
    description: t('agent.guide.credentialDescription'),
    done: store.credentials.some((item) => item.isActive),
    path: '/agents/credentials',
    canOpen: permissions.canViewCredentials.value,
  },
  {
    key: 'profile',
    title: t('agent.guide.profileTitle'),
    description: t('agent.guide.profileDescription'),
    done: store.browserProfiles.some(
      (item) => item.isActive && (item.status === 'Ready' || item.status === 'Authenticated'),
    ),
    path: '/agents/browser-profiles',
    canOpen: permissions.canViewBrowserProfiles.value,
  },
  {
    key: 'definition',
    title: t('agent.guide.definitionTitle'),
    description: t('agent.guide.definitionDescription'),
    done: store.definitions.some((item) => item.isActive),
    path: '/agents/definitions',
    canOpen: permissions.canViewDefinitions.value,
  },
  {
    key: 'test',
    title: t('agent.guide.testTitle'),
    description: t('agent.guide.testDescription'),
    done: store.executions.length > 0,
    manual: true,
    canOpen: permissions.canCreateExecutions.value,
  },
  {
    key: 'schedule',
    title: t('agent.guide.scheduleTitle'),
    description: t('agent.guide.scheduleDescription'),
    done: store.activeSchedules.length > 0,
    path: '/agents/schedules',
    canOpen: permissions.canCreateSchedules.value || permissions.canViewSchedules.value,
    optional: true,
  },
])

const readyToTest = computed(() =>
  setupSteps.value
    .filter((step) => ['provider', 'credential', 'profile', 'definition'].includes(step.key))
    .every((step) => step.done),
)

function openSetupStep(step: (typeof setupSteps.value)[number]) {
  if (step.manual) {
    openManual()
    return
  }

  if (step.path) {
    void router.push(step.path)
  }
}

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

  if (!manualForm.pol.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.pol') }))
  if (!manualForm.pod.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.pod') }))
  if (!manualForm.containerType.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.containerType') }))
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(t('agent.validation.positive', { field: t('agent.fields.quantity') }))
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error(t('agent.validation.positive', { field: t('agent.fields.weightKg') }))
  if (!manualForm.cargoReadyDate) throw new Error(t('agent.validation.required', { field: t('agent.fields.cargoReadyDate') }))

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
      toastStore.warning(t('agent.messages.partialRefresh'), t('agent.messages.partialRefreshDescription'))
    } else {
      toastStore.success(t('agent.messages.refreshed'))
    }
  }
  if (!manualForm.providerId) resetManualDefaults()
}

async function createManualExecution() {
  if (submitting.value) return

  try {
    if (!manualForm.providerId) throw new Error(t('agent.validation.required', { field: t('agent.fields.provider') }))
    if (!manualForm.definitionId) throw new Error(t('agent.validation.required', { field: t('agent.fields.definition') }))

    const priority = Number(manualForm.priority)
    const maxAttempts = Number(manualForm.maxAttempts)
    if (!Number.isInteger(priority) || priority < 0) throw new Error(t('agent.validation.nonNegativeInteger', { field: t('agent.fields.priority') }))
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error(t('agent.validation.positive', { field: t('agent.fields.maxAttempts') }))
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
    toastStore.success(t('agent.messages.executionCreated'), t('agent.messages.executionCreatedDescription'))
    await router.push(`/agents/executions/${id}`)
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning(t('agent.review.extraction'), error.message)
    } else {
      toastStore.backendError(error, t('agent.errors.createExecution'))
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
      :title="t('agent.title')"
      :subtitle="t('agent.subtitle')"
      :icon="Bot"
    >
      <template #actions>
        <DhButton
          :label="t('agent.actions.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="store.loading"
          @click="refresh(true)"
        />
        <DhButton
          v-if="permissions.canCreateSchedules.value"
          :label="t('agent.actions.newSchedule')"
          :icon="CalendarClock"
          variant="secondary"
          @click="router.push('/agents/schedules')"
        />
        <DhButton
          v-if="permissions.canCreateExecutions.value"
          :label="t('agent.actions.newExtraction')"
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
        <p class="font-black">{{ t('agent.serviceOffline') }}</p>
        <p class="mt-1 text-sm font-semibold">
          {{ t('agent.serviceOfflineDescription') }}
        </p>
      </div>
    </section>

    <DhCard :title="t('agent.guide.title')" :subtitle="t('agent.guide.subtitle')">
      <div
        class="mb-4 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card-hover)] p-4"
      >
        <div class="flex items-start gap-3">
          <component
            :is="readyToTest ? CheckCircle2 : CircleAlert"
            class="mt-0.5 h-5 w-5 shrink-0"
            :class="readyToTest ? 'text-green-500' : 'text-amber-500'"
          />
          <div class="min-w-0">
            <p class="font-black text-[var(--dh-text)]">
              {{ readyToTest ? t('agent.guide.readyTitle') : t('agent.guide.incompleteTitle') }}
            </p>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              {{
                readyToTest
                  ? t('agent.guide.readyDescription')
                  : t('agent.guide.incompleteDescription')
              }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <article
          v-for="step in setupSteps"
          :key="step.key"
          class="flex min-w-0 items-start gap-3 rounded-[20px] border border-[var(--dh-border)] p-4"
        >
          <component
            :is="step.done ? CheckCircle2 : Circle"
            class="mt-0.5 h-5 w-5 shrink-0"
            :class="step.done ? 'text-green-500' : 'text-[var(--dh-text-muted)]'"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-black text-[var(--dh-text)]">{{ step.title }}</p>
              <span
                class="rounded-full border border-[var(--dh-border)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]"
              >
                {{
                  step.optional
                    ? t('agent.guide.optional')
                    : step.done
                      ? t('agent.guide.done')
                      : t('agent.guide.pending')
                }}
              </span>
            </div>
            <p class="mt-1 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
              {{ step.description }}
            </p>
            <DhButton
              v-if="step.canOpen"
              class="mt-3"
              :label="t('agent.guide.open')"
              :icon="ArrowRight"
              variant="ghost"
              size="sm"
              @click="openSetupStep(step)"
            />
          </div>
        </article>
      </div>
    </DhCard>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AgentMetricCard
        :label="t('agent.dashboard.serviceStatus')"
        :value="store.serviceOnline ? t('agent.online') : t('agent.offline')"
        :icon="Activity"
        :description="store.lastRefreshAt ? t('agent.dashboard.updatedAt', { date: formatDate(store.lastRefreshAt.toISOString()) }) : t('agent.dashboard.notUpdated')"
      />
      <AgentMetricCard
        :label="t('agent.dashboard.activeProviders')"
        :value="store.activeProviders.length"
        :icon="Ship"
      />
      <AgentMetricCard
        :label="t('agent.dashboard.activeSchedules')"
        :value="store.activeSchedules.length"
        :icon="CalendarClock"
      />
      <AgentMetricCard
        :label="t('agent.dashboard.runningExecutions')"
        :value="store.runningExecutions.length"
        :icon="Activity"
      />
      <AgentMetricCard
        :label="t('agent.dashboard.failedExecutions')"
        :value="store.failedExecutions.length"
        :icon="CircleAlert"
      />
      <AgentMetricCard
        :label="t('agent.dashboard.nextExecution')"
        :value="store.nextSchedule?.nextExecutionAt ? formatDate(store.nextSchedule.nextExecutionAt) : '—'"
        :icon="CalendarClock"
        :description="store.nextSchedule?.name"
      />
    </section>

    <DhCard v-if="permissions.canViewExecutions.value" :title="t('agent.dashboard.recentExecutions')" :subtitle="t('agent.dashboard.recentExecutionsDescription')">
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
      <p v-else class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('agent.dashboard.noExecutions') }}</p>
    </DhCard>

    <DhModal :open="manualOpen" :title="t('agent.dashboard.manualTitle')" size="lg" @close="manualOpen = false">
      <form class="grid gap-4" @submit.prevent="createManualExecution">
        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect
            v-model="manualForm.providerId"
            :label="t('agent.fields.provider')"
            :options="providerOptions"
            :disabled="submitting"
          />
          <DhSelect
            v-model="manualForm.definitionId"
            :label="t('agent.fields.definition')"
            :options="definitionOptions"
            :disabled="submitting || !manualForm.providerId"
          />
          <DhSelect
            v-model="manualForm.credentialId"
            :label="t('agent.fields.credential')"
            :options="credentialOptions"
            placeholder=""
            :disabled="submitting || !manualForm.providerId"
          />
          <div class="rounded-[18px] border border-[var(--dh-border)] p-3">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('agent.fields.actionType') }}</p>
            <p class="mt-1 text-sm font-bold text-[var(--dh-text)]">{{ selectedDefinition?.actionType ?? '—' }}</p>
          </div>
          <DhInput v-model="manualForm.pol" :label="t('agent.fields.pol')" :disabled="submitting" />
          <DhInput v-model="manualForm.pod" :label="t('agent.fields.pod')" :disabled="submitting" />
          <DhInput v-model="manualForm.containerType" :label="t('agent.fields.containerType')" :disabled="submitting" />
          <DhInput v-model="manualForm.quantity" :label="t('agent.fields.quantity')" type="number" :disabled="submitting" />
          <DhInput v-model="manualForm.weightKg" :label="t('agent.fields.weightKg')" type="number" :disabled="submitting" />
          <DhInput v-model="manualForm.commodity" :label="t('agent.fields.commodity')" :disabled="submitting" />
          <DhInput v-model="manualForm.cargoReadyDate" :label="t('agent.fields.cargoReadyDate')" type="date" :disabled="submitting" />
          <DhInput v-model="manualForm.priority" :label="t('agent.fields.priority')" type="number" :disabled="submitting" />
          <DhInput v-model="manualForm.maxAttempts" :label="t('agent.fields.maxAttempts')" type="number" :disabled="submitting" />
        </div>

        <DhTextarea
          v-model="manualForm.instruction"
          :label="t('agent.fields.instruction')"
          :rows="4"
          :disabled="submitting"
        />

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton
            :label="t('agent.actions.cancel')"
            variant="secondary"
            :disabled="submitting"
            @click="manualOpen = false"
          />
          <DhButton
            type="submit"
            :label="t('agent.dashboard.createExecution')"
            :icon="Play"
            :loading="submitting"
          />
        </div>
      </form>
    </DhModal>
  </div>
</template>
