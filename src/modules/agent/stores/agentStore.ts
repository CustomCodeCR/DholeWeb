import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { AGENT_SCOPES } from '@/core/auth/scopes'
import type {
  AgentCredentialDto,
  AgentDefinitionDto,
  AgentExecutionDto,
  AgentProviderDto,
  AgentScheduleDto,
  BrowserProfileDto,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useAuthStore } from '@/core/stores/authStore'

const RUNNING_STATUSES = new Set(['Pending', 'Queued', 'Running', 'WaitingForAuthentication'])

export const useAgentStore = defineStore('agent', () => {
  const authStore = useAuthStore()

  const providers = ref<AgentProviderDto[]>([])
  const definitions = ref<AgentDefinitionDto[]>([])
  const credentials = ref<AgentCredentialDto[]>([])
  const browserProfiles = ref<BrowserProfileDto[]>([])
  const schedules = ref<AgentScheduleDto[]>([])
  const executions = ref<AgentExecutionDto[]>([])
  const serviceOnline = ref(false)
  const loading = ref(false)
  const lastRefreshAt = ref<Date | null>(null)
  let pendingLoads = 0

  const activeProviders = computed(() => providers.value.filter((item) => item.isActive))
  const activeSchedules = computed(() => schedules.value.filter((item) => item.isActive))
  const runningExecutions = computed(() =>
    executions.value.filter((item) => RUNNING_STATUSES.has(item.status)),
  )
  const failedExecutions = computed(() =>
    executions.value.filter((item) => item.status === 'Failed'),
  )
  const nextSchedule = computed(() =>
    [...activeSchedules.value]
      .filter((item) => item.nextExecutionAt)
      .sort(
        (a, b) =>
          new Date(a.nextExecutionAt ?? 0).getTime() -
          new Date(b.nextExecutionAt ?? 0).getTime(),
      )[0] ?? null,
  )

  function beginLoad() {
    pendingLoads += 1
    loading.value = true
  }

  function endLoad() {
    pendingLoads = Math.max(0, pendingLoads - 1)
    loading.value = pendingLoads > 0
    lastRefreshAt.value = new Date()
  }

  async function withLoading<T>(action: () => Promise<T>): Promise<T> {
    beginLoad()
    try {
      return await action()
    } finally {
      endLoad()
    }
  }

  async function checkHealth() {
    try {
      serviceOnline.value = await AgentService.checkHealth()
    } catch {
      serviceOnline.value = false
    }
    return serviceOnline.value
  }

  async function loadProviders() {
    providers.value = await withLoading(() => AgentService.browseProviders())
    return providers.value
  }

  async function loadDefinitions(providerId?: string) {
    definitions.value = await withLoading(() => AgentService.browseDefinitions(providerId))
    return definitions.value
  }

  async function loadCredentials(providerId?: string) {
    credentials.value = await withLoading(() => AgentService.browseCredentials(providerId))
    return credentials.value
  }

  async function loadBrowserProfiles(providerId?: string) {
    browserProfiles.value = await withLoading(() => AgentService.browseBrowserProfiles(providerId))
    return browserProfiles.value
  }

  async function loadSchedules() {
    schedules.value = await withLoading(() => AgentService.browseSchedules())
    return schedules.value
  }

  async function loadExecutions(take = 100, status?: import('@/core/interfaces/agent').AgentExecutionStatus) {
    executions.value = await withLoading(() => AgentService.browseExecutions(take, status))
    return executions.value
  }

  async function loadDashboard() {
    const tasks: Promise<unknown>[] = [checkHealth()]

    if (authStore.hasScope(AGENT_SCOPES.providers.view)) tasks.push(loadProviders())
    if (authStore.hasScope(AGENT_SCOPES.definitions.view)) tasks.push(loadDefinitions())
    if (authStore.hasScope(AGENT_SCOPES.credentials.view)) tasks.push(loadCredentials())
    if (authStore.hasScope(AGENT_SCOPES.browserProfiles.view)) tasks.push(loadBrowserProfiles())
    if (authStore.hasScope(AGENT_SCOPES.schedules.view)) tasks.push(loadSchedules())
    if (authStore.hasScope(AGENT_SCOPES.executions.view)) tasks.push(loadExecutions())

    const results = await Promise.allSettled(tasks)
    lastRefreshAt.value = new Date()
    return results
  }

  async function refreshAll() {
    return loadDashboard()
  }

  function upsertExecution(execution: AgentExecutionDto) {
    const index = executions.value.findIndex((item) => item.id === execution.id)
    if (index >= 0) {
      executions.value[index] = execution
    } else {
      executions.value.unshift(execution)
    }
  }

  return {
    providers,
    definitions,
    credentials,
    browserProfiles,
    schedules,
    executions,
    serviceOnline,
    loading,
    lastRefreshAt,
    activeProviders,
    activeSchedules,
    runningExecutions,
    failedExecutions,
    nextSchedule,
    checkHealth,
    loadProviders,
    loadDefinitions,
    loadCredentials,
    loadBrowserProfiles,
    loadSchedules,
    loadExecutions,
    loadDashboard,
    refreshAll,
    upsertExecution,
  }
})
