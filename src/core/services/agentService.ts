import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { AgentEndpoints } from '@/core/composables/endpoints'
import type {
  AgentCredentialDto,
  AgentDefinitionDto,
  AgentEndpointCaptureDto,
  AgentExecutionDto,
  AgentExecutionPromptSnapshotDto,
  AgentExecutionStatus,
  AgentExtractionEquipmentDto,
  AgentExtractionProfileDto,
  AgentExtractionFieldDto,
  AgentExtractionRouteDto,
  AgentPromptPreviewDto,
  AgentPromptPreviewRequest,
  AgentProviderDto,
  AgentScheduleDto,
  BrowserProfileDto,
  CreateAgentCredentialRequest,
  CreateAgentDefinitionRequest,
  CreateAgentExecutionRequest,
  CreateAgentExtractionProfileRequest,
  CreateAgentProviderRequest,
  CreateAgentScheduleRequest,
  CreateBrowserProfileRequest,
  SaveAgentEndpointCaptureRequest,
  SaveAgentExtractionEquipmentRequest,
  SaveAgentExtractionFieldRequest,
  SaveAgentExtractionRouteRequest,
  TestAgentEndpointCaptureRequest,
  TestAgentEndpointCaptureResponse,
  UpdateAgentCredentialRequest,
  UpdateAgentExtractionProfileRequest,
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

async function createOne<TRequest>(
  endpoint: { method: 'POST'; path: string; headers?: Record<string, string>; baseUrl?: string },
  payload: TRequest,
  params?: Record<string, string>,
): Promise<string> {
  const response = await callEndpoint<unknown, TRequest>(endpoint, {
    ...(params ? { params } : {}),
    body: payload,
  })
  return unwrapApiResponse<string>(response as never)
}

const providers = {
  browse(): Promise<AgentProviderDto[]> {
    return browseList<AgentProviderDto>(AgentEndpoints.browseProviders)
  },

  get(providerId: string): Promise<AgentProviderDto> {
    return getOne<AgentProviderDto>(AgentEndpoints.getProvider, { providerId })
  },

  create(payload: CreateAgentProviderRequest): Promise<string> {
    return createOne(AgentEndpoints.createProvider, payload)
  },

  update(providerId: string, payload: UpdateAgentProviderRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentProviderRequest>(AgentEndpoints.updateProvider, {
      params: { providerId },
      body: payload,
    })
  },

  setActive(providerId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setProviderActive, {
      params: { providerId },
      body: { isActive },
    })
  },
}

const definitions = {
  browse(providerId?: string): Promise<AgentDefinitionDto[]> {
    return browseList<AgentDefinitionDto>(
      AgentEndpoints.browseDefinitions,
      providerId ? { providerId } : undefined,
    )
  },

  get(definitionId: string): Promise<AgentDefinitionDto> {
    return getOne<AgentDefinitionDto>(AgentEndpoints.getDefinition, { definitionId })
  },

  create(payload: CreateAgentDefinitionRequest): Promise<string> {
    return createOne(AgentEndpoints.createDefinition, payload)
  },

  update(definitionId: string, payload: UpdateAgentDefinitionRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentDefinitionRequest>(AgentEndpoints.updateDefinition, {
      params: { definitionId },
      body: payload,
    })
  },

  setActive(definitionId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setDefinitionActive, {
      params: { definitionId },
      body: { isActive },
    })
  },
}

const credentials = {
  browse(providerId?: string): Promise<AgentCredentialDto[]> {
    return browseList<AgentCredentialDto>(
      AgentEndpoints.browseCredentials,
      providerId ? { providerId } : undefined,
    )
  },

  get(credentialId: string): Promise<AgentCredentialDto> {
    return getOne<AgentCredentialDto>(AgentEndpoints.getCredential, { credentialId })
  },

  create(payload: CreateAgentCredentialRequest): Promise<string> {
    return createOne(AgentEndpoints.createCredential, payload)
  },

  update(credentialId: string, payload: UpdateAgentCredentialRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentCredentialRequest>(AgentEndpoints.updateCredential, {
      params: { credentialId },
      body: payload,
    })
  },

  setActive(credentialId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setCredentialActive, {
      params: { credentialId },
      body: { isActive },
    })
  },

  verify(credentialId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.verifyCredential, {
      params: { credentialId },
    })
  },
}

