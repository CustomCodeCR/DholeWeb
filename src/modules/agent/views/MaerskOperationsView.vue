<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhPageHeader, DhModal } from '@/shared/components/organisms'
import { AgentService } from '@/core/services/agentService'
import type { MaerskOperationsDto, MaerskProfileHealthDto, MaerskWaitingExecutionDto } from '@/core/interfaces/agent'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useToastStore } from '@/core/stores/toastStore'
import {
  visibleMaerskAlerts,
  canAcknowledgeMaerskAlert,
  canResetMaerskCircuit,
} from '@/modules/agent/utils/maerskAlertPolicy'

const { t, locale } = useI18n()
const permissions = useAgentPermissions()
const toast = useToastStore()
const details = ref<MaerskOperationsDto | null>(null)
const waitingExecutions = ref<MaerskWaitingExecutionDto[]>([])
const recoveryApiAvailable = ref(false)
const selectedHealth = ref<MaerskProfileHealthDto | null>(null)
const healthLoading = ref(false)
const selectedProfileId = ref<string | null>(null)
const resumeTarget = ref<MaerskWaitingExecutionDto | null>(null)
const resumeReason = ref('')
const resumeVerified = ref(false)
const resuming = ref(false)
const loading = ref(false)
const resetting = ref(false)
const acknowledgingId = ref<string | null>(null)
const confirmOpen = ref(false)
const operatorReason = ref('')
const verifiedWithProvider = ref(false)
let poll: ReturnType<typeof setInterval> | undefined

const circuit = computed(() => details.value?.circuit)
const activeHealthAlerts = computed(() => visibleMaerskAlerts(details.value?.monitoring))
const canReset = computed(() =>
  canResetMaerskCircuit(
    permissions.canResetMaerskCircuit.value,
    circuit.value?.featureEnabled,
    circuit.value?.state,
  ),
)
const resetValid = computed(() =>
  verifiedWithProvider.value && operatorReason.value.trim().length >= 12 &&
  operatorReason.value.length <= 1000,
)
const canResume = computed(() =>
  permissions.canResetMaerskCircuit.value &&
  permissions.canCreateExecutions.value &&
  recoveryApiAvailable.value &&
  circuit.value?.featureEnabled === true &&
  circuit.value?.state === 'Closed' &&
  !circuit.value?.requiresOperator,
)
const resumeValid = computed(() =>
  canResume.value && resumeVerified.value &&
  resumeReason.value.trim().length >= 12 && resumeReason.value.trim().length <= 500,
)

function date(value: string | null | undefined): string {
  if (!value) return '—'
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return '—'
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' })
    .format(time)
}

function badgeVariant(state: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (state === 'Closed' || state === 'Authenticated' || state === 'Completed') return 'success'
  if (state === 'Open' || state === 'Blocked' || state === 'Failed') return 'danger'
  if (state === 'HalfOpen' || state === 'WaitingForAuthentication' || state === 'Expired') return 'warning'
  return 'neutral'
}

