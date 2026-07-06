export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Endpoint {
  method: HttpMethod
  path: string
  headers?: Record<string, string>
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
  selectScrapingSources: { method: 'GET', path: '/api/scraping/sources/select', headers: acceptJson },
  createScrapingSource: { method: 'POST', path: '/api/scraping/sources', headers: jsonHeaders },
  updateScrapingSource: { method: 'PUT', path: '/api/scraping/sources/{{sourceId}}', headers: jsonHeaders },
  setScrapingSourceActive: { method: 'PATCH', path: '/api/scraping/sources/{{sourceId}}/active', headers: jsonHeaders },
  deleteScrapingSource: { method: 'DELETE', path: '/api/scraping/sources/{{sourceId}}', headers: acceptJson },

  browseScrapingCredentials: { method: 'GET', path: '/api/scraping/credentials', headers: acceptJson },
  createScrapingCredential: { method: 'POST', path: '/api/scraping/credentials', headers: jsonHeaders },
  updateScrapingCredential: { method: 'PUT', path: '/api/scraping/credentials/{{credentialId}}', headers: jsonHeaders },
  rotateScrapingCredentialSecret: { method: 'PATCH', path: '/api/scraping/credentials/{{credentialId}}/secret', headers: jsonHeaders },
  setScrapingCredentialActive: { method: 'PATCH', path: '/api/scraping/credentials/{{credentialId}}/active', headers: jsonHeaders },
  deleteScrapingCredential: { method: 'DELETE', path: '/api/scraping/credentials/{{credentialId}}', headers: acceptJson },

  browseScrapingJobs: { method: 'GET', path: '/api/scraping/jobs', headers: acceptJson },
  createScrapingJob: { method: 'POST', path: '/api/scraping/jobs', headers: jsonHeaders },
  startScrapingJob: { method: 'POST', path: '/api/scraping/jobs/{{jobId}}/start', headers: jsonHeaders },
  completeScrapingJob: { method: 'POST', path: '/api/scraping/jobs/{{jobId}}/complete', headers: jsonHeaders },
  failScrapingJob: { method: 'POST', path: '/api/scraping/jobs/{{jobId}}/fail', headers: jsonHeaders },
  cancelScrapingJob: { method: 'POST', path: '/api/scraping/jobs/{{jobId}}/cancel', headers: jsonHeaders },

  browseScrapingRuns: { method: 'GET', path: '/api/scraping/runs', headers: acceptJson },
  createScrapingRun: { method: 'POST', path: '/api/scraping/runs', headers: jsonHeaders },
  startScrapingRun: { method: 'POST', path: '/api/scraping/runs/{{runId}}/start', headers: jsonHeaders },
  completeScrapingRun: { method: 'POST', path: '/api/scraping/runs/{{runId}}/complete', headers: jsonHeaders },
  failScrapingRun: { method: 'POST', path: '/api/scraping/runs/{{runId}}/fail', headers: jsonHeaders },
  retryScrapingRun: { method: 'POST', path: '/api/scraping/runs/{{runId}}/retry', headers: jsonHeaders },

  browseScrapedEvidences: { method: 'GET', path: '/api/scraping/evidences', headers: acceptJson },
  createScrapedEvidence: { method: 'POST', path: '/api/scraping/evidences', headers: jsonHeaders },
  deleteScrapedEvidence: { method: 'DELETE', path: '/api/scraping/evidences/{{evidenceId}}', headers: acceptJson },

  browseScrapedRateCandidates: { method: 'GET', path: '/api/scraping/rate-candidates', headers: acceptJson },
  createScrapedRateCandidate: { method: 'POST', path: '/api/scraping/rate-candidates', headers: jsonHeaders },
  normalizeScrapedRateCandidate: { method: 'POST', path: '/api/scraping/rate-candidates/{{candidateId}}/normalize', headers: jsonHeaders },
  approveScrapedRateCandidate: { method: 'POST', path: '/api/scraping/rate-candidates/{{candidateId}}/approve', headers: jsonHeaders },
  rejectScrapedRateCandidate: { method: 'POST', path: '/api/scraping/rate-candidates/{{candidateId}}/reject', headers: jsonHeaders },
  sendScrapedRateCandidateToPricing: { method: 'POST', path: '/api/scraping/rate-candidates/{{candidateId}}/send-to-pricing', headers: jsonHeaders },

  browseExtractionRules: { method: 'GET', path: '/api/scraping/extraction-rules', headers: acceptJson },
  createExtractionRule: { method: 'POST', path: '/api/scraping/extraction-rules', headers: jsonHeaders },
  updateExtractionRule: { method: 'PUT', path: '/api/scraping/extraction-rules/{{ruleId}}', headers: jsonHeaders },
  approveExtractionRule: { method: 'POST', path: '/api/scraping/extraction-rules/{{ruleId}}/approve', headers: jsonHeaders },
  rejectExtractionRule: { method: 'POST', path: '/api/scraping/extraction-rules/{{ruleId}}/reject', headers: jsonHeaders },
  setExtractionRuleActive: { method: 'PATCH', path: '/api/scraping/extraction-rules/{{ruleId}}/active', headers: jsonHeaders },
  deleteExtractionRule: { method: 'DELETE', path: '/api/scraping/extraction-rules/{{ruleId}}', headers: acceptJson },

  executeManualWebScraping: { method: 'POST', path: '/api/scraping/web/manual', headers: jsonHeaders },
  bootstrapWebScrapingAuth: { method: 'POST', path: '/api/scraping/web/auth/bootstrap', headers: jsonHeaders },
} satisfies Record<string, Endpoint>

