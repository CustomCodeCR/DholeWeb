export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Endpoint {
  method: HttpMethod
  path: string
  headers?: Record<string, string>
  baseUrl?: string
}

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const acceptJson = {
  Accept: 'application/json',
}


export const AuthEndpoints = {
  login: { method: 'POST', path: '/api/auth/login', headers: jsonHeaders },
  refreshToken: { method: 'POST', path: '/api/auth/refresh', headers: jsonHeaders },
} satisfies Record<string, Endpoint>

export const ClientBrandingEndpoints = {
  getCurrentClientBranding: {
    method: 'GET',
    path: '/api/config/client-branding/current',
    headers: acceptJson,
  },
  getClientBranding: {
    method: 'GET',
    path: '/api/config/client-branding/clients/{{clientId}}',
    headers: acceptJson,
  },
  updateClientBranding: {
    method: 'PUT',
    path: '/api/config/client-branding/clients/{{clientId}}',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const UserEndpoints = {
  createUser: { method: 'POST', path: '/api/auth/users', headers: jsonHeaders },
  browseUsers: { method: 'GET', path: '/api/auth/users', headers: acceptJson },
  updateUser: { method: 'PUT', path: '/api/auth/users/{{userId}}', headers: jsonHeaders },
  deleteUser: { method: 'DELETE', path: '/api/auth/users/{{userId}}', headers: acceptJson },
  changeUserPassword: {
    method: 'PATCH',
    path: '/api/auth/users/{{userId}}/password',
    headers: jsonHeaders,
  },
  setUserActive: {
    method: 'PATCH',
    path: '/api/auth/users/{{userId}}/active',
    headers: jsonHeaders,
  },
  setUserLocked: {
    method: 'PATCH',
    path: '/api/auth/users/{{userId}}/locked',
    headers: jsonHeaders,
  },
  getUserRoles: { method: 'GET', path: '/api/auth/users/{{userId}}/roles', headers: acceptJson },
  assignRolesToUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/roles',
    headers: jsonHeaders,
  },
  revokeRolesFromUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/roles/revoke',
    headers: jsonHeaders,
  },
  getUserScopes: { method: 'GET', path: '/api/auth/users/{{userId}}/scopes', headers: acceptJson },
  assignScopesToUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/scopes',
    headers: jsonHeaders,
  },
  revokeScopesFromUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/scopes/revoke',
    headers: jsonHeaders,
  },
  getUserPermissions: {
    method: 'GET',
    path: '/api/auth/users/{{userId}}/permissions',
    headers: acceptJson,
  },
} satisfies Record<string, Endpoint>

