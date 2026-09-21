export type AgentProviderType =
  | 'Maersk'
  | 'Msc'
  | 'Pil'
  | 'CmaCgm'
  | 'HapagLloyd'
  | 'GenericWeb'

export type AgentExecutionStrategy = 'Browser' | 'BrowserNetworkCapture' | 'Hermes' | 'Hybrid'
export type AgentActionType = 'SearchOceanRates' | 'Authenticate' | 'GenericExtraction'
export type AgentScheduleType = 'Once' | 'Interval' | 'Cron'
export type AgentExecutionStatus =
  | 'Pending'
  | 'Queued'
  | 'Running'
  | 'WaitingForAuthentication'
  | 'Completed'
  | 'PartiallyCompleted'
  | 'Failed'
  | 'Cancelled'

export interface AgentProviderDto {
  id: string
  code: string
  name: string
  providerType: AgentProviderType
  baseUrl: string | null
  defaultExecutionStrategy: AgentExecutionStrategy
  isSystem: boolean
  isActive: boolean
  metadataJson: string | null
  createdAtUtc: string
  updatedAtUtc: string | null
}

export interface AgentDefinitionDto {
  id: string
  providerId: string
  code: string
  name: string
  description: string | null
  actionType: AgentActionType
  executionStrategy: AgentExecutionStrategy
  configurationJson: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string | null
}

export interface AgentCredentialDto {
  id: string
  providerId: string
  name: string
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string | null
}

export interface BrowserProfileDto {
  id: string
  providerId: string
  credentialId: string
  name: string
  profileKey: string
  storagePath: string
  status: string
  lastLoginAt: string | null
  lastUsedAt: string | null
  sessionExpiresAt: string | null
  isActive: boolean
}

export interface AgentScheduleDto {
  id: string
  name: string
  agentDefinitionId: string
  providerId: string
  credentialId: string | null
  scheduleType: AgentScheduleType
  cronExpression: string | null
  intervalMinutes: number | null
  executeAt: string | null
  timezone: string
  inputJson: string
  isActive: boolean
  lastExecutionAt: string | null
  nextExecutionAt: string | null
  maxRetries: number
  timeoutSeconds: number
}

export interface AgentExecutionDto {
  id: string
  agentDefinitionId: string
  providerId: string
  scheduleId: string | null
  credentialId: string | null
  executionType: string
  status: AgentExecutionStatus
  priority: number
  inputJson: string
  outputJson: string | null
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  attempt: number
  maxAttempts: number
  errorCode: string | null
  errorMessage: string | null
  correlationId: string
  traceId: string | null
  createdAtUtc: string
}

export interface CreateAgentProviderRequest {
  code: string
  name: string
  providerType: AgentProviderType
  baseUrl: string | null
  defaultExecutionStrategy: AgentExecutionStrategy
  isSystem: boolean
  metadataJson: string | null
}

export interface CreateAgentDefinitionRequest {
  providerId: string
  code: string
  name: string
  description: string | null
  actionType: AgentActionType
  executionStrategy: AgentExecutionStrategy
  configurationJson: string | null
}

export interface CreateAgentCredentialRequest {
  providerId: string
  name: string
  usernameSecretKey: string
  passwordSecretKey: string
  additionalSecretsJson: string | null
}

export interface CreateAgentExecutionRequest {
  agentDefinitionId: string
  providerId: string
  credentialId: string | null
  priority: number
  inputJson: string
  maxAttempts: number
  correlationId: string | null
  traceId: string | null
}

export interface CreateAgentScheduleRequest {
  name: string
  agentDefinitionId: string
  providerId: string
  credentialId: string | null
  scheduleType: AgentScheduleType
  cronExpression: string | null
  intervalMinutes: number | null
  executeAt: string | null
  timezone: string
  inputJson: string
  maxRetries: number
  timeoutSeconds: number
}

export interface UpdateAgentProviderRequest {
  name: string
  providerType: AgentProviderType
  baseUrl: string | null
  defaultExecutionStrategy: AgentExecutionStrategy
  metadataJson: string | null
}

export interface UpdateAgentDefinitionRequest {
  name: string
  description: string | null
  actionType: AgentActionType
  executionStrategy: AgentExecutionStrategy
  configurationJson: string | null
}

export interface UpdateAgentCredentialRequest {
  name: string
  usernameSecretKey: string
  passwordSecretKey: string
  additionalSecretsJson: string | null
}

export interface CreateBrowserProfileRequest {
  providerId: string
  credentialId: string
  name: string
  profileKey: string
  storagePath: string
}

export interface UpdateAgentScheduleRequest {
  name: string
  credentialId: string | null
  scheduleType: AgentScheduleType
  cronExpression: string | null
  intervalMinutes: number | null
  executeAt: string | null
  timezone: string
  inputJson: string
  maxRetries: number
  timeoutSeconds: number
  nextExecutionAt: string | null
}

export const AGENT_PROVIDER_TYPES = ['Maersk', 'Msc', 'Pil', 'CmaCgm', 'HapagLloyd', 'GenericWeb'] as const
export const AGENT_EXECUTION_STRATEGIES = ['Browser', 'BrowserNetworkCapture', 'Hermes', 'Hybrid'] as const
export const AGENT_ACTION_TYPES = ['SearchOceanRates', 'Authenticate', 'GenericExtraction'] as const
export const AGENT_SCHEDULE_TYPES = ['Once', 'Interval', 'Cron'] as const
export const AGENT_EXECUTION_STATUSES = [
  'Pending',
  'Queued',
  'Running',
  'WaitingForAuthentication',
  'Completed',
  'PartiallyCompleted',
  'Failed',
  'Cancelled',
] as const

export type AgentBrowserProfileStatus =
  | 'Unknown'
  | 'Ready'
  | 'LoginRequired'
  | 'Authenticating'
  | 'Authenticated'
  | 'Expired'
  | 'Blocked'
  | 'Error'

export const AGENT_BROWSER_PROFILE_STATUSES = [
  'Unknown',
  'Ready',
  'LoginRequired',
  'Authenticating',
  'Authenticated',
  'Expired',
  'Blocked',
  'Error',
] as const