export const PricingEndpoints = {
  browseCosts: { method: 'GET', path: '/api/pricing/costs', headers: acceptJson },
  selectCosts: { method: 'GET', path: '/api/pricing/costs/select', headers: acceptJson },
  getCostById: { method: 'GET', path: '/api/pricing/costs/{{costId}}', headers: acceptJson },
  createCost: { method: 'POST', path: '/api/pricing/costs', headers: jsonHeaders },
  updateCost: { method: 'PUT', path: '/api/pricing/costs/{{costId}}', headers: jsonHeaders },
  setCostActive: { method: 'PATCH', path: '/api/pricing/costs/{{costId}}/active', headers: jsonHeaders },
  deleteCost: { method: 'DELETE', path: '/api/pricing/costs/{{costId}}', headers: acceptJson },

  browseImportFclRates: { method: 'GET', path: '/api/pricing/import-fcl-rates', headers: acceptJson },
  selectImportFclRates: { method: 'GET', path: '/api/pricing/import-fcl-rates/select', headers: acceptJson },
  getImportFclRateById: { method: 'GET', path: '/api/pricing/import-fcl-rates/{{importFclRateId}}', headers: acceptJson },
  createImportFclRate: { method: 'POST', path: '/api/pricing/import-fcl-rates', headers: jsonHeaders },
  extractImportFclRates: { method: 'POST', path: '/api/pricing/import-fcl-rates/extract', headers: acceptJson },
  approveImportFclRate: { method: 'PATCH', path: '/api/pricing/import-fcl-rates/{{importFclRateId}}/approve', headers: jsonHeaders },
  rejectImportFclRate: { method: 'PATCH', path: '/api/pricing/import-fcl-rates/{{importFclRateId}}/reject', headers: jsonHeaders },
  markImportFclRateAsImportedOnly: { method: 'PATCH', path: '/api/pricing/import-fcl-rates/{{importFclRateId}}/imported-only', headers: jsonHeaders },
  createRateFromImportFclRate: { method: 'POST', path: '/api/pricing/import-fcl-rates/{{importFclRateId}}/create-as-rate', headers: jsonHeaders },
  deleteImportFclRate: { method: 'DELETE', path: '/api/pricing/import-fcl-rates/{{importFclRateId}}', headers: acceptJson },
  deleteImportFclRatesBatch: { method: 'POST', path: '/api/pricing/import-fcl-rates/batch-delete', headers: jsonHeaders },

  browseRateHeaders: { method: 'GET', path: '/api/pricing/rates', headers: acceptJson },
  selectRateHeaders: { method: 'GET', path: '/api/pricing/rates/select', headers: acceptJson },
  getActiveFclRates: { method: 'GET', path: '/api/pricing/rates/active-fcl', headers: acceptJson },
  getRateHeaderById: { method: 'GET', path: '/api/pricing/rates/{{rateHeaderId}}', headers: acceptJson },
  createRateHeader: { method: 'POST', path: '/api/pricing/rates', headers: jsonHeaders },
  createManualFclRate: { method: 'POST', path: '/api/pricing/rates/manual-fcl', headers: jsonHeaders },
  updateRateHeader: { method: 'PUT', path: '/api/pricing/rates/{{rateHeaderId}}', headers: jsonHeaders },
  setRateHeaderAmounts: { method: 'PATCH', path: '/api/pricing/rates/{{rateHeaderId}}/amounts', headers: jsonHeaders },
  setRateHeaderActive: { method: 'PATCH', path: '/api/pricing/rates/{{rateHeaderId}}/active', headers: jsonHeaders },
  duplicateRateHeader: { method: 'POST', path: '/api/pricing/rates/{{rateHeaderId}}/duplicate', headers: jsonHeaders },
  deleteRateHeader: { method: 'DELETE', path: '/api/pricing/rates/{{rateHeaderId}}', headers: acceptJson },
  deleteRateHeadersBatch: { method: 'POST', path: '/api/pricing/rates/batch-delete', headers: jsonHeaders },

  addFclRateDetail: { method: 'POST', path: '/api/pricing/rates/{{rateHeaderId}}/fcl-details', headers: jsonHeaders },
  updateFclRateDetail: { method: 'PUT', path: '/api/pricing/rates/{{rateHeaderId}}/fcl-details/{{fclRateDetailId}}', headers: jsonHeaders },
  removeFclRateDetail: { method: 'DELETE', path: '/api/pricing/rates/{{rateHeaderId}}/fcl-details/{{fclRateDetailId}}', headers: acceptJson },

  addRateCostDetail: { method: 'POST', path: '/api/pricing/rates/{{rateHeaderId}}/cost-details', headers: jsonHeaders },
  updateRateCostDetail: { method: 'PUT', path: '/api/pricing/rates/{{rateHeaderId}}/cost-details/{{rateCostDetailId}}', headers: jsonHeaders },
  removeRateCostDetail: { method: 'DELETE', path: '/api/pricing/rates/{{rateHeaderId}}/cost-details/{{rateCostDetailId}}', headers: acceptJson },
  approveMarginApproval: { method: 'PATCH', path: '/api/pricing/rates/{{rateHeaderId}}/margin-approvals/{{marginApprovalId}}/approve', headers: jsonHeaders },
  rejectMarginApproval: { method: 'PATCH', path: '/api/pricing/rates/{{rateHeaderId}}/margin-approvals/{{marginApprovalId}}/reject', headers: jsonHeaders },
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
} satisfies Record<string, Endpoint>
