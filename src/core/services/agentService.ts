import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { AgentEndpoints } from '@/core/composables/endpoints'
import type {
  AgentCredentialDto,
  AgentDefinitionDto,
  AgentExecutionDto,
  AgentExecutionStatus,
  AgentProviderDto,
  AgentScheduleDto,
  BrowserProfileDto,
  CreateAgentCredentialRequest,
  CreateAgentDefinitionRequest,
  CreateAgentExecutionRequest,
  CreateAgentProviderRequest,
  CreateAgentScheduleRequest,
  CreateBrowserProfileRequest,
  UpdateAgentCredentialRequest,
  UpdateAgentDefinitionRequest,
  UpdateAgentProviderRequest,
  UpdateAgentScheduleRequest,
} from '@/core/interfaces/agent'

type NoContent = Record<string, never>

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

async function browseList<T>(
  endpoint: { method: 'GET'; path: string; headers?: Record<string, string>; baseUrl?: string },
  query?: Record<string, unknown>,
): Promise<T[]> {
  const response = await callEndpoint<unknown>({
    ...endpoint,
    path: withQuery(endpoint.path, query),
  })
  return unwrapListResponse<T>(response)
}

async function getOne<T>(
  endpoint: { method: 'GET'; path: string; headers?: Record<string, string>; baseUrl?: string },
  params: Record<string, string>,
): Promise<T> {
  const response = await callEndpoint<unknown>(endpoint, { params })
  return unwrapApiResponse<T>(response as never)
}

export const AgentService = {
  async checkHealth(): Promise<boolean> {
    await callEndpoint<unknown>(AgentEndpoints.agentHealth)
    return true
  },

  browseProviders(): Promise<AgentProviderDto[]> {
    return browseList<AgentProviderDto>(AgentEndpoints.browseProviders)
  },

  getProvider(providerId: string): Promise<AgentProviderDto> {
    return getOne<AgentProviderDto>(AgentEndpoints.getProvider, { providerId })
  },

  async createProvider(payload: CreateAgentProviderRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentProviderRequest>(
      AgentEndpoints.createProvider,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateProvider(providerId: string, payload: UpdateAgentProviderRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentProviderRequest>(AgentEndpoints.updateProvider, {
      params: { providerId },
      body: payload,
    })
  },

  setProviderActive(providerId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setProviderActive, {
      params: { providerId },
      body: { isActive },
    })
  },

  browseDefinitions(providerId?: string): Promise<AgentDefinitionDto[]> {
    return browseList<AgentDefinitionDto>(
      AgentEndpoints.browseDefinitions,
      providerId ? { providerId } : undefined,
    )
  },

  getDefinition(definitionId: string): Promise<AgentDefinitionDto> {
    return getOne<AgentDefinitionDto>(AgentEndpoints.getDefinition, { definitionId })
  },

  async createDefinition(payload: CreateAgentDefinitionRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentDefinitionRequest>(
      AgentEndpoints.createDefinition,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateDefinition(definitionId: string, payload: UpdateAgentDefinitionRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentDefinitionRequest>(AgentEndpoints.updateDefinition, {
      params: { definitionId },
      body: payload,
    })
  },

  setDefinitionActive(definitionId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setDefinitionActive, {
      params: { definitionId },
      body: { isActive },
    })
  },

  browseCredentials(providerId?: string): Promise<AgentCredentialDto[]> {
    return browseList<AgentCredentialDto>(
      AgentEndpoints.browseCredentials,
      providerId ? { providerId } : undefined,
    )
  },

  async createCredential(payload: CreateAgentCredentialRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentCredentialRequest>(
      AgentEndpoints.createCredential,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateCredential(credentialId: string, payload: UpdateAgentCredentialRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentCredentialRequest>(AgentEndpoints.updateCredential, {
      params: { credentialId },
      body: payload,
    })
  },

  setCredentialActive(credentialId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setCredentialActive, {
      params: { credentialId },
      body: { isActive },
    })
  },

  browseBrowserProfiles(providerId?: string): Promise<BrowserProfileDto[]> {
    return browseList<BrowserProfileDto>(
      AgentEndpoints.browseBrowserProfiles,
      providerId ? { providerId } : undefined,
    )
  },

  getBrowserProfile(profileId: string): Promise<BrowserProfileDto> {
    return getOne<BrowserProfileDto>(AgentEndpoints.getBrowserProfile, { profileId })
  },

  async createBrowserProfile(payload: CreateBrowserProfileRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateBrowserProfileRequest>(
      AgentEndpoints.createBrowserProfile,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  authenticateBrowserProfile(profileId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.authenticateBrowserProfile, {
      params: { profileId },
    })
  },

  browseSchedules(): Promise<AgentScheduleDto[]> {
    return browseList<AgentScheduleDto>(AgentEndpoints.browseSchedules)
  },

  getSchedule(scheduleId: string): Promise<AgentScheduleDto> {
    return getOne<AgentScheduleDto>(AgentEndpoints.getSchedule, { scheduleId })
  },

  async createSchedule(payload: CreateAgentScheduleRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentScheduleRequest>(
      AgentEndpoints.createSchedule,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateSchedule(scheduleId: string, payload: UpdateAgentScheduleRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentScheduleRequest>(AgentEndpoints.updateSchedule, {
      params: { scheduleId },
      body: payload,
    })
  },

  setScheduleActive(scheduleId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setScheduleActive, {
      params: { scheduleId },
      body: { isActive },
    })
  },

  async runSchedule(scheduleId: string): Promise<string> {
    const response = await callEndpoint<unknown>(AgentEndpoints.runSchedule, {
      params: { scheduleId },
    })
    return unwrapApiResponse<string>(response as never)
  },

  browseExecutions(take = 100, status?: AgentExecutionStatus): Promise<AgentExecutionDto[]> {
    return browseList<AgentExecutionDto>(AgentEndpoints.browseAgentExecutions, {
      take,
      ...(status ? { status } : {}),
    })
  },

  getExecution(executionId: string): Promise<AgentExecutionDto> {
    return getOne<AgentExecutionDto>(AgentEndpoints.getAgentExecution, { executionId })
  },

  async createExecution(payload: CreateAgentExecutionRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentExecutionRequest>(
      AgentEndpoints.createAgentExecution,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  cancelExecution(executionId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.cancelAgentExecution, {
      params: { executionId },
    })
  },
}
