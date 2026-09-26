<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CalendarClock, Pencil, Play, Plus, Power, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhConfirmDialog, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import {
  AGENT_SCHEDULE_TYPES,
  type AgentScheduleDto,
  type AgentScheduleType,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
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
const runningId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const pendingToggle = ref<AgentScheduleDto | null>(null)
const advancedJson = ref(false)

function tomorrowIsoDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

const form = reactive({
  name: '',
  providerId: '',
  agentDefinitionId: '',
  credentialId: '',
  extractionProfileId: '',
  scheduleType: 'Interval' as AgentScheduleType,
  executeAt: '',
  intervalMinutes: '360',
  cronExpression: '0 */6 * * *',
  timezone: 'America/Costa_Rica',
  maxRetries: '2',
  timeoutSeconds: '600',
  inputJson: '',
  pol: '',
  pod: '',
  containerType: '40HC',
  quantity: '1',
  weightKg: '15000',
  commodity: 'FAK',
  cargoReadyDate: tomorrowIsoDate(),
  instruction: '',
})

const columns: DhTableColumn<AgentScheduleDto>[] = [
  { key: 'name', label: t('agent.fields.name') },
  { key: 'providerId', label: t('agent.fields.provider') },
  { key: 'agentDefinitionId', label: t('agent.fields.definition') },
  { key: 'extractionProfileId', label: t('agent.fields.extractionProfile') },
  { key: 'scheduleType', label: t('agent.fields.scheduleType') },
  { key: 'lastExecutionAt', label: t('agent.fields.lastExecution') },
  { key: 'nextExecutionAt', label: t('agent.fields.nextExecution') },
  { key: 'isActive', label: t('agent.fields.status'), align: 'center' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
]

const scheduleTypeOptions = AGENT_SCHEDULE_TYPES.map((value) => ({
  value,
  label: value === 'Once' ? t('agent.schedules.once') : value === 'Interval' ? t('agent.schedules.interval') : t('agent.schedules.cron'),
}))

const providerOptions = computed(() =>
  store.activeProviders.map((provider) => ({
    value: provider.id,
    label: `${provider.name} · ${provider.code}`,
  })),
)

const availableDefinitions = computed(() =>
  store.definitions.filter(
    (definition) => definition.providerId === form.providerId && definition.isActive,
  ),
)

const definitionOptions = computed(() =>
  availableDefinitions.value.map((definition) => ({
    value: definition.id,
    label: `${definition.name} · ${definition.actionType}`,
  })),
)

const credentialOptions = computed(() => [
  { value: '', label: t('agent.schedules.noCredential') },
  ...store.credentials
    .filter((credential) => credential.providerId === form.providerId && credential.isActive)
    .map((credential) => ({ value: credential.id, label: credential.name })),
])

const availableExtractionProfiles = computed(() =>
  store.extractionProfiles.filter(
    (profile) => profile.providerId === form.providerId && profile.isActive,
  ),
)

const extractionProfileOptions = computed(() =>
  availableExtractionProfiles.value.map((profile) => ({
    value: profile.id,
    label: `${profile.name} · ${profile.executionStrategy}`,
  })),
)

const selectedDefinition = computed(() =>
  store.definitions.find((definition) => definition.id === form.agentDefinitionId),
)

const isOceanRate = computed(() => selectedDefinition.value?.actionType === 'SearchOceanRates')

watch(
  () => form.providerId,
  (providerId) => {
    if (editingId.value) return
    const definition = store.definitions.find(
      (item) => item.providerId === providerId && item.isActive,
    )
    const profile = store.extractionProfiles.find(
      (item) => item.providerId === providerId && item.isActive,
    )
    const credential = profile?.credentialId
      ? store.credentials.find((item) => item.id === profile.credentialId && item.isActive)
      : store.credentials.find(
          (item) => item.providerId === providerId && item.isActive,
        )

    form.agentDefinitionId = definition?.id ?? ''
    form.extractionProfileId = profile?.id ?? ''
    form.credentialId = credential?.id ?? ''
  },
)

watch(
  () => form.extractionProfileId,
  (profileId) => {
    if (!profileId) return
    const profile = store.extractionProfiles.find((item) => item.id === profileId)
    if (!profile) return

    if (profile.providerId !== form.providerId) {
      form.providerId = profile.providerId
    }

    if (profile.credentialId) {
      form.credentialId = profile.credentialId
    }
  },
)

function providerName(id: string) {
  return store.providers.find((provider) => provider.id === id)?.name ?? id
}

function definitionName(id: string) {
  return store.definitions.find((definition) => definition.id === id)?.name ?? id
}

function extractionProfileName(id: string | null) {
  if (!id) return '—'
  return store.extractionProfiles.find((profile) => profile.id === id)?.name ?? id
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function parseObjectJson(value: string) {
  const parsed = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('agent.validation.objectJson', { field: t('agent.fields.inputJson') }))
  }
  return parsed as Record<string, unknown>
}

function populateVisualInput(inputJson: string) {
  try {
    const input = parseObjectJson(inputJson)
    form.pol = String(input.pol ?? '')
    form.pod = String(input.pod ?? '')
    form.containerType = String(input.containerType ?? '')
    form.quantity = String(input.quantity ?? '1')
    form.weightKg = String(input.weightKg ?? '')
    form.commodity = String(input.commodity ?? '')
    form.cargoReadyDate = String(input.cargoReadyDate ?? '')
    form.instruction = String(input.instruction ?? '')
  } catch {
    // JSON inválido se conserva en modo avanzado para que el usuario pueda corregirlo.
    advancedJson.value = true
  }
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.providerId = store.activeProviders[0]?.id ?? ''
  form.agentDefinitionId =
    store.definitions.find(
      (definition) => definition.providerId === form.providerId && definition.isActive,
    )?.id ?? ''
  const defaultProfile = store.extractionProfiles.find(
    (profile) => profile.providerId === form.providerId && profile.isActive,
  )
  form.extractionProfileId = defaultProfile?.id ?? ''
  form.credentialId =
    defaultProfile?.credentialId ??
    store.credentials.find(
      (credential) => credential.providerId === form.providerId && credential.isActive,
    )?.id ??
    ''
  form.scheduleType = 'Interval'
  form.executeAt = ''
  form.intervalMinutes = '360'
  form.cronExpression = '0 */6 * * *'
  form.timezone = 'America/Costa_Rica'
  form.maxRetries = '2'
  form.timeoutSeconds = '600'
  form.inputJson = ''
  form.pol = ''
  form.pod = ''
  form.containerType = '40HC'
  form.quantity = '1'
  form.weightKg = '15000'
  form.commodity = 'FAK'
  form.cargoReadyDate = tomorrowIsoDate()
  form.instruction = ''
  advancedJson.value = false
}

function openCreate() {
  resetForm()
  modalOpen.value = true
}

async function openEdit(row: AgentScheduleDto) {
  try {
    const schedule = await AgentService.getSchedule(row.id)
    editingId.value = schedule.id
    form.name = schedule.name
    form.providerId = schedule.providerId
    form.agentDefinitionId = schedule.agentDefinitionId
    form.credentialId = schedule.credentialId ?? ''
    form.extractionProfileId =
      schedule.extractionProfileId ??
      store.extractionProfiles.find(
        (profile) =>
          profile.providerId === schedule.providerId &&
          profile.isActive &&
          (!schedule.credentialId || profile.credentialId === schedule.credentialId),
      )?.id ??
      ''
    form.scheduleType = schedule.scheduleType
    form.executeAt = toDateTimeLocal(schedule.executeAt)
    form.intervalMinutes = schedule.intervalMinutes?.toString() ?? ''
    form.cronExpression = schedule.cronExpression ?? ''
    form.timezone = schedule.timezone
    form.maxRetries = schedule.maxRetries.toString()
    form.timeoutSeconds = schedule.timeoutSeconds.toString()
    form.inputJson = schedule.inputJson
    advancedJson.value = selectedDefinition.value?.actionType !== 'SearchOceanRates'
    populateVisualInput(schedule.inputJson)
    modalOpen.value = true
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadSchedule'))
  }
}

function buildInputJson() {
  if (!isOceanRate.value) {
    const value = form.inputJson.trim()
    if (!value) throw new Error(t('agent.validation.required', { field: t('agent.fields.inputJson') }))
    parseObjectJson(value)
    return value
  }

  if (!form.cargoReadyDate) {
    throw new Error(t('agent.validation.required', { field: t('agent.fields.cargoReadyDate') }))
  }

  // Route, equipment, quantity, weight and requested extraction fields are owned by
  // the selected extraction profile. The schedule only carries runtime overrides.
  return JSON.stringify({
    cargoReadyDate: form.cargoReadyDate,
    ...(form.commodity.trim() ? { commodity: form.commodity.trim() } : {}),
    ...(form.instruction.trim() ? { instruction: form.instruction.trim() } : {}),
  })
}

function validateSchedule() {
  if (!form.name.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.name') }))
  if (!form.providerId) throw new Error(t('agent.validation.required', { field: t('agent.fields.provider') }))
  if (!form.agentDefinitionId) throw new Error(t('agent.validation.required', { field: t('agent.fields.definition') }))
  if (!form.extractionProfileId) throw new Error(t('agent.validation.required', { field: t('agent.fields.extractionProfile') }))
  if (!form.timezone.trim()) throw new Error(t('agent.validation.required', { field: t('agent.fields.timezone') }))

  const maxRetries = Number(form.maxRetries)
  const timeoutSeconds = Number(form.timeoutSeconds)
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new Error(t('agent.validation.nonNegativeInteger', { field: t('agent.fields.maxRetries') }))
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new Error(t('agent.validation.positive', { field: t('agent.fields.timeoutSeconds') }))

  let executeAt: string | null = null
  let intervalMinutes: number | null = null
  let cronExpression: string | null = null

  if (form.scheduleType === 'Once') {
    if (!form.executeAt) throw new Error(t('agent.validation.onceExecuteAt'))
    const date = new Date(form.executeAt)
    if (Number.isNaN(date.getTime())) throw new Error(t('agent.validation.invalidExecuteAt'))
    executeAt = date.toISOString()
  }

  if (form.scheduleType === 'Interval') {
    intervalMinutes = Number(form.intervalMinutes)
    if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
      throw new Error(t('agent.validation.intervalPositive'))
    }
  }

  if (form.scheduleType === 'Cron') {
    cronExpression = form.cronExpression.trim()
    if (!cronExpression) throw new Error(t('agent.validation.cronRequired'))
  }

  return {
    maxRetries,
    timeoutSeconds,
    executeAt,
    intervalMinutes,
    cronExpression,
    inputJson: buildInputJson(),
  }
}

async function save() {
  if (saving.value) return

  try {
    const validated = validateSchedule()
    saving.value = true

    if (editingId.value) {
      await AgentService.updateSchedule(editingId.value, {
        name: form.name.trim(),
        credentialId: form.credentialId || null,
        extractionProfileId: form.extractionProfileId || null,
        scheduleType: form.scheduleType,
        cronExpression: validated.cronExpression,
        intervalMinutes: validated.intervalMinutes,
        executeAt: validated.executeAt,
        timezone: form.timezone.trim(),
        inputJson: validated.inputJson,
        maxRetries: validated.maxRetries,
        timeoutSeconds: validated.timeoutSeconds,
        nextExecutionAt: null,
      })
      toastStore.success(t('agent.messages.scheduleUpdated'))
    } else {
      await AgentService.createSchedule({
        name: form.name.trim(),
        agentDefinitionId: form.agentDefinitionId,
        providerId: form.providerId,
        credentialId: form.credentialId || null,
        extractionProfileId: form.extractionProfileId || null,
        scheduleType: form.scheduleType,
        cronExpression: validated.cronExpression,
        intervalMinutes: validated.intervalMinutes,
        executeAt: validated.executeAt,
        timezone: form.timezone.trim(),
        inputJson: validated.inputJson,
        maxRetries: validated.maxRetries,
        timeoutSeconds: validated.timeoutSeconds,
      })
      toastStore.success(t('agent.messages.scheduleCreated'))
    }

    modalOpen.value = false
    await store.loadSchedules()
  } catch (error) {
    if (error instanceof Error && !('status' in error)) {
      toastStore.warning(t('agent.review.schedule'), error.message)
    } else {
      toastStore.backendError(error, t('agent.errors.saveSchedule'))
    }
  } finally {
    saving.value = false
  }
}

function askToggle(row: AgentScheduleDto) {
  pendingToggle.value = row
  confirmOpen.value = true
}

async function confirmToggle() {
  const row = pendingToggle.value
  if (!row) return

  await AgentService.setScheduleActive(row.id, !row.isActive)
  toastStore.success(t('agent.messages.stateUpdated'))
  confirmOpen.value = false
  pendingToggle.value = null
  await store.loadSchedules()
}

async function runNow(row: AgentScheduleDto) {
  if (runningId.value) return

  try {
    runningId.value = row.id
    const executionId = await AgentService.runSchedule(row.id)
    toastStore.success(t('agent.messages.executionStarted'), row.name)
    await router.push(`/agents/executions/${executionId}`)
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.runSchedule'))
  } finally {
    runningId.value = null
  }
}

async function refresh() {
  try {
    await Promise.all([
      store.loadProviders(),
      store.loadDefinitions(),
      store.loadCredentials(),
      store.loadProfiles(),
      store.loadSchedules(),
    ])
  } catch (error) {
    toastStore.backendError(error, t('agent.errors.loadSchedules'))
  }
}

onMounted(refresh)
</script>

<template>
  <div class="grid min-w-0 gap-6">
    <DhPageHeader
      :title="t('agent.schedules.title')"
      :subtitle="t('agent.schedules.subtitle')"
      :icon="CalendarClock"
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
          v-if="permissions.canCreateSchedules.value"
          :label="t('agent.actions.create')"
          :icon="Plus"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <DhDataTable
      :columns="columns"
      :rows="store.schedules"
      :loading="store.loading"
      :empty-text="t('agent.schedules.empty')"
    >
      <template #cell-providerId="{ row }">{{ providerName(row.providerId) }}</template>
      <template #cell-agentDefinitionId="{ row }">{{ definitionName(row.agentDefinitionId) }}</template>
      <template #cell-extractionProfileId="{ row }">{{ extractionProfileName(row.extractionProfileId) }}</template>
      <template #cell-lastExecutionAt="{ row }">{{ formatDate(row.lastExecutionAt) }}</template>
      <template #cell-nextExecutionAt="{ row }">{{ formatDate(row.nextExecutionAt) }}</template>
      <template #cell-isActive="{ row }"><AgentStatusBadge :active="row.isActive" /></template>
      <template #cell-actions="{ row }">
        <div class="flex flex-wrap justify-end gap-2" @click.stop>
          <DhButton
            v-if="permissions.canExecuteSchedules.value"
            :label="t('agent.actions.runNow')"
            :icon="Play"
            variant="secondary"
            size="sm"
            :loading="runningId === row.id"
            :disabled="Boolean(runningId) && runningId !== row.id"
            @click="runNow(row)"
          />
          <DhButton
            v-if="permissions.canUpdateSchedules.value"
            :label="t('agent.actions.edit')"
            :icon="Pencil"
            variant="secondary"
            size="sm"
            @click="openEdit(row)"
          />
          <DhButton
            v-if="permissions.canUpdateSchedules.value"
            :label="row.isActive ? t('agent.actions.deactivate') : t('agent.actions.activate')"
            :icon="Power"
            :variant="row.isActive ? 'danger' : 'secondary'"
            size="sm"
            @click="askToggle(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhModal :open="modalOpen" :title="editingId ? t('agent.schedules.editTitle') : t('agent.schedules.createTitle')" size="xl" @close="modalOpen = false">
      <form class="grid gap-5" @submit.prevent="save">
        <div class="grid gap-4 md:grid-cols-2">
          <DhInput v-model="form.name" :label="t('agent.fields.name')" :disabled="saving" />
          <DhSelect
            v-model="form.providerId"
            :label="t('agent.fields.provider')"
            :options="providerOptions"
            :disabled="saving || Boolean(editingId)"
          />
          <DhSelect
            v-model="form.agentDefinitionId"
            :label="t('agent.fields.definition')"
            :options="definitionOptions"
            :disabled="saving || Boolean(editingId) || !form.providerId"
          />
          <DhSelect
            v-model="form.extractionProfileId"
            :label="t('agent.fields.extractionProfile')"
            :options="extractionProfileOptions"
            :placeholder="t('agent.schedules.selectExtractionProfile')"
            :disabled="saving || !form.providerId"
          />
          <DhSelect
            v-model="form.credentialId"
            :label="t('agent.fields.credential')"
            :options="credentialOptions"
            placeholder=""
            :disabled="saving || !form.providerId"
          />
          <DhSelect
            v-model="form.scheduleType"
            :label="t('agent.fields.scheduleType')"
            :options="scheduleTypeOptions"
            :disabled="saving"
          />
          <DhInput v-model="form.timezone" :label="t('agent.fields.timezone')" :disabled="saving" />
          <DhInput v-model="form.maxRetries" :label="t('agent.fields.maxRetries')" type="number" :disabled="saving" />
          <DhInput v-model="form.timeoutSeconds" :label="t('agent.fields.timeoutSeconds')" type="number" :disabled="saving" />

          <DhInput
            v-if="form.scheduleType === 'Once'"
            v-model="form.executeAt"
            :label="t('agent.fields.executeAt')"
            type="datetime-local"
            :disabled="saving"
          />
          <DhInput
            v-if="form.scheduleType === 'Interval'"
            v-model="form.intervalMinutes"
            :label="t('agent.fields.intervalMinutes')"
            type="number"
            :disabled="saving"
          />
          <DhInput
            v-if="form.scheduleType === 'Cron'"
            v-model="form.cronExpression"
            :label="t('agent.fields.cronExpression')"
            :disabled="saving"
          />
        </div>

        <section class="rounded-[22px] border border-[var(--dh-border)] p-4 sm:p-5">
          <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="font-black text-[var(--dh-text)]">{{ t('agent.schedules.inputTitle') }}</h3>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                {{ isOceanRate ? t('agent.schedules.oceanInput') : t('agent.schedules.genericInput') }}
              </p>
            </div>
            <div
              v-if="isOceanRate"
              class="rounded-[14px] border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-muted)]"
            >
              {{ t('agent.schedules.profileDrivenInput') }}
            </div>
          </div>

          <div v-if="isOceanRate" class="grid gap-4 md:grid-cols-2">
            <DhInput v-model="form.cargoReadyDate" :label="t('agent.fields.cargoReadyDate')" type="date" :disabled="saving" />
            <DhInput v-model="form.commodity" :label="t('agent.fields.commodity')" :disabled="saving" />
            <div class="md:col-span-2">
              <DhTextarea v-model="form.instruction" :label="t('agent.fields.instruction')" :rows="4" :disabled="saving" />
            </div>
          </div>

          <DhTextarea
            v-else
            v-model="form.inputJson"
            :label="t('agent.fields.inputJson')"
            :rows="12"
            :disabled="saving"
            placeholder="{ }"
          />
        </section>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton :label="t('agent.actions.cancel')" variant="secondary" :disabled="saving" @click="modalOpen = false" />
          <DhButton
            type="submit"
            :label="editingId ? t('agent.actions.saveChanges') : t('agent.schedules.createTitle')"
            :loading="saving"
          />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" :title="t('agent.providers.confirmState')" size="sm" @close="confirmOpen = false">
      <DhConfirmDialog
        v-if="pendingToggle"
        :title="pendingToggle.isActive ? t('agent.confirm.deactivateTitle', { entity: t('agent.entities.schedule') }) : t('agent.confirm.activateTitle', { entity: t('agent.entities.schedule') })"
        :message="pendingToggle.isActive ? t('agent.confirm.deactivateQuestion', { name: pendingToggle.name }) : t('agent.confirm.activateQuestion', { name: pendingToggle.name })"
        :danger="pendingToggle.isActive"
        :on-confirm="confirmToggle"
        @cancel="confirmOpen = false"
      />
    </DhModal>
  </div>
</template>