const profiles = {
  contractAvailable: true as const,

  browse(): Promise<AgentExtractionProfileDto[]> {
    return browseList<AgentExtractionProfileDto>(AgentEndpoints.browseExtractionProfiles)
  },

  get(profileId: string): Promise<AgentExtractionProfileDto> {
    return getOne<AgentExtractionProfileDto>(AgentEndpoints.getExtractionProfile, { profileId })
  },

  create(payload: CreateAgentExtractionProfileRequest): Promise<string> {
    return createOne(AgentEndpoints.createExtractionProfile, payload)
  },

  update(profileId: string, payload: UpdateAgentExtractionProfileRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentExtractionProfileRequest>(
      AgentEndpoints.updateExtractionProfile,
      {
        params: { profileId },
        body: payload,
      },
    )
  },

  setActive(profileId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(
      AgentEndpoints.setExtractionProfileActive,
      {
        params: { profileId },
        body: { isActive },
      },
    )
  },

  delete(profileId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.deleteExtractionProfile, {
      params: { profileId },
    })
  },
}

const routes = {
  browse(profileId: string): Promise<AgentExtractionRouteDto[]> {
    return browseList<AgentExtractionRouteDto>({
      ...AgentEndpoints.browseExtractionRoutes,
      path: AgentEndpoints.browseExtractionRoutes.path.replace('{{profileId}}', profileId),
    })
  },

  create(profileId: string, payload: SaveAgentExtractionRouteRequest): Promise<string> {
    return createOne(AgentEndpoints.createExtractionRoute, payload, { profileId })
  },

  update(
    profileId: string,
    routeId: string,
    payload: SaveAgentExtractionRouteRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, SaveAgentExtractionRouteRequest>(
      AgentEndpoints.updateExtractionRoute,
      {
        params: { profileId, routeId },
        body: payload,
      },
    )
  },

  delete(profileId: string, routeId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.deleteExtractionRoute, {
      params: { profileId, routeId },
    })
  },
}

const equipment = {
  browse(profileId: string): Promise<AgentExtractionEquipmentDto[]> {
    return browseList<AgentExtractionEquipmentDto>({
      ...AgentEndpoints.browseExtractionEquipment,
      path: AgentEndpoints.browseExtractionEquipment.path.replace('{{profileId}}', profileId),
    })
  },

  create(profileId: string, payload: SaveAgentExtractionEquipmentRequest): Promise<string> {
    return createOne(AgentEndpoints.createExtractionEquipment, payload, { profileId })
  },

  update(
    profileId: string,
    equipmentId: string,
    payload: SaveAgentExtractionEquipmentRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, SaveAgentExtractionEquipmentRequest>(
      AgentEndpoints.updateExtractionEquipment,
      {
        params: { profileId, equipmentId },
        body: payload,
      },
    )
  },

  delete(profileId: string, equipmentId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.deleteExtractionEquipment, {
      params: { profileId, equipmentId },
    })
  },
}

const captures = {
  browse(profileId: string): Promise<AgentEndpointCaptureDto[]> {
    return browseList<AgentEndpointCaptureDto>({
      ...AgentEndpoints.browseEndpointCaptures,
      path: AgentEndpoints.browseEndpointCaptures.path.replace('{{profileId}}', profileId),
    })
  },

  create(profileId: string, payload: SaveAgentEndpointCaptureRequest): Promise<string> {
    return createOne(AgentEndpoints.createEndpointCapture, payload, { profileId })
  },

  update(
    profileId: string,
    captureId: string,
    payload: SaveAgentEndpointCaptureRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, SaveAgentEndpointCaptureRequest>(
      AgentEndpoints.updateEndpointCapture,
      {
        params: { profileId, captureId },
        body: payload,
      },
    )
  },

  delete(profileId: string, captureId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.deleteEndpointCapture, {
      params: { profileId, captureId },
    })
  },

  async test(
    profileId: string,
    captureId: string,
    payload: TestAgentEndpointCaptureRequest,
  ): Promise<TestAgentEndpointCaptureResponse> {
    const response = await callEndpoint<unknown, TestAgentEndpointCaptureRequest>(
      AgentEndpoints.testEndpointCapture,
      {
        params: { profileId, captureId },
        body: payload,
      },
    )
    return unwrapApiResponse<TestAgentEndpointCaptureResponse>(response as never)
  },
}

const fields = {
  browse(profileId: string): Promise<AgentExtractionFieldDto[]> {
    return browseList<AgentExtractionFieldDto>({
      ...AgentEndpoints.browseExtractionFields,
      path: AgentEndpoints.browseExtractionFields.path.replace('{{profileId}}', profileId),
    })
  },

  create(profileId: string, payload: SaveAgentExtractionFieldRequest): Promise<string> {
    return createOne(AgentEndpoints.createExtractionField, payload, { profileId })
  },

  update(
    profileId: string,
    fieldId: string,
    payload: SaveAgentExtractionFieldRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, SaveAgentExtractionFieldRequest>(
      AgentEndpoints.updateExtractionField,
      {
        params: { profileId, fieldId },
        body: payload,
      },
    )
  },

  delete(profileId: string, fieldId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.deleteExtractionField, {
      params: { profileId, fieldId },
    })
  },
}

