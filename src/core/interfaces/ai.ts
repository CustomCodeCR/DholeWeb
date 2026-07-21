export type AiProviderType = 'OpenAI' | 'Gemini' | 'Ollama' | 'OpenAICompatible'
export type AiConnectionStatus = 'Unknown' | 'Healthy' | 'Unhealthy'
export type AiModelStatus = 'Unknown' | 'Available' | 'Unavailable'
export type AiModelCapability =
  | 'Chat'
  | 'StructuredOutput'
  | 'Embeddings'
  | 'Vision'
  | 'Streaming'
  | 'ToolCalling'
export type AiRoutingMode = 'Fixed' | 'PriorityFallback' | 'LocalFirst' | 'LowestCost'
export type AiResponseFormat = 'Text' | 'Json' | 'JsonSchema'
export type AiExecutionType = 'Chat' | 'Structured' | 'Embeddings'
export type AiExecutionStatus = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled'

export interface BrowseAiQuery {
  pageNumber?: number
  pageSize?: number
  search?: string
  isActive?: boolean
}

export interface BrowseAiConnectionsQuery extends BrowseAiQuery {
  providerType?: AiProviderType
  status?: AiConnectionStatus
}

export interface AiConnectionSummaryDto {
  id: string
  name: string
  providerType: AiProviderType
  baseUrl: string
  status: AiConnectionStatus
  lastHealthCheckAtUtc: string | null
  isActive: boolean
}

export interface AiConnectionDto extends AiConnectionSummaryDto {
  secretReference: string | null
  timeoutSeconds: number
  lastHealthError: string | null
}

export interface CreateAiConnectionRequest {
  name: string
  providerType: AiProviderType
  baseUrl: string
  secretReference: string | null
  timeoutSeconds: number
}

export type UpdateAiConnectionRequest = CreateAiConnectionRequest

export interface AiConnectionTestResultDto {
  connectionId: string
  success: boolean
  status: AiConnectionStatus
  durationMilliseconds: number
  checkedAtUtc: string
  errorCode: string | null
  errorMessage: string | null
}

export interface DiscoveredAiModelDto {
  externalModelId: string
  name: string
  capabilities: AiModelCapability[]
  contextWindow: number | null
  maximumOutputTokens: number | null
  isLocal: boolean
  isRegistered: boolean
  registeredModelId: string | null
}

export interface BrowseAiModelsQuery extends BrowseAiQuery {
  connectionId?: string
  providerType?: AiProviderType
  capability?: AiModelCapability
  status?: AiModelStatus
  isLocal?: boolean
}

export interface AiModelSummaryDto {
  id: string
  connectionId: string
  connectionName: string
  providerType: AiProviderType
  externalModelId: string
  name: string
  capabilities: AiModelCapability[]
  isLocal: boolean
  status: AiModelStatus
  isActive: boolean
}

export interface AiModelDto extends AiModelSummaryDto {
  contextWindow: number | null
  maximumOutputTokens: number | null
  inputCostPerMillionTokens: number | null
  outputCostPerMillionTokens: number | null
  lastAvailabilityCheckAtUtc: string | null
  lastAvailabilityError: string | null
}

export interface CreateAiModelRequest {
  connectionId: string
  externalModelId: string
  name: string
  capabilities: AiModelCapability[]
  contextWindow: number | null
  maximumOutputTokens: number | null
  inputCostPerMillionTokens: number | null
  outputCostPerMillionTokens: number | null
  isLocal: boolean
}

export type UpdateAiModelRequest = CreateAiModelRequest

export interface AiProfileModelRequest {
  modelId: string
  priority: number
  isFallback: boolean
}

export interface AiProfileModelDto extends AiProfileModelRequest {
  id: string
  modelName: string
  externalModelId: string
  connectionId: string
  connectionName: string
  providerType: AiProviderType
  capabilities: AiModelCapability[]
  isModelActive: boolean
}

export interface BrowseAiProfilesQuery extends BrowseAiQuery {
  routingMode?: AiRoutingMode
  responseFormat?: AiResponseFormat
}

export interface AiProfileSummaryDto {
  id: string
  key: string
  name: string
  description: string | null
  routingMode: AiRoutingMode
  responseFormat: AiResponseFormat
  modelCount: number
  isActive: boolean
}

