export interface ScrapingSourceDto extends Record<string, unknown> {
  id: string
  code: string
  name: string
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  baseUrl: string
  sourceType: number
  sourceTypeName: string
  requiresLogin: boolean
  healthStatus: number
  healthStatusName: string
  isActive: boolean
  metadataJson?: string | null
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface ScrapingSourceSelectDto extends Record<string, unknown> {
  id: string
  code: string
  name: string
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  sourceType: number
  sourceTypeName: string
  isActive: boolean
}

export interface ScrapingCredentialDto extends Record<string, unknown> {
  id: string
  scrapingSourceId: string
  scrapingSourceCode?: string | null
  scrapingSourceName?: string | null
  authenticationMode: number
  authenticationModeName: string
  username?: string | null
  secretReference: string
  secretHash?: string | null
  hasSecret?: boolean
  expiresAt?: string | null
  lastRotatedAt?: string | null
  status: number
  statusName: string
  metadataJson?: string | null
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface ScrapingJobDto extends Record<string, unknown> {
  id: string
  scrapingSourceId?: string | null
  scrapingSourceCode?: string | null
  scrapingSourceName?: string | null
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  portOfLoadingCatalogItemId?: string | null
  portOfLoadingCode?: string | null
  portOfLoadingName?: string | null
  portOfEntryCatalogItemId?: string | null
  portOfEntryCode?: string | null
  portOfEntryName?: string | null
  portOfDischargeCatalogItemId?: string | null
  portOfDischargeCode?: string | null
  portOfDischargeName?: string | null
  containerTypeCatalogItemId?: string | null
  containerTypeCode?: string | null
  containerTypeName?: string | null
  readyDate?: string | null
  weightKg?: number | null
  commodity?: string | null
  triggerType: number
  triggerTypeName: string
  scheduledAtUtc?: string | null
  status: number
  statusName: string
  startedAt?: string | null
  completedAt?: string | null
  failureReason?: string | null
  failureMessage?: string | null
  metadataJson?: string | null
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface ScrapingRunDto extends Record<string, unknown> {
  id: string
  scrapingJobId: string
  scrapingSourceId: string
  scrapingSourceCode?: string | null
  scrapingSourceName?: string | null
  scrapingCredentialId?: string | null
  attemptNumber: number
  status: number
  statusName: string
  startedAt?: string | null
  finishedAt?: string | null
  failureReason?: number | null
  failureReasonName?: string | null
  failureMessage?: string | null
  extractedRateCount: number
  evidenceCount: number
  outputSummaryJson?: string | null
  correlationId?: string | null
  metadataJson?: string | null
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface ScrapedEvidenceDto extends Record<string, unknown> {
  id: string
  scrapingRunId: string
  scrapingSourceId: string
  scrapingSourceCode?: string | null
  scrapingSourceName?: string | null
  evidenceType: number
  evidenceTypeName: string
  storageObjectKey: string
  fileName?: string | null
  contentType?: string | null
  contentHash?: string | null
  sizeBytes?: number | null
  metadataJson?: string | null
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface ScrapedRateCandidateDto extends Record<string, unknown> {
  id: string
  scrapingRunId: string
  scrapingSourceId: string
  scrapingSourceCode?: string | null
  scrapingSourceName?: string | null
  scrapedEvidenceId?: string | null
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  portOfLoadingCatalogItemId?: string | null
  portOfLoadingCode?: string | null
  portOfLoadingName?: string | null
  portOfEntryCatalogItemId?: string | null
  portOfEntryCode?: string | null
  portOfEntryName?: string | null
  portOfDischargeCatalogItemId?: string | null
  portOfDischargeCode?: string | null
  portOfDischargeName?: string | null
  containerTypeCatalogItemId?: string | null
  containerTypeCode?: string | null
  containerTypeName?: string | null
  currencyCatalogItemId?: string | null
  currencyCode?: string | null
  currencyName?: string | null
  validFrom?: string | null
  validTo?: string | null
  confidenceScore: number
  rawJson?: string | null
  normalizedJson?: string | null
  reviewNotes?: string | null
  metadataJson?: string | null
  pricingRateId?: string | null
  status: number
  statusName: string
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface ExtractionMappingRuleDto extends Record<string, unknown> {
  id: string
  scrapingSourceId: string
  scrapingSourceCode?: string | null
  scrapingSourceName?: string | null
  fieldName: string
  displayName: string
  ruleType: number
  ruleTypeName: string
  expression: string
  minimumConfidenceScore: number
  version: number
  status: number
  statusName: string
  metadataJson?: string | null
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  isDeleted?: boolean
}

export interface BrowseScrapingSourcesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string
  carrierCatalogItemId?: string
  sourceType?: number
  healthStatus?: number
  isActive?: boolean
}

export interface BrowseScrapingCredentialsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  scrapingSourceId?: string
  authenticationMode?: number
  status?: number
  expiresFrom?: string
  expiresTo?: string
}

export interface BrowseScrapingJobsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  scrapingSourceId?: string
  carrierCatalogItemId?: string
  portOfLoadingCatalogItemId?: string
  portOfEntryCatalogItemId?: string
  portOfDischargeCatalogItemId?: string
  containerTypeCatalogItemId?: string
  readyDateFrom?: string
  readyDateTo?: string
  status?: number
  triggerType?: number
}

export interface BrowseScrapingRunsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  scrapingJobId?: string
  scrapingSourceId?: string
  scrapingCredentialId?: string
  status?: number
  failureReason?: number
  startedFrom?: string
  startedTo?: string
  finishedFrom?: string
  finishedTo?: string
  correlationId?: string
}

export interface BrowseScrapedEvidencesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  scrapingRunId?: string
  scrapingSourceId?: string
  evidenceType?: number
  fileName?: string
  contentHash?: string
}

export interface BrowseScrapedRateCandidatesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  scrapingRunId?: string
  scrapingSourceId?: string
  scrapedEvidenceId?: string
  carrierCatalogItemId?: string
  portOfLoadingCatalogItemId?: string
  portOfEntryCatalogItemId?: string
  portOfDischargeCatalogItemId?: string
  containerTypeCatalogItemId?: string
  currencyCatalogItemId?: string
  validFrom?: string
  validTo?: string
  status?: number
  minimumConfidenceScore?: number
}