export const RoleEndpoints = {
  createRole: { method: 'POST', path: '/api/auth/roles', headers: jsonHeaders },
  browseRoles: { method: 'GET', path: '/api/auth/roles', headers: acceptJson },
  selectRoles: { method: 'GET', path: '/api/auth/roles/select', headers: acceptJson },
  updateRole: { method: 'PUT', path: '/api/auth/roles/{{roleId}}', headers: jsonHeaders },
  deleteRole: { method: 'DELETE', path: '/api/auth/roles/{{roleId}}', headers: acceptJson },
  setRoleActive: {
    method: 'PATCH',
    path: '/api/auth/roles/{{roleId}}/active',
    headers: jsonHeaders,
  },
  getRoleScopes: { method: 'GET', path: '/api/auth/roles/{{roleId}}/scopes', headers: acceptJson },
  assignScopesToRole: {
    method: 'POST',
    path: '/api/auth/roles/{{roleId}}/scopes',
    headers: jsonHeaders,
  },
  revokeScopesFromRole: {
    method: 'POST',
    path: '/api/auth/roles/{{roleId}}/scopes/revoke',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const ScopeEndpoints = {
  selectScopes: { method: 'GET', path: '/api/auth/scopes/select', headers: acceptJson },
} satisfies Record<string, Endpoint>

export const SessionEndpoints = {
  getUserSessions: {
    method: 'GET',
    path: '/api/auth/sessions/users/{{userId}}',
    headers: acceptJson,
  },
  getActiveUserSessions: {
    method: 'GET',
    path: '/api/auth/sessions/users/{{userId}}/active',
    headers: acceptJson,
  },
  revokeSession: {
    method: 'PATCH',
    path: '/api/auth/sessions/{{sessionId}}/revoke',
    headers: jsonHeaders,
  },
  revokeUserSessions: {
    method: 'PATCH',
    path: '/api/auth/sessions/users/{{userId}}/revoke',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const CatalogGroupEndpoints = {
  createCatalogGroup: {
    method: 'POST',
    path: '/api/config/catalog-groups',
    headers: jsonHeaders,
  },
  browseCatalogGroups: {
    method: 'GET',
    path: '/api/config/catalog-groups',
    headers: acceptJson,
  },
  selectCatalogGroups: {
    method: 'GET',
    path: '/api/config/catalog-groups/select',
    headers: acceptJson,
  },
  getCatalogGroupById: {
    method: 'GET',
    path: '/api/config/catalog-groups/{{catalogGroupId}}',
    headers: acceptJson,
  },
  updateCatalogGroup: {
    method: 'PUT',
    path: '/api/config/catalog-groups/{{catalogGroupId}}',
    headers: jsonHeaders,
  },
  deleteCatalogGroup: {
    method: 'DELETE',
    path: '/api/config/catalog-groups/{{catalogGroupId}}',
    headers: acceptJson,
  },
  setCatalogGroupActive: {
    method: 'PATCH',
    path: '/api/config/catalog-groups/{{catalogGroupId}}/active',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const CatalogItemEndpoints = {
  createCatalogItem: {
    method: 'POST',
    path: '/api/config/catalog-items',
    headers: jsonHeaders,
  },
  createCatalogItemForGroup: {
    method: 'POST',
    path: '/api/config/catalog-items/catalog-groups/{{catalogGroupId}}',
    headers: jsonHeaders,
  },
  browseCatalogItems: {
    method: 'GET',
    path: '/api/config/catalog-items',
    headers: acceptJson,
  },
  selectCatalogItems: {
    method: 'GET',
    path: '/api/config/catalog-items/select',
    headers: acceptJson,
  },
  getCatalogItemsByGroupSlug: {
    method: 'GET',
    path: '/api/config/catalog-items/by-group/{{catalogGroupSlug}}',
    headers: acceptJson,
  },
  getCatalogItemById: {
    method: 'GET',
    path: '/api/config/catalog-items/{{catalogItemId}}',
    headers: acceptJson,
  },
  validateCatalogItem: {
    method: 'GET',
    path: '/api/config/catalog-items/validate',
    headers: acceptJson,
  },
  updateCatalogItem: {
    method: 'PUT',
    path: '/api/config/catalog-items/{{catalogItemId}}',
    headers: jsonHeaders,
  },
  deleteCatalogItem: {
    method: 'DELETE',
    path: '/api/config/catalog-items/{{catalogItemId}}',
    headers: acceptJson,
  },
  setCatalogItemActive: {
    method: 'PATCH',
    path: '/api/config/catalog-items/{{catalogItemId}}/active',
    headers: jsonHeaders,
  },
  changeCatalogItemSortOrder: {
    method: 'PATCH',
    path: '/api/config/catalog-items/{{catalogItemId}}/sort-order',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const AuditLogsEndpoints = {
  browseAuditEvents: {
    method: 'GET',
    path: '/api/auditlogs/events',
    headers: acceptJson,
  },
  getAuditEventById: {
    method: 'GET',
    path: '/api/auditlogs/events/{{auditEventId}}',
    headers: acceptJson,
  },
  getAuditEventSummary: {
    method: 'GET',
    path: '/api/auditlogs/events/summary',
    headers: acceptJson,
  },
  getEntityHistory: {
    method: 'GET',
    path: '/api/auditlogs/events/entity-history',
    headers: acceptJson,
  },
  getUserHistory: {
    method: 'GET',
    path: '/api/auditlogs/events/user-history/{{userId}}',
    headers: acceptJson,
  },
  getCorrelationHistory: {
    method: 'GET',
    path: '/api/auditlogs/events/correlation-history/{{correlationId}}',
    headers: acceptJson,
  },
} satisfies Record<string, Endpoint>

export const ScrapingEndpoints = {
  browseScrapingSources: { method: 'GET', path: '/api/scraping/sources', headers: acceptJson },
  selectScrapingSources: {
    method: 'GET',
    path: '/api/scraping/sources/select',
    headers: acceptJson,
  },
  createScrapingSource: { method: 'POST', path: '/api/scraping/sources', headers: jsonHeaders },
  updateScrapingSource: {
    method: 'PUT',
    path: '/api/scraping/sources/{{sourceId}}',
    headers: jsonHeaders,
  },
  setScrapingSourceActive: {
    method: 'PATCH',
    path: '/api/scraping/sources/{{sourceId}}/active',
    headers: jsonHeaders,
  },
  deleteScrapingSource: {
    method: 'DELETE',
    path: '/api/scraping/sources/{{sourceId}}',
    headers: acceptJson,
  },

  browseScrapingCredentials: {
    method: 'GET',
    path: '/api/scraping/credentials',
    headers: acceptJson,
  },
  createScrapingCredential: {
    method: 'POST',
    path: '/api/scraping/credentials',
    headers: jsonHeaders,
  },
  updateScrapingCredential: {
    method: 'PUT',
    path: '/api/scraping/credentials/{{credentialId}}',
    headers: jsonHeaders,
  },
  rotateScrapingCredentialSecret: {
    method: 'PATCH',
    path: '/api/scraping/credentials/{{credentialId}}/secret',
    headers: jsonHeaders,
  },
  setScrapingCredentialActive: {
    method: 'PATCH',
    path: '/api/scraping/credentials/{{credentialId}}/active',
    headers: jsonHeaders,
  },
  deleteScrapingCredential: {
    method: 'DELETE',
    path: '/api/scraping/credentials/{{credentialId}}',
    headers: acceptJson,
  },

  browseScrapingJobs: { method: 'GET', path: '/api/scraping/jobs', headers: acceptJson },
  createScrapingJob: { method: 'POST', path: '/api/scraping/jobs', headers: jsonHeaders },
  startScrapingJob: {
    method: 'POST',
    path: '/api/scraping/jobs/{{jobId}}/start',
    headers: jsonHeaders,
  },
  completeScrapingJob: {
    method: 'POST',
    path: '/api/scraping/jobs/{{jobId}}/complete',
    headers: jsonHeaders,
  },
  failScrapingJob: {
    method: 'POST',
    path: '/api/scraping/jobs/{{jobId}}/fail',
    headers: jsonHeaders,
  },
  cancelScrapingJob: {
    method: 'POST',
    path: '/api/scraping/jobs/{{jobId}}/cancel',
    headers: jsonHeaders,
  },

  browseScrapingRuns: { method: 'GET', path: '/api/scraping/runs', headers: acceptJson },
  createScrapingRun: { method: 'POST', path: '/api/scraping/runs', headers: jsonHeaders },
  startScrapingRun: {
    method: 'POST',
    path: '/api/scraping/runs/{{runId}}/start',
    headers: jsonHeaders,
  },
  completeScrapingRun: {
    method: 'POST',
    path: '/api/scraping/runs/{{runId}}/complete',
    headers: jsonHeaders,
  },
  failScrapingRun: {
    method: 'POST',
    path: '/api/scraping/runs/{{runId}}/fail',
    headers: jsonHeaders,
  },
  retryScrapingRun: {
    method: 'POST',
    path: '/api/scraping/runs/{{runId}}/retry',
    headers: jsonHeaders,
  },

  browseScrapedEvidences: { method: 'GET', path: '/api/scraping/evidences', headers: acceptJson },
  createScrapedEvidence: { method: 'POST', path: '/api/scraping/evidences', headers: jsonHeaders },
  deleteScrapedEvidence: {
    method: 'DELETE',
    path: '/api/scraping/evidences/{{evidenceId}}',
    headers: acceptJson,
  },

  browseScrapedRateCandidates: {
    method: 'GET',
    path: '/api/scraping/rate-candidates',
    headers: acceptJson,
  },
  createScrapedRateCandidate: {
    method: 'POST',
    path: '/api/scraping/rate-candidates',
    headers: jsonHeaders,
  },
  normalizeScrapedRateCandidate: {
    method: 'POST',
    path: '/api/scraping/rate-candidates/{{candidateId}}/normalize',
    headers: jsonHeaders,
  },
  approveScrapedRateCandidate: {
    method: 'POST',
    path: '/api/scraping/rate-candidates/{{candidateId}}/approve',
    headers: jsonHeaders,
  },
  rejectScrapedRateCandidate: {
    method: 'POST',
    path: '/api/scraping/rate-candidates/{{candidateId}}/reject',
    headers: jsonHeaders,
  },
  sendScrapedRateCandidateToPricing: {
    method: 'POST',
    path: '/api/scraping/rate-candidates/{{candidateId}}/send-to-pricing',
    headers: jsonHeaders,
  },

  browseExtractionRules: {
    method: 'GET',
    path: '/api/scraping/extraction-rules',
    headers: acceptJson,
  },
  createExtractionRule: {
    method: 'POST',
    path: '/api/scraping/extraction-rules',
    headers: jsonHeaders,
  },
  updateExtractionRule: {
    method: 'PUT',
    path: '/api/scraping/extraction-rules/{{ruleId}}',
    headers: jsonHeaders,
  },
  approveExtractionRule: {
    method: 'POST',
    path: '/api/scraping/extraction-rules/{{ruleId}}/approve',
    headers: jsonHeaders,
  },
  rejectExtractionRule: {
    method: 'POST',
    path: '/api/scraping/extraction-rules/{{ruleId}}/reject',
    headers: jsonHeaders,
  },
  setExtractionRuleActive: {
    method: 'PATCH',
    path: '/api/scraping/extraction-rules/{{ruleId}}/active',
    headers: jsonHeaders,
  },
  deleteExtractionRule: {
    method: 'DELETE',
    path: '/api/scraping/extraction-rules/{{ruleId}}',
    headers: acceptJson,
  },

  executeManualWebScraping: {
    method: 'POST',
    path: '/api/scraping/web/manual',
    headers: jsonHeaders,
  },
  bootstrapWebScrapingAuth: {
    method: 'POST',
    path: '/api/scraping/web/auth/bootstrap',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const PricingEndpoints = {
  browseCosts: { method: 'GET', path: '/api/pricing/costs', headers: acceptJson },
  selectCosts: { method: 'GET', path: '/api/pricing/costs/select', headers: acceptJson },
  getCostById: { method: 'GET', path: '/api/pricing/costs/{{costId}}', headers: acceptJson },
  createCost: { method: 'POST', path: '/api/pricing/costs', headers: jsonHeaders },
  updateCost: { method: 'PUT', path: '/api/pricing/costs/{{costId}}', headers: jsonHeaders },
  setCostActive: {
    method: 'PATCH',
    path: '/api/pricing/costs/{{costId}}/active',
    headers: jsonHeaders,
  },
  deleteCost: { method: 'DELETE', path: '/api/pricing/costs/{{costId}}', headers: acceptJson },

  browseImportRates: { method: 'GET', path: '/api/pricing/import-rates', headers: acceptJson },
  getPricingDecisionDashboard: {
    method: 'GET',
    path: '/api/pricing/import-rates/decision-dashboard',
    headers: acceptJson,
  },
  selectImportRates: {
    method: 'GET',
    path: '/api/pricing/import-rates/select',
    headers: acceptJson,
  },
  getImportRateById: {
    method: 'GET',
    path: '/api/pricing/import-rates/{{importRateId}}',
    headers: acceptJson,
  },
  createImportRate: { method: 'POST', path: '/api/pricing/import-rates', headers: jsonHeaders },
  extractImportRates: {
    method: 'POST',
    path: '/api/pricing/import-rates/extract',
    headers: acceptJson,
  },
  approveImportRates: {
    method: 'POST',
    path: '/api/pricing/import-rates/approve',
    headers: jsonHeaders,
  },
  approveImportRate: {
    method: 'POST',
    path: '/api/pricing/import-rates/{{importRateId}}/approve',
    headers: acceptJson,
  },
  rejectImportRates: {
    method: 'POST',
    path: '/api/pricing/import-rates/reject',
    headers: jsonHeaders,
  },
  rejectImportRate: {
    method: 'POST',
    path: '/api/pricing/import-rates/{{importRateId}}/reject',
    headers: jsonHeaders,
  },
  deleteImportRates: { method: 'DELETE', path: '/api/pricing/import-rates', headers: jsonHeaders },

  browseRates: { method: 'GET', path: '/api/pricing/rates', headers: acceptJson },
  getRateById: { method: 'GET', path: '/api/pricing/rates/{{rateId}}', headers: acceptJson },
  createRate: { method: 'POST', path: '/api/pricing/rates', headers: jsonHeaders },
  updateRate: { method: 'PUT', path: '/api/pricing/rates/{{rateId}}', headers: jsonHeaders },
  duplicateRate: {
    method: 'POST',
    path: '/api/pricing/rates/{{rateId}}/duplicate',
    headers: jsonHeaders,
  },
  approveRateMargin: {
    method: 'POST',
    path: '/api/pricing/rates/{{rateId}}/margin/approve',
    headers: acceptJson,
  },
  rejectRateMargin: {
    method: 'POST',
    path: '/api/pricing/rates/{{rateId}}/margin/reject',
    headers: jsonHeaders,
  },
  setRateStatus: {
    method: 'PATCH',
    path: '/api/pricing/rates/{{rateId}}/status',
    headers: jsonHeaders,
  },
  deleteRates: { method: 'DELETE', path: '/api/pricing/rates', headers: jsonHeaders },
} satisfies Record<string, Endpoint>

export const DataExtractionEmailEndpoints = {
  browseEmailAccounts: {
    method: 'GET',
    path: '/api/data-extraction/email/accounts',
    headers: acceptJson,
  },
  browseEmailMessages: {
    method: 'GET',
    path: '/api/data-extraction/email/messages',
    headers: acceptJson,
  },
  getEmailMessage: {
    method: 'GET',
    path: '/api/data-extraction/email/messages/{{messageId}}',
    headers: acceptJson,
  },
  reprocessEmailMessage: {
    method: 'POST',
    path: '/api/data-extraction/email/messages/{{messageId}}/reprocess',
    headers: acceptJson,
  },
  browseEmailExtractionJobs: {
    method: 'GET',
    path: '/api/data-extraction/email/extraction-jobs',
    headers: acceptJson,
  },
} satisfies Record<string, Endpoint>


export const AiEndpoints = {
  browseConnections: { method: 'GET', path: '/api/ai/connections', headers: acceptJson },
  getConnection: { method: 'GET', path: '/api/ai/connections/{{connectionId}}', headers: acceptJson },
  createConnection: { method: 'POST', path: '/api/ai/connections', headers: jsonHeaders },
  updateConnection: { method: 'PUT', path: '/api/ai/connections/{{connectionId}}', headers: jsonHeaders },
  setConnectionActive: { method: 'PATCH', path: '/api/ai/connections/{{connectionId}}/active', headers: jsonHeaders },
  testConnection: { method: 'POST', path: '/api/ai/connections/{{connectionId}}/test', headers: acceptJson },
  discoverModels: { method: 'POST', path: '/api/ai/connections/{{connectionId}}/discover-models', headers: acceptJson },
  deleteConnection: { method: 'DELETE', path: '/api/ai/connections/{{connectionId}}', headers: acceptJson },

  browseModels: { method: 'GET', path: '/api/ai/models', headers: acceptJson },
  getModel: { method: 'GET', path: '/api/ai/models/{{modelId}}', headers: acceptJson },
  createModel: { method: 'POST', path: '/api/ai/models', headers: jsonHeaders },
  updateModel: { method: 'PUT', path: '/api/ai/models/{{modelId}}', headers: jsonHeaders },
  setModelActive: { method: 'PATCH', path: '/api/ai/models/{{modelId}}/active', headers: jsonHeaders },
  deleteModel: { method: 'DELETE', path: '/api/ai/models/{{modelId}}', headers: acceptJson },

  browseProfiles: { method: 'GET', path: '/api/ai/profiles', headers: acceptJson },
  getProfile: { method: 'GET', path: '/api/ai/profiles/{{profileId}}', headers: acceptJson },
  createProfile: { method: 'POST', path: '/api/ai/profiles', headers: jsonHeaders },
  updateProfile: { method: 'PUT', path: '/api/ai/profiles/{{profileId}}', headers: jsonHeaders },
  configureProfileModels: { method: 'PUT', path: '/api/ai/profiles/{{profileId}}/models', headers: jsonHeaders },
  setProfileActive: { method: 'PATCH', path: '/api/ai/profiles/{{profileId}}/active', headers: jsonHeaders },
  deleteProfile: { method: 'DELETE', path: '/api/ai/profiles/{{profileId}}', headers: acceptJson },

  browsePromptTemplates: { method: 'GET', path: '/api/ai/prompt-templates', headers: acceptJson },
  getPromptTemplate: { method: 'GET', path: '/api/ai/prompt-templates/{{promptTemplateId}}', headers: acceptJson },
  createPromptTemplate: { method: 'POST', path: '/api/ai/prompt-templates', headers: jsonHeaders },
  updatePromptTemplate: { method: 'PUT', path: '/api/ai/prompt-templates/{{promptTemplateId}}', headers: jsonHeaders },
  setPromptTemplateActive: { method: 'PATCH', path: '/api/ai/prompt-templates/{{promptTemplateId}}/active', headers: jsonHeaders },
  deletePromptTemplate: { method: 'DELETE', path: '/api/ai/prompt-templates/{{promptTemplateId}}', headers: acceptJson },

  browseExecutions: { method: 'GET', path: '/api/ai/executions', headers: acceptJson },
  getExecution: { method: 'GET', path: '/api/ai/executions/{{executionId}}', headers: acceptJson },
  executeChat: { method: 'POST', path: '/api/ai/executions/chat', headers: jsonHeaders },
  executeStructured: { method: 'POST', path: '/api/ai/executions/structured', headers: jsonHeaders },
  executeEmbeddings: { method: 'POST', path: '/api/ai/executions/embeddings', headers: jsonHeaders },
  cancelExecution: { method: 'POST', path: '/api/ai/executions/{{executionId}}/cancel', headers: jsonHeaders },
} satisfies Record<string, Endpoint>

export const Endpoints = {
  ...AuthEndpoints,
  ...ClientBrandingEndpoints,
  ...UserEndpoints,
  ...RoleEndpoints,
  ...ScopeEndpoints,
  ...SessionEndpoints,
  ...CatalogGroupEndpoints,
  ...CatalogItemEndpoints,
  ...AuditLogsEndpoints,
  ...ScrapingEndpoints,
  ...PricingEndpoints,
  ...DataExtractionEmailEndpoints,
  ...AiEndpoints,
} satisfies Record<string, Endpoint>