export interface AiProfileDto extends Omit<AiProfileSummaryDto, 'modelCount'> {
  promptTemplateId: string | null
  promptTemplateName: string | null
  temperature: number
  maximumOutputTokens: number
  timeoutSeconds: number
  jsonSchema: string | null
  models: AiProfileModelDto[]
}

export interface CreateAiProfileRequest {
  key: string
  name: string
  description: string | null
  promptTemplateId: string | null
  routingMode: AiRoutingMode
  responseFormat: AiResponseFormat
  temperature: number
  maximumOutputTokens: number
  timeoutSeconds: number
  jsonSchema: string | null
  models: AiProfileModelRequest[]
}

export type UpdateAiProfileRequest = Omit<CreateAiProfileRequest, 'models'>

export interface BrowseAiPromptTemplatesQuery extends BrowseAiQuery {}

export interface AiPromptTemplateSummaryDto {
  id: string
  key: string
  name: string
  description: string | null
  variableCount: number
  isActive: boolean
}

export interface AiPromptTemplateDto extends Omit<AiPromptTemplateSummaryDto, 'variableCount'> {
  systemPrompt: string | null
  userPromptTemplate: string | null
  variables: string[]
}

export interface CreateAiPromptTemplateRequest {
  key: string
  name: string
  description: string | null
  systemPrompt: string | null
  userPromptTemplate: string | null
  variables: string[]
}

export type UpdateAiPromptTemplateRequest = CreateAiPromptTemplateRequest

export interface AiMessageRequest {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiPromptVariableRequest {
  name: string
  value: string
}

export interface ExecuteAiChatRequest {
  profileKey: string
  messages: AiMessageRequest[]
  variables?: AiPromptVariableRequest[] | null
  correlationId?: string | null
  requestHash?: string | null
}

export interface ExecuteAiStructuredRequest extends ExecuteAiChatRequest {
  jsonSchemaOverride?: string | null
}

export interface ExecuteAiEmbeddingsRequest {
  profileKey: string
  inputs: string[]
  correlationId?: string | null
  requestHash?: string | null
}

export interface AiTokenUsageDto {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface AiExecutionResultBase {
  executionId: string
  connectionId: string
  connectionName: string
  modelId: string
  modelName: string
  externalModelId: string
  providerType: AiProviderType
  estimatedCost: number
  durationMilliseconds: number
}

export interface AiChatResultDto extends AiExecutionResultBase {
  content: string
  tokenUsage: AiTokenUsageDto
  finishReason: string
}

export interface AiStructuredResultDto extends AiExecutionResultBase {
  jsonContent: string
  tokenUsage: AiTokenUsageDto
  finishReason: string
}

export interface AiEmbeddingsResultDto extends AiExecutionResultBase {
  embeddings: number[][]
  dimensions: number
  inputTokens: number
}

export interface BrowseAiExecutionsQuery extends BrowseAiQuery {
  profileKey?: string
  executionType?: AiExecutionType
  status?: AiExecutionStatus
  providerType?: AiProviderType
  modelId?: string
  dateFromUtc?: string
  dateToUtc?: string
}

export interface AiExecutionSummaryDto {
  id: string
  profileKey: string
  profileName: string
  executionType: AiExecutionType
  status: AiExecutionStatus
  providerType: AiProviderType | null
  modelName: string | null
  tokenUsage: AiTokenUsageDto
  estimatedCost: number
  durationMilliseconds: number
  startedAtUtc: string | null
  completedAtUtc: string | null
  errorCode: string | null
}

export interface AiExecutionAttemptDto {
  id: string
  attemptNumber: number
  connectionId: string
  connectionName: string
  modelId: string
  modelName: string
  providerType: AiProviderType
  externalModelId: string
  status: string
  startedAtUtc: string
  completedAtUtc: string | null
  tokenUsage: AiTokenUsageDto
  estimatedCost: number
  durationMilliseconds: number
  finishReason: string
  errorCode: string | null
  errorMessage: string | null
}

export interface AiExecutionDto extends AiExecutionSummaryDto {
  profileId: string
  promptTemplateId: string | null
  promptTemplateName: string | null
  correlationId: string | null
  requestHash: string | null
  outputReference: string | null
  selectedConnectionId: string | null
  selectedConnectionName: string | null
  selectedModelId: string | null
  selectedExternalModelId: string | null
  selectedProviderType: AiProviderType | null
  finishReason: string
  errorMessage: string | null
  cancelledAtUtc: string | null
  cancellationReason: string | null
  attempts: AiExecutionAttemptDto[]
}
