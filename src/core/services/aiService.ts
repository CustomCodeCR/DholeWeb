import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { AiEndpoints } from '@/core/composables/endpoints'
import type {
  AiChatResultDto,
  AiConnectionDto,
  AiConnectionSummaryDto,
  AiConnectionTestResultDto,
  AiEmbeddingsResultDto,
  AiExecutionDto,
  AiExecutionSummaryDto,
  AiModelDto,
  AiModelSummaryDto,
  AiProfileDto,
  AiProfileSummaryDto,
  AiPromptTemplateDto,
  AiPromptTemplateSummaryDto,
  AiStructuredResultDto,
  BrowseAiConnectionsQuery,
  BrowseAiExecutionsQuery,
  BrowseAiModelsQuery,
  BrowseAiProfilesQuery,
  BrowseAiPromptTemplatesQuery,
  CreateAiConnectionRequest,
  CreateAiModelRequest,
  CreateAiProfileRequest,
  CreateAiPromptTemplateRequest,
  DiscoveredAiModelDto,
  ExecuteAiChatRequest,
  ExecuteAiEmbeddingsRequest,
  ExecuteAiStructuredRequest,
  UpdateAiConnectionRequest,
  UpdateAiModelRequest,
  UpdateAiProfileRequest,
  UpdateAiPromptTemplateRequest,
} from '@/core/interfaces/ai'

type NoContent = Record<string, never>

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

async function browse<T>(
  endpoint: { method: 'GET'; path: string; headers?: Record<string, string> },
  query?: object,
) {
  const queryRecord = query ? (Object.assign({}, query) as Record<string, unknown>) : undefined
  const response = await callEndpoint<unknown>({
    ...endpoint,
    path: withQuery(endpoint.path, queryRecord),
  })
  return unwrapPagedResponse<T>(response)
}