async function refresh(silent = false) {
  if (loading.value || !permissions.canViewMaerskOperations.value) return
  loading.value = true
  try {
    // Rollout is API-first, but Web staging may deploy independently.
    // The existing operations overview must stay usable until Agent API
    // exposes the phase-5 endpoints; never advertise unavailable mutations.
    details.value = await AgentService.maerskOperations.get()
    try {
      waitingExecutions.value = await AgentService.maerskOperations.waitingExecutions()
      recoveryApiAvailable.value = true
    } catch {
      recoveryApiAvailable.value = false
      waitingExecutions.value = []
      selectedHealth.value = null
    }
  } catch (error) {
    if (!silent) toast.backendError(error, t('maerskOperations.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function acknowledgeAlert(alertId: string) {
  const alert = details.value?.monitoring?.alerts.find((item) => item.id === alertId)
  if (acknowledgingId.value || !canAcknowledgeMaerskAlert(
    permissions.canResetMaerskCircuit.value, details.value?.monitoring, alert,
  )) return
  acknowledgingId.value = alertId
  try {
    const result = await AgentService.maerskOperations.acknowledgeAlert(alertId)
    if (!result.acknowledged) throw new Error(t('maerskMonitoring.ackFailed'))
    toast.success(t('maerskMonitoring.ackSuccess'))
    await refresh()
  } catch (error) {
    toast.backendError(error, t('maerskMonitoring.ackFailed'))
  } finally {
    acknowledgingId.value = null
  }
}

function requestReset() {
  if (!canReset.value) return
  operatorReason.value = ''
  verifiedWithProvider.value = false
  confirmOpen.value = true
}

async function confirmReset() {
  if (!canReset.value || !resetValid.value || !details.value || resetting.value) return
  resetting.value = true
  try {
    const response = await AgentService.maerskOperations.resetCircuit(
      details.value.providerId, operatorReason.value.trim(), verifiedWithProvider.value,
    )
    if (!response.reset) throw new Error(t('maerskOperations.resetFailed'))
    confirmOpen.value = false
    verifiedWithProvider.value = false
    operatorReason.value = ''
    toast.success(t('maerskOperations.resetSuccess'))
    await refresh()
  } catch (error) {
    toast.backendError(error, t('maerskOperations.resetFailed'))
  } finally {
    resetting.value = false
  }
}

async function viewProfileHealth(profileId: string) {
  if (healthLoading.value || !permissions.canViewMaerskOperations.value) return
  healthLoading.value = true
  selectedProfileId.value = profileId
  selectedHealth.value = null
  try {
    selectedHealth.value = await AgentService.maerskOperations.profileHealth(profileId)
  } catch (error) {
    toast.backendError(error, t('maerskOperations.healthFailed'))
  } finally {
    healthLoading.value = false
  }
}

function requestResume(execution: MaerskWaitingExecutionDto) {
  if (!canResume.value || resuming.value) return
  resumeTarget.value = execution
  resumeReason.value = ''
  resumeVerified.value = false
}

async function confirmResume() {
  if (!resumeTarget.value || !resumeValid.value || resuming.value) return
  resuming.value = true
  try {
    const response = await AgentService.maerskOperations.resumeExecution(
      resumeTarget.value.id, resumeReason.value.trim(), resumeVerified.value,
    )
    if (!response.resumed) throw new Error(t('maerskOperations.resumeFailed'))
    resumeTarget.value = null
    resumeVerified.value = false
    resumeReason.value = ''
    toast.success(t('maerskOperations.resumeSuccess'))
    await refresh()
  } catch (error) {
    toast.backendError(error, t('maerskOperations.resumeFailed'))
  } finally {
    resuming.value = false
  }
}

function onVisible() {
  if (!document.hidden) void refresh(true)
}

onMounted(() => {
  void refresh()
  poll = setInterval(() => {
    if (!document.hidden && !confirmOpen.value && !resumeTarget.value) void refresh(true)
  }, 15000)
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  if (poll) clearInterval(poll)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <section class="grid min-w-0 gap-5 sm:gap-6">
    <DhPageHeader
      :title="t('maerskOperations.title')"
      :subtitle="t('maerskOperations.subtitle')"
      :icon="Activity"
    >
      <template #actions>
        <DhButton
          :label="t('maerskOperations.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="loading"
          @click="refresh()"
        />
      </template>
    </DhPageHeader>

    <div v-if="!permissions.canViewMaerskOperations.value"
      class="rounded-2xl border border-[var(--dh-border)] p-5 text-sm text-[var(--dh-text-muted)]">
      {{ t('maerskOperations.noAccess') }}
    </div>
    <template v-else-if="details">
      <div v-if="!details.circuit.featureEnabled"
        class="flex items-start gap-3 rounded-2xl border border-amber-500/30 p-4 text-sm text-[var(--dh-text)]">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <span>{{ t('maerskOperations.disabledWarning') }}</span>
      </div>

      <p v-if="!recoveryApiAvailable" class="rounded-xl border border-amber-500/30 p-3 text-sm text-amber-600">
        {{ t('maerskOperations.apiUnavailable') }}
      </p>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div v-for="metric in [
          { key: 'queued', value: details.counters.queued },
          { key: 'running', value: details.counters.running },
          { key: 'waitingForAuthentication', value: details.counters.waitingForAuthentication },
          { key: 'completed', value: details.counters.completed },
          { key: 'failed', value: details.counters.failed },
        ]" :key="metric.key"
          class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
          <p class="text-xs text-[var(--dh-text-muted)]">{{ t(`maerskOperations.${metric.key}`) }}</p>
          <strong class="mt-2 block text-3xl tabular-nums text-[var(--dh-text)]">{{ metric.value }}</strong>
        </div>
      </div>

      <section v-if="details.monitoring"
        class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-bold text-[var(--dh-text)]">
            {{ t('maerskMonitoring.title') }}
          </h2>
          <DhBadge
            :label="details.monitoring.monitoringEnabled
              ? t('maerskMonitoring.active') : t('maerskMonitoring.disabled')"
            :variant="details.monitoring.monitoringEnabled ? 'success' : 'warning'"
          />
        </div>
        <p v-if="!details.monitoring.monitoringEnabled"
          class="mt-2 text-sm text-[var(--dh-text-muted)]">
          {{ t('maerskMonitoring.disabledHelp') }}
        </p>
        <dl class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div v-for="metric in [
            { key: 'failedInWindow', value: details.monitoring.failedInWindow },
            { key: 'queuedOverThreshold', value: details.monitoring.queuedOverThreshold },
            { key: 'runningOverThreshold', value: details.monitoring.runningOverThreshold },
          ]" :key="metric.key" class="rounded-xl border border-[var(--dh-border)] p-3">
            <dt class="text-xs text-[var(--dh-text-muted)]">{{ t(`maerskMonitoring.${metric.key}`) }}</dt>
            <dd class="mt-1 text-2xl font-bold tabular-nums text-[var(--dh-text)]">{{ metric.value }}</dd>
          </div>
          <div class="rounded-xl border border-[var(--dh-border)] p-3">
            <dt class="text-xs text-[var(--dh-text-muted)]">{{ t('maerskMonitoring.lastSuccess') }}</dt>
            <dd class="mt-1 text-sm font-semibold text-[var(--dh-text)]">{{ date(details.monitoring.lastCompletedAtUtc) }}</dd>
          </div>
        </dl>
        <h3 class="mt-5 font-semibold text-[var(--dh-text)]">
          {{ t('maerskMonitoring.alerts') }} ({{ activeHealthAlerts.length }})
        </h3>
        <p v-if="!activeHealthAlerts.length"
          class="mt-2 text-sm text-[var(--dh-text-muted)]">
          {{ details.monitoring.monitoringEnabled
            ? t('maerskMonitoring.none') : t('maerskMonitoring.notMonitoring') }}
        </p>
        <div class="mt-2 grid min-w-0 gap-2">
          <div v-for="alert in activeHealthAlerts" :key="alert.id"
            class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] p-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <DhBadge :label="t(`maerskMonitoring.severity.${alert.severity}`)"
                  :variant="alert.severity === 'Critical' ? 'danger' : 'warning'" />
                <strong class="break-all text-sm text-[var(--dh-text)]">
                  {{ t(`maerskMonitoring.codes.${alert.key}`) }}
                </strong>
              </div>
              <p class="mt-1 break-all text-xs text-[var(--dh-text-muted)]">
                {{ alert.code }} · {{ date(alert.firstSeenAtUtc) }}
              </p>
              <p v-if="alert.acknowledgedAtUtc" class="mt-1 text-xs text-[var(--dh-text-muted)]">
                {{ t('maerskMonitoring.acknowledged') }}: {{ date(alert.acknowledgedAtUtc) }}
              </p>
            </div>
            <DhButton
              v-if="canAcknowledgeMaerskAlert(
                permissions.canResetMaerskCircuit.value, details.monitoring, alert
              )"
              :label="t('maerskMonitoring.ack')"
              variant="secondary" size="sm"
              :loading="acknowledgingId === alert.id"
              :disabled="Boolean(acknowledgingId)"
              @click="acknowledgeAlert(alert.id)"
            />
          </div>
        </div>
        <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
          {{ t('maerskMonitoring.ackNote') }}
        </p>
      </section>

      <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <ShieldAlert v-if="circuit?.state === 'Open'" class="h-6 w-6 shrink-0 text-red-500" />
            <ShieldCheck v-else-if="circuit?.featureEnabled && circuit?.state === 'Closed'" class="h-6 w-6 shrink-0 text-emerald-600" />
            <ShieldAlert v-else class="h-6 w-6 shrink-0 text-amber-600" />
            <div class="min-w-0">
              <h2 class="font-bold text-[var(--dh-text)]">{{ t('maerskOperations.circuitTitle') }}</h2>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ details.providerName }}</p>
            </div>
          </div>
          <DhBadge :label="!circuit?.featureEnabled ? 'Disabled' : (circuit?.state ?? '—')" :variant="!circuit?.featureEnabled ? 'neutral' : badgeVariant(circuit?.state ?? '')" />
        </div>
        <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.reason') }}</dt>
            <dd class="mt-1 break-all font-semibold text-[var(--dh-text)]">{{ circuit?.reasonCode ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.failures') }}</dt>
            <dd class="mt-1 font-semibold text-[var(--dh-text)]">{{ circuit?.consecutiveFailures ?? 0 }}</dd>
          </div>
          <div>
            <dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.cooldown') }}</dt>
            <dd class="mt-1 font-semibold text-[var(--dh-text)]">{{ date(circuit?.openUntilUtc) }}</dd>
          </div>
        </dl>
        <p v-if="!circuit?.featureEnabled" class="mt-4 text-sm text-amber-600">{{ t('maerskOperations.disabledWarning') }}</p>
        <p v-else-if="circuit?.requiresOperator" class="mt-4 text-sm text-amber-600">
          {{ t('maerskOperations.operatorRequired') }}
        </p>
        <p v-else-if="circuit?.state === 'HalfOpen'" class="mt-4 text-sm text-[var(--dh-text-muted)]">
          {{ t('maerskOperations.probeInfo') }}
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <DhButton v-if="canReset" :label="t('maerskOperations.reset')"
            :icon="CheckCircle2" variant="secondary" @click="requestReset" />
          <RouterLink to="/agents/browser-profiles"
            class="inline-flex min-h-11 items-center rounded-xl border border-[var(--dh-border)] px-4 text-sm font-bold text-[var(--dh-text)]">
            {{ t('maerskOperations.sessions') }}
          </RouterLink>
          <RouterLink to="/agents/executions"
            class="inline-flex min-h-11 items-center rounded-xl border border-[var(--dh-border)] px-4 text-sm font-bold text-[var(--dh-text)]">
            {{ t('maerskOperations.allExecutions') }}
          </RouterLink>
        </div>
      </div>

      <div class="grid min-w-0 gap-4 xl:grid-cols-2">
        <section class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
          <h2 class="mb-3 font-bold text-[var(--dh-text)]">{{ t('maerskOperations.sessions') }}</h2>
          <p v-if="!details.profiles.length" class="text-sm text-[var(--dh-text-muted)]">{{ t('maerskOperations.empty') }}</p>
          <div v-for="profile in details.profiles" :key="profile.id"
            class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dh-border)] py-3 first:border-0">
            <div class="min-w-0">
              <p class="break-words text-sm font-semibold text-[var(--dh-text)]">{{ profile.name }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ t('maerskOperations.lastLogin') }}: {{ date(profile.lastLoginAt) }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <DhBadge :label="profile.status" :variant="badgeVariant(profile.status)" />
              <DhButton v-if="recoveryApiAvailable" :label="t('maerskOperations.profileHealth')" size="sm" variant="secondary"
                :disabled="healthLoading" :loading="selectedProfileId === profile.id && healthLoading"
                @click="viewProfileHealth(profile.id)" />
            </div>
          </div>
          <div v-if="selectedHealth" class="mt-3 rounded-xl border border-[var(--dh-border)] p-3 text-sm">
            <p class="font-semibold text-[var(--dh-text)]">{{ selectedHealth.profileName }}</p>
            <dl class="mt-2 grid gap-2 sm:grid-cols-2">
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.environment') }}</dt>
                <dd>{{ selectedHealth.environment }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.nextSafeAction') }}</dt>
                <dd>{{ t('maerskOperations.actions.' + selectedHealth.nextAction) }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.lastSuccess') }}</dt>
                <dd>{{ date(selectedHealth.lastSuccessAtUtc) }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.reason') }}</dt>
                <dd class="break-all">{{ selectedHealth.errorCode ?? '—' }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.queued') }}</dt>
                <dd>{{ selectedHealth.queued }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('maerskOperations.waitingForAuthentication') }}</dt>
                <dd>{{ selectedHealth.waitingForAuthentication }}</dd></div>
            </dl>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
              {{ t('maerskOperations.manualVerificationNote') }}
            </p>
          </div>
        </section>
        <section class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
          <h2 class="mb-3 font-bold text-[var(--dh-text)]">{{ t('maerskOperations.incidents') }}</h2>
          <p v-if="!details.events.length" class="text-sm text-[var(--dh-text-muted)]">{{ t('maerskOperations.empty') }}</p>
          <div v-for="event in details.events" :key="event.id"
            class="flex min-w-0 justify-between gap-3 border-t border-[var(--dh-border)] py-3 first:border-0">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-[var(--dh-text)]">{{ event.eventType }}</p>
              <p class="break-all text-xs text-[var(--dh-text-muted)]">{{ event.reasonCode ?? '—' }}</p>
            </div>
            <time class="shrink-0 text-xs text-[var(--dh-text-muted)]">{{ date(event.occurredAtUtc) }}</time>
          </div>
        </section>
      </div>

      <section class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
        <h2 class="font-bold text-[var(--dh-text)]">
          {{ t('maerskOperations.waitingQueue') }} ({{ waitingExecutions.length }})
        </h2>
        <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
          {{ t('maerskOperations.waitingQueueNote') }}
        </p>
        <div v-for="execution in waitingExecutions" :key="execution.id"
          class="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] p-3">
          <div class="min-w-0">
            <p class="text-xs text-[var(--dh-text-muted)]">{{ date(execution.createdAtUtc) }}</p>
            <RouterLink :to="'/agents/executions/' + execution.id"
              class="break-all text-sm font-semibold text-[var(--dh-primary)] underline underline-offset-2">
              {{ execution.id }}
            </RouterLink>
            <p class="mt-1 break-all text-xs text-[var(--dh-text-muted)]">
              {{ execution.errorCode ?? '—' }} · {{ execution.attempt }}/{{ execution.maxAttempts }}
            </p>
          </div>
          <DhButton v-if="canResume" :label="t('maerskOperations.resume')"
            variant="secondary" size="sm" :disabled="resuming"
            @click="requestResume(execution)" />
        </div>
      </section>

      <section class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-bold text-[var(--dh-text)]">{{ t('maerskOperations.recentExecutions') }}</h2>
          <span class="inline-flex items-center gap-1 text-xs text-[var(--dh-text-muted)]">
            <Clock3 class="h-4 w-4" />{{ t('maerskOperations.updated') }}: {{ date(details.generatedAtUtc) }}
          </span>
        </div>
        <p v-if="!details.executions.length" class="text-sm text-[var(--dh-text-muted)]">{{ t('maerskOperations.empty') }}</p>
        <div v-else class="max-w-full overflow-x-auto">
          <table class="w-full min-w-[650px] text-left text-sm">
            <thead class="text-xs text-[var(--dh-text-muted)]">
              <tr>
                <th class="px-2 py-3">{{ t('maerskOperations.when') }}</th>
                <th class="px-2 py-3">{{ t('maerskOperations.status') }}</th>
                <th class="px-2 py-3">{{ t('maerskOperations.attempts') }}</th>
                <th class="px-2 py-3">{{ t('maerskOperations.reason') }}</th>
                <th class="px-2 py-3">{{ t('maerskOperations.details') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="execution in details.executions" :key="execution.id"
                class="border-t border-[var(--dh-border)]">
                <td class="px-2 py-3 whitespace-nowrap">{{ date(execution.createdAtUtc) }}</td>
                <td class="px-2 py-3"><DhBadge :label="execution.status" :variant="badgeVariant(execution.status)" /></td>
                <td class="px-2 py-3 tabular-nums">{{ execution.attempt }}/{{ execution.maxAttempts }}</td>
                <td class="max-w-[200px] break-all px-2 py-3">{{ execution.errorCode ?? '—' }}</td>
                <td class="px-2 py-3">
                  <RouterLink :to="`/agents/executions/${execution.id}`"
                    class="font-semibold text-[var(--dh-primary)] underline underline-offset-2">
                    {{ t('maerskOperations.view') }}
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
    <div v-else-if="loading" class="rounded-2xl border border-[var(--dh-border)] p-6 text-sm text-[var(--dh-text-muted)]">
      {{ t('maerskOperations.loading') }}
    </div>
    <div v-else class="rounded-2xl border border-[var(--dh-border)] p-6">
      <DhButton :label="t('maerskOperations.retry')" :icon="RefreshCw" @click="refresh()" />
    </div>

    <DhModal :open="Boolean(resumeTarget)" :title="t('maerskOperations.resume')" size="md"
      @close="resumeTarget = null">
      <form class="grid gap-4" @submit.prevent="confirmResume">
        <p class="text-sm text-[var(--dh-text-muted)]">
          {{ t('maerskOperations.resumeExplanation') }}
        </p>
        <p v-if="resumeTarget" class="break-all text-xs text-[var(--dh-text-muted)]">
          {{ resumeTarget.id }}
        </p>
        <DhInput v-model="resumeReason" :label="t('maerskOperations.operatorReason')" :disabled="resuming" />
        <label class="flex items-start gap-3 text-sm text-[var(--dh-text)]">
          <input v-model="resumeVerified" type="checkbox" :disabled="resuming"
            class="mt-1 h-4 w-4 shrink-0 accent-[var(--dh-primary)]" />
          <span>{{ t('maerskOperations.verified') }}</span>
        </label>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton :label="t('maerskOperations.cancel')" variant="secondary"
            :disabled="resuming" @click="resumeTarget = null" />
          <DhButton type="submit" :label="t('maerskOperations.confirmResume')"
            variant="danger" :disabled="!resumeValid || resuming" :loading="resuming" />
        </div>
      </form>
    </DhModal>

    <DhModal :open="confirmOpen" :title="t('maerskOperations.reset')" size="md"
      @close="confirmOpen = false">
      <form class="grid gap-4" @submit.prevent="confirmReset">
        <p class="text-sm leading-relaxed text-[var(--dh-text-muted)]">
          {{ t('maerskOperations.resetExplanation') }}
        </p>
        <DhInput v-model="operatorReason" :label="t('maerskOperations.operatorReason')" :disabled="resetting" />
        <label class="flex items-start gap-3 text-sm text-[var(--dh-text)]">
          <input v-model="verifiedWithProvider" type="checkbox" :disabled="resetting"
            class="mt-1 h-4 w-4 shrink-0 accent-[var(--dh-primary)]" />
          <span>{{ t('maerskOperations.verified') }}</span>
        </label>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton :label="t('maerskOperations.cancel')" variant="secondary"
            :disabled="resetting" @click="confirmOpen = false" />
          <DhButton type="submit" :label="t('maerskOperations.confirmReset')"
            variant="danger" :disabled="!resetValid || resetting" :loading="resetting" />
        </div>
      </form>
    </DhModal>
  </section>
</template>
