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
} from '@/core/interfaces/agent'

type NoContent = Record<string, never>

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

async function browseList<T>(
  endpoint: { method: 'GET'; path: string; headers?: Record<string, string> },
  query?: Record<string, unknown>,
): Promise<T[]> {
  const response = await callEndpoint<unknown>({
    ...endpoint,
    path: withQuery(endpoint.path, query),
  })
  return unwrapListResponse<T>(response)
}

export const AgentService = {
  browseProviders(): Promise<AgentProviderDto[]> {
    return browseList<AgentProviderDto>(AgentEndpoints.browseProviders)
  },

  async createProvider(payload: CreateAgentProviderRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentProviderRequest>(
      AgentEndpoints.createProvider,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
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

  async createDefinition(payload: CreateAgentDefinitionRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentDefinitionRequest>(
      AgentEndpoints.createDefinition,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
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

  browseBrowserProfiles(providerId?: string): Promise<BrowserProfileDto[]> {
    return browseList<BrowserProfileDto>(
      AgentEndpoints.browseBrowserProfiles,
      providerId ? { providerId } : undefined,
    )
  },

  authenticateBrowserProfile(profileId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.authenticateBrowserProfile, {
      params: { profileId },
    })
  },

  browseSchedules(): Promise<AgentScheduleDto[]> {
    return browseList<AgentScheduleDto>(AgentEndpoints.browseSchedules)
  },

  async createSchedule(payload: CreateAgentScheduleRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAgentScheduleRequest>(
      AgentEndpoints.createSchedule,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
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