export const AiService = {
  browseConnections(query?: BrowseAiConnectionsQuery): Promise<PagedResponse<AiConnectionSummaryDto>> {
    return browse<AiConnectionSummaryDto>(AiEndpoints.browseConnections, query)
  },
  async getConnection(id: string): Promise<AiConnectionDto> {
    const response = await callEndpoint<unknown>(AiEndpoints.getConnection, { params: { connectionId: id } })
    return unwrapApiResponse<AiConnectionDto>(response as never)
  },
  async createConnection(payload: CreateAiConnectionRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAiConnectionRequest>(AiEndpoints.createConnection, { body: payload })
    return unwrapApiResponse<string>(response as never)
  },
  updateConnection(id: string, payload: UpdateAiConnectionRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAiConnectionRequest>(AiEndpoints.updateConnection, { params: { connectionId: id }, body: payload })
  },
  setConnectionActive(id: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AiEndpoints.setConnectionActive, { params: { connectionId: id }, body: { isActive } })
  },
  deleteConnection(id: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AiEndpoints.deleteConnection, { params: { connectionId: id } })
  },
  async testConnection(id: string): Promise<AiConnectionTestResultDto> {
    const response = await callEndpoint<unknown>(AiEndpoints.testConnection, { params: { connectionId: id } })
    return unwrapApiResponse<AiConnectionTestResultDto>(response as never)
  },
  async discoverModels(id: string): Promise<DiscoveredAiModelDto[]> {
    const response = await callEndpoint<unknown>(AiEndpoints.discoverModels, { params: { connectionId: id } })
    return unwrapApiResponse<DiscoveredAiModelDto[]>(response as never)
  },

  browseModels(query?: BrowseAiModelsQuery): Promise<PagedResponse<AiModelSummaryDto>> {
    return browse<AiModelSummaryDto>(AiEndpoints.browseModels, query)
  },
  async getModel(id: string): Promise<AiModelDto> {
    const response = await callEndpoint<unknown>(AiEndpoints.getModel, { params: { modelId: id } })
    return unwrapApiResponse<AiModelDto>(response as never)
  },
  async createModel(payload: CreateAiModelRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAiModelRequest>(AiEndpoints.createModel, { body: payload })
    return unwrapApiResponse<string>(response as never)
  },
  updateModel(id: string, payload: UpdateAiModelRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAiModelRequest>(AiEndpoints.updateModel, { params: { modelId: id }, body: payload })
  },
  setModelActive(id: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AiEndpoints.setModelActive, { params: { modelId: id }, body: { isActive } })
  },
  deleteModel(id: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AiEndpoints.deleteModel, { params: { modelId: id } })
  },

  browseProfiles(query?: BrowseAiProfilesQuery): Promise<PagedResponse<AiProfileSummaryDto>> {
    return browse<AiProfileSummaryDto>(AiEndpoints.browseProfiles, query)
  },
  async getProfile(id: string): Promise<AiProfileDto> {
    const response = await callEndpoint<unknown>(AiEndpoints.getProfile, { params: { profileId: id } })
    return unwrapApiResponse<AiProfileDto>(response as never)
  },
  async createProfile(payload: CreateAiProfileRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAiProfileRequest>(AiEndpoints.createProfile, { body: payload })
    return unwrapApiResponse<string>(response as never)
  },
  updateProfile(id: string, payload: UpdateAiProfileRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAiProfileRequest>(AiEndpoints.updateProfile, { params: { profileId: id }, body: payload })
  },
  configureProfileModels(id: string, models: CreateAiProfileRequest['models']): Promise<NoContent> {
    return callEndpoint<NoContent, { models: CreateAiProfileRequest['models'] }>(AiEndpoints.configureProfileModels, { params: { profileId: id }, body: { models } })
  },
  setProfileActive(id: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AiEndpoints.setProfileActive, { params: { profileId: id }, body: { isActive } })
  },
  deleteProfile(id: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AiEndpoints.deleteProfile, { params: { profileId: id } })
  },

  browsePromptTemplates(query?: BrowseAiPromptTemplatesQuery): Promise<PagedResponse<AiPromptTemplateSummaryDto>> {
    return browse<AiPromptTemplateSummaryDto>(AiEndpoints.browsePromptTemplates, query)
  },
  async getPromptTemplate(id: string): Promise<AiPromptTemplateDto> {
    const response = await callEndpoint<unknown>(AiEndpoints.getPromptTemplate, { params: { promptTemplateId: id } })
    return unwrapApiResponse<AiPromptTemplateDto>(response as never)
  },
  async createPromptTemplate(payload: CreateAiPromptTemplateRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateAiPromptTemplateRequest>(AiEndpoints.createPromptTemplate, { body: payload })
    return unwrapApiResponse<string>(response as never)
  },
  updatePromptTemplate(id: string, payload: UpdateAiPromptTemplateRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateAiPromptTemplateRequest>(AiEndpoints.updatePromptTemplate, { params: { promptTemplateId: id }, body: payload })
  },
  setPromptTemplateActive(id: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(AiEndpoints.setPromptTemplateActive, { params: { promptTemplateId: id }, body: { isActive } })
  },
  deletePromptTemplate(id: string): Promise<NoContent> {
    return callEndpoint<NoContent>(AiEndpoints.deletePromptTemplate, { params: { promptTemplateId: id } })
  },

  async executeChat(payload: ExecuteAiChatRequest): Promise<AiChatResultDto> {
    const response = await callEndpoint<unknown, ExecuteAiChatRequest>(AiEndpoints.executeChat, { body: payload })
    return unwrapApiResponse<AiChatResultDto>(response as never)
  },
  async executeStructured(payload: ExecuteAiStructuredRequest): Promise<AiStructuredResultDto> {
    const response = await callEndpoint<unknown, ExecuteAiStructuredRequest>(AiEndpoints.executeStructured, { body: payload })
    return unwrapApiResponse<AiStructuredResultDto>(response as never)
  },
  async executeEmbeddings(payload: ExecuteAiEmbeddingsRequest): Promise<AiEmbeddingsResultDto> {
    const response = await callEndpoint<unknown, ExecuteAiEmbeddingsRequest>(AiEndpoints.executeEmbeddings, { body: payload })
    return unwrapApiResponse<AiEmbeddingsResultDto>(response as never)
  },
  browseExecutions(query?: BrowseAiExecutionsQuery): Promise<PagedResponse<AiExecutionSummaryDto>> {
    return browse<AiExecutionSummaryDto>(AiEndpoints.browseExecutions, query)
  },
  async getExecution(id: string): Promise<AiExecutionDto> {
    const response = await callEndpoint<unknown>(AiEndpoints.getExecution, { params: { executionId: id } })
    return unwrapApiResponse<AiExecutionDto>(response as never)
  },
  cancelExecution(id: string, reason: string | null): Promise<NoContent> {
    return callEndpoint<NoContent, { reason: string | null }>(AiEndpoints.cancelExecution, { params: { executionId: id }, body: { reason } })
  },
}