export interface BrowseExtractionRulesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  scrapingSourceId?: string
  fieldName?: string
  ruleType?: number
  status?: number
}

export interface ManualWebScrapingRequest {
  url?: string | null
  scrapingSourceId?: string | null
  scrapingCredentialId?: string | null
  scrapingJobId?: string | null
  userAgent?: string | null
  headers?: Record<string, string> | null
  waitForSelector?: string | null
  timeoutSeconds?: number | null
  waitAfterLoadMilliseconds?: number | null
  captureScreenshot: boolean
  captureHtml: boolean
  viewportWidth?: number | null
  viewportHeight?: number | null
  reuseSession?: boolean | null
  forceLogin?: boolean
  resetSession?: boolean
  storageStateKey?: string | null
  persistResult?: boolean
  completeJob?: boolean
  loginStepsJson?: string | null
  navigationStepsJson?: string | null
  extractionRulesJson?: string | null
  inputValues?: Record<string, string> | null
}

export interface ManualWebScrapingResponse extends Record<string, unknown> {
  url: string
  finalUrl?: string | null
  statusCode?: number | null
  title?: string | null
  html?: string | null
  screenshotBase64?: string | null
  fetchedAtUtc?: string | null
  durationMilliseconds?: number | null
  responseHeaders?: Record<string, string> | null
  extractedValues?: Record<string, string> | null
  success?: boolean
  message?: string | null
  scrapingRunId?: string | null
  scrapedRateCandidateId?: string | null
  evidenceCount?: number | null
  extractedRateCount?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  diagnostics?: string[] | null
  elapsedMilliseconds?: number | null
}


export type WebScrapingAuthBootstrapRequest = ManualWebScrapingRequest

export interface WebScrapingAuthBootstrapResponse extends Record<string, unknown> {
  success: boolean
  initialUrl: string
  finalUrl: string
  storageStatePath?: string | null
  persistentProfilePath?: string | null
  startedAtUtc: string
  finishedAtUtc: string
  diagnostics: string[]
  errorCode?: string | null
  errorMessage?: string | null
}

export interface CreateScrapingSourceRequest {
  code: string
  name: string
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  baseUrl: string
  sourceType: number
  requiresLogin: boolean
  metadataJson?: string | null
}