const prompts = {
  async preview(
    profileId: string,
    payload: AgentPromptPreviewRequest,
  ): Promise<AgentPromptPreviewDto> {
    const response = await callEndpoint<unknown, AgentPromptPreviewRequest>(
      AgentEndpoints.previewExtractionPrompt,
      {
        params: { profileId },
        body: payload,
      },
    )
    return unwrapApiResponse<AgentPromptPreviewDto>(response as never)
  },
}

const browserProfiles = {
  browse(providerId?: string): Promise<BrowserProfileDto[]> {
    return browseList<BrowserProfileDto>(
      AgentEndpoints.browseBrowserProfiles,
      providerId ? { providerId } : undefined,
    )
  },

  get(profileId: string): Promise<BrowserProfileDto> {
    return getOne<BrowserProfileDto>(AgentEndpoints.getBrowserProfile, { profileId })
  },

  create(payload: CreateBrowserProfileRequest): Promise<string> {
    return createOne(AgentEndpoints.createBrowserProfile, payload)
  },

  authenticate(profileId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.authenticateBrowserProfile, {
      params: { profileId },
    })
  },
}

const schedules = {
  browse(): Promise<AgentScheduleDto[]> {
    return browseList<AgentScheduleDto>(AgentEndpoints.browseSchedules)
  },

  get(scheduleId: string): Promise<AgentScheduleDto> {
    return getOne<AgentScheduleDto>(AgentEndpoints.getSchedule, { scheduleId })
  },

  create(payload: CreateAgentScheduleRequest): Promise<string> {
    return createOne(AgentEndpoints.createSchedule, payload)
  },

  update(scheduleId: string, payload: UpdateAgentScheduleRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAgentScheduleRequest>(AgentEndpoints.updateSchedule, {
      params: { scheduleId },
      body: payload,
    })
  },

  setActive(scheduleId: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AgentEndpoints.setScheduleActive, {
      params: { scheduleId },
      body: { isActive },
    })
  },

  async run(scheduleId: string): Promise<string> {
    const response = await callEndpoint<unknown>(AgentEndpoints.runSchedule, {
      params: { scheduleId },
    })
    return unwrapApiResponse<string>(response as never)
  },
}

const executions = {
  browse(take = 100, status?: AgentExecutionStatus): Promise<AgentExecutionDto[]> {
    return browseList<AgentExecutionDto>(AgentEndpoints.browseAgentExecutions, {
      take,
      ...(status ? { status } : {}),
    })
  },

  get(executionId: string): Promise<AgentExecutionDto> {
    return getOne<AgentExecutionDto>(AgentEndpoints.getAgentExecution, { executionId })
  },

  async getPrompt(executionId: string): Promise<AgentExecutionPromptSnapshotDto> {
    const response = await callEndpoint<unknown>(AgentEndpoints.getAgentExecutionPrompt, {
      params: { executionId },
    })
    return unwrapApiResponse<AgentExecutionPromptSnapshotDto>(response as never)
  },

  create(payload: CreateAgentExecutionRequest): Promise<string> {
    return createOne(AgentEndpoints.createAgentExecution, payload)
  },

  cancel(executionId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AgentEndpoints.cancelAgentExecution, {
      params: { executionId },
    })
  },
}

export const AgentService = {
  async checkHealth(): Promise<boolean> {
    await callEndpoint<unknown>(AgentEndpoints.agentHealth)
    return true
  },

  profiles,
  providers,
  definitions,
  credentials,
  routes,
  equipment,
  captures,
  fields,
  prompts,
  browserProfiles,
  schedules,
  executions,

  // Compatibility aliases used by the legacy Agent screens while the module is
  // progressively migrated to the profile-first API above.
  browseProviders: providers.browse,
  getProvider: providers.get,
  createProvider: providers.create,
  updateProvider: providers.update,
  setProviderActive: providers.setActive,

  browseDefinitions: definitions.browse,
  getDefinition: definitions.get,
  createDefinition: definitions.create,
  updateDefinition: definitions.update,
  setDefinitionActive: definitions.setActive,

  browseCredentials: credentials.browse,
  getCredential: credentials.get,
  createCredential: credentials.create,
  updateCredential: credentials.update,
  setCredentialActive: credentials.setActive,
  verifyCredential: credentials.verify,

  browseBrowserProfiles: browserProfiles.browse,
  getBrowserProfile: browserProfiles.get,
  createBrowserProfile: browserProfiles.create,
  authenticateBrowserProfile: browserProfiles.authenticate,

  browseSchedules: schedules.browse,
  getSchedule: schedules.get,
  createSchedule: schedules.create,
  updateSchedule: schedules.update,
  setScheduleActive: schedules.setActive,
  runSchedule: schedules.run,

  browseExecutions: executions.browse,
  getExecution: executions.get,
  getExecutionPrompt: executions.getPrompt,
  createExecution: executions.create,
  cancelExecution: executions.cancel,
}
