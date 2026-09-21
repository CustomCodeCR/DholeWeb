import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { AGENT_SCOPES } from '@/core/auth/scopes'
import type {
  AgentCredentialDto,
  AgentDefinitionDto,
  AgentEndpointCaptureDto,
  AgentExecutionDto,
  AgentExecutionStatus,
  AgentExtractionEquipmentDto,
  AgentExtractionFieldDto,
  AgentExtractionRouteDto,
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

  const routes = ref<AgentExtractionRouteDto[]>([])
  const equipment = ref<AgentExtractionEquipmentDto[]>([])
  const captures = ref<AgentEndpointCaptureDto[]>([])
  const fields = ref<AgentExtractionFieldDto[]>([])
  const profileConfigurationId = ref<string | null>(null)

  const executions = ref<AgentExecutionDto[]>([])
  const selectedExecution = ref<AgentExecutionDto | null>(null)

  const serviceOnline = ref(false)
  const loading = ref(false)
  const lastRefreshAt = ref<Date | null>(null)
  let pendingLoads = 0

  const profileCrudAvailable = computed(() => AgentService.profiles.contractAvailable)
  const activeProviders = computed(() => providers.value.filter((item) => item.isActive))
  const activeSchedules = computed(() => schedules.value.filter((item) => item.isActive))
  const activeRoutes = computed(() => routes.value.filter((item) => item.isActive))
  const activeEquipment = computed(() => equipment.value.filter((item) => item.isActive))
  const activeCaptures = computed(() => captures.value.filter((item) => item.isActive))
  const activeFields = computed(() => fields.value.filter((item) => item.isActive))
  const plannedSearchCount = computed(() => activeRoutes.value.length * activeEquipment.value.length)
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
    providers.value = await withLoading(() => AgentService.providers.browse())
    return providers.value
  }

  async function loadDefinitions(providerId?: string) {
    definitions.value = await withLoading(() => AgentService.definitions.browse(providerId))
    return definitions.value
  }

  async function loadCredentials(providerId?: string) {
    credentials.value = await withLoading(() => AgentService.credentials.browse(providerId))
    return credentials.value
  }

  async function loadBrowserProfiles(providerId?: string) {
    browserProfiles.value = await withLoading(() => AgentService.browserProfiles.browse(providerId))
    return browserProfiles.value
  }

  async function loadSchedules() {
    schedules.value = await withLoading(() => AgentService.schedules.browse())
    return schedules.value
  }

  async function loadRoutes(profileId: string) {
    routes.value = await withLoading(() => AgentService.routes.browse(profileId))
    profileConfigurationId.value = profileId
    return routes.value
  }

  async function loadEquipment(profileId: string) {
    equipment.value = await withLoading(() => AgentService.equipment.browse(profileId))
    profileConfigurationId.value = profileId
    return equipment.value
  }

  async function loadCaptures(profileId: string) {
    captures.value = await withLoading(() => AgentService.captures.browse(profileId))
    profileConfigurationId.value = profileId
    return captures.value
  }

  async function loadFields(profileId: string) {
    fields.value = await withLoading(() => AgentService.fields.browse(profileId))
    profileConfigurationId.value = profileId
    return fields.value
  }

  async function loadProfileConfiguration(profileId: string) {
    const tasks: Promise<unknown>[] = []

    if (authStore.hasScope(AGENT_SCOPES.routes.manage)) tasks.push(loadRoutes(profileId))
    if (authStore.hasScope(AGENT_SCOPES.equipment.manage)) tasks.push(loadEquipment(profileId))
    if (authStore.hasScope(AGENT_SCOPES.captureRules.manage)) tasks.push(loadCaptures(profileId))
    if (authStore.hasScope(AGENT_SCOPES.extractionFields.manage)) tasks.push(loadFields(profileId))

    const results = await Promise.allSettled(tasks)
    profileConfigurationId.value = profileId
    return results
  }

  function clearProfileConfiguration() {
    routes.value = []
    equipment.value = []
    captures.value = []
    fields.value = []
    profileConfigurationId.value = null
  }

  async function loadExecutions(take = 100, status?: AgentExecutionStatus) {
    executions.value = await withLoading(() => AgentService.executions.browse(take, status))
    return executions.value
  }

  async function loadExecution(executionId: string) {
    selectedExecution.value = await withLoading(() => AgentService.executions.get(executionId))
    upsertExecution(selectedExecution.value)
    return selectedExecution.value
  }

  async function refreshExecution(executionId?: string) {
    const id = executionId ?? selectedExecution.value?.id
    if (!id) return null
    return loadExecution(id)
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
    routes,
    equipment,
    captures,
    fields,
    profileConfigurationId,
    executions,
    selectedExecution,
    serviceOnline,
    loading,
    lastRefreshAt,
    profileCrudAvailable,
    activeProviders,
    activeSchedules,
    activeRoutes,
    activeEquipment,
    activeCaptures,
    activeFields,
    plannedSearchCount,
    runningExecutions,
    failedExecutions,
    nextSchedule,
    checkHealth,
    loadProviders,
    loadDefinitions,
    loadCredentials,
    loadBrowserProfiles,
    loadSchedules,
    loadRoutes,
    loadEquipment,
    loadCaptures,
    loadFields,
    loadProfileConfiguration,
    clearProfileConfiguration,
    loadExecutions,
    loadExecution,
    refreshExecution,
    loadDashboard,
    refreshAll,
    upsertExecution,
  }
})