export interface UpdateScrapingSourceRequest {
  name: string
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  baseUrl: string
  sourceType: number
  requiresLogin: boolean
  metadataJson?: string | null
}

export interface SetActiveRequest {
  isActive: boolean
}

export interface CreateScrapingCredentialRequest {
  scrapingSourceId: string
  authenticationMode: number
  username?: string | null
  secretReference: string
  secretHash?: string | null
  hasSecret?: boolean
  expiresAt?: string | null
  metadataJson?: string | null
}

export interface UpdateScrapingCredentialRequest {
  authenticationMode: number
  username?: string | null
  expiresAt?: string | null
  metadataJson?: string | null
}

export interface RotateScrapingCredentialSecretRequest {
  secretReference: string
}

export interface CreateScrapingJobRequest {
  scrapingSourceId?: string | null
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  portOfLoadingCatalogItemId: string
  portOfLoadingCode: string
  portOfLoadingName: string
  portOfEntryCatalogItemId?: string | null
  portOfEntryCode?: string | null
  portOfEntryName?: string | null
  portOfDischargeCatalogItemId: string
  portOfDischargeCode: string
  portOfDischargeName: string
  containerTypeCatalogItemId: string
  containerTypeCode: string
  containerTypeName: string
  readyDate?: string | null
  weightKg?: number | null
  commodity?: string | null
  triggerType: number
  scheduledAtUtc?: string | null
  metadataJson?: string | null
}

export interface FailScrapingJobRequest {
  failureReason: string
  failureMessage: string
}

export interface CancelScrapingJobRequest {
  reason: string
}

export interface CreateScrapingRunRequest {
  scrapingJobId: string
  scrapingSourceId: string
  scrapingCredentialId?: string | null
  correlationId?: string | null
  metadataJson?: string | null
}

export interface CompleteScrapingRunRequest {
  extractedRateCount: number
  evidenceCount: number
  outputSummaryJson?: string | null
  metadataJson?: string | null
}

export interface FailScrapingRunRequest {
  failureReason: number
  failureMessage: string
  metadataJson?: string | null
}

export interface RetryScrapingRunRequest {
  reason?: string | null
}

export interface CreateScrapedEvidenceRequest {
  scrapingRunId: string
  scrapingSourceId: string
  evidenceType: number
  storageObjectKey: string
  fileName?: string | null
  contentType?: string | null
  contentHash?: string | null
  sizeBytes?: number | null
  metadataJson?: string | null
}

export interface CreateScrapedRateCandidateRequest {
  scrapingRunId: string
  scrapingSourceId: string
  scrapedEvidenceId?: string | null
  carrierCatalogItemId?: string | null
  carrierCode?: string | null
  carrierName?: string | null
  portOfLoadingCatalogItemId?: string | null
  portOfLoadingCode?: string | null
  portOfLoadingName?: string | null
  portOfEntryCatalogItemId?: string | null
  portOfEntryCode?: string | null
  portOfEntryName?: string | null
  portOfDischargeCatalogItemId?: string | null
  portOfDischargeCode?: string | null
  portOfDischargeName?: string | null
  containerTypeCatalogItemId?: string | null
  containerTypeCode?: string | null
  containerTypeName?: string | null
  currencyCatalogItemId?: string | null
  currencyCode?: string | null
  currencyName?: string | null
  validFrom?: string | null
  validTo?: string | null
  confidenceScore: number
  rawJson: string
  metadataJson?: string | null
}

export interface NormalizeScrapedRateCandidateRequest {
  normalizedJson: string
  confidenceScore: number
  validFrom?: string | null
  validTo?: string | null
}

export interface ReviewNotesRequest {
  notes?: string | null
  reason?: string | null
}

export interface MarkScrapedRateCandidateSentToPricingRequest {
  pricingRateId: string
}

export interface CreateExtractionMappingRuleRequest {
  scrapingSourceId: string
  fieldName: string
  displayName: string
  ruleType: number
  expression: string
  minimumConfidenceScore: number
  metadataJson?: string | null
}

export interface UpdateExtractionMappingRuleRequest {
  displayName: string
  ruleType: number
  expression: string
  minimumConfidenceScore: number
  metadataJson?: string | null
}
