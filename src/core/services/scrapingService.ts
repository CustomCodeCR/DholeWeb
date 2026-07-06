import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  BrowseExtractionRulesQuery,
  BrowseScrapedEvidencesQuery,
  BrowseScrapedRateCandidatesQuery,
  BrowseScrapingCredentialsQuery,
  BrowseScrapingJobsQuery,
  BrowseScrapingRunsQuery,
  BrowseScrapingSourcesQuery,
  CancelScrapingJobRequest,
  CompleteScrapingRunRequest,
  CreateExtractionMappingRuleRequest,
  CreateScrapedEvidenceRequest,
  CreateScrapedRateCandidateRequest,
  CreateScrapingCredentialRequest,
  CreateScrapingJobRequest,
  CreateScrapingRunRequest,
  CreateScrapingSourceRequest,
  ExtractionMappingRuleDto,
  FailScrapingJobRequest,
  FailScrapingRunRequest,
  ManualWebScrapingRequest,
  ManualWebScrapingResponse,
  WebScrapingAuthBootstrapRequest,
  WebScrapingAuthBootstrapResponse,
  NormalizeScrapedRateCandidateRequest,
  MarkScrapedRateCandidateSentToPricingRequest,
  ReviewNotesRequest,
  RotateScrapingCredentialSecretRequest,
  ScrapedEvidenceDto,
  ScrapedRateCandidateDto,
  ScrapingCredentialDto,
  ScrapingJobDto,
  ScrapingRunDto,
  ScrapingSourceDto,
  ScrapingSourceSelectDto,
  SetActiveRequest,
  UpdateExtractionMappingRuleRequest,
  UpdateScrapingCredentialRequest,
  UpdateScrapingSourceRequest,
} from '@/core/interfaces/scraping'

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

export const ScrapingService = {
  async browseSources(query?: BrowseScrapingSourcesQuery): Promise<PagedResponse<ScrapingSourceDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseScrapingSources,
      path: withQuery(Endpoints.browseScrapingSources.path, query),
    })

    return unwrapPagedResponse<ScrapingSourceDto>(response)
  },

  async selectSources(query?: Record<string, unknown>): Promise<ScrapingSourceSelectDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.selectScrapingSources,
      path: withQuery(Endpoints.selectScrapingSources.path, query),
    })

    return unwrapApiResponse(response) as ScrapingSourceSelectDto[]
  },

  async createSource(payload: CreateScrapingSourceRequest): Promise<string> {
    const response = await callEndpoint<string, CreateScrapingSourceRequest>(
      Endpoints.createScrapingSource,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async updateSource(sourceId: string, payload: UpdateScrapingSourceRequest): Promise<void> {
    await callEndpoint<void, UpdateScrapingSourceRequest>(Endpoints.updateScrapingSource, {
      params: { sourceId },
      body: payload,
    })
  },

  async setSourceActive(sourceId: string, isActive: boolean): Promise<void> {
    await callEndpoint<void, SetActiveRequest>(Endpoints.setScrapingSourceActive, {
      params: { sourceId },
      body: { isActive },
    })
  },

  async deleteSource(sourceId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.deleteScrapingSource, { params: { sourceId } })
  },

  async browseCredentials(
    query?: BrowseScrapingCredentialsQuery,
  ): Promise<PagedResponse<ScrapingCredentialDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseScrapingCredentials,
      path: withQuery(Endpoints.browseScrapingCredentials.path, query),
    })

    return unwrapPagedResponse<ScrapingCredentialDto>(response)
  },

  async createCredential(payload: CreateScrapingCredentialRequest): Promise<string> {
    const response = await callEndpoint<string, CreateScrapingCredentialRequest>(
      Endpoints.createScrapingCredential,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async updateCredential(
    credentialId: string,
    payload: UpdateScrapingCredentialRequest,
  ): Promise<void> {
    await callEndpoint<void, UpdateScrapingCredentialRequest>(Endpoints.updateScrapingCredential, {
      params: { credentialId },
      body: payload,
    })
  },

  async rotateCredentialSecret(
    credentialId: string,
    payload: RotateScrapingCredentialSecretRequest,
  ): Promise<void> {
    await callEndpoint<void, RotateScrapingCredentialSecretRequest>(
      Endpoints.rotateScrapingCredentialSecret,
      { params: { credentialId }, body: payload },
    )
  },

  async setCredentialActive(credentialId: string, isActive: boolean): Promise<void> {
    await callEndpoint<void, SetActiveRequest>(Endpoints.setScrapingCredentialActive, {
      params: { credentialId },
      body: { isActive },
    })
  },

  async deleteCredential(credentialId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.deleteScrapingCredential, { params: { credentialId } })
  },

  async browseJobs(query?: BrowseScrapingJobsQuery): Promise<PagedResponse<ScrapingJobDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseScrapingJobs,
      path: withQuery(Endpoints.browseScrapingJobs.path, query),
    })

    return unwrapPagedResponse<ScrapingJobDto>(response)
  },

  async createJob(payload: CreateScrapingJobRequest): Promise<string> {
    const response = await callEndpoint<string, CreateScrapingJobRequest>(Endpoints.createScrapingJob, {
      body: payload,
    })

    return unwrapApiResponse(response)
  },

  async startJob(jobId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.startScrapingJob, { params: { jobId } })
  },

  async completeJob(jobId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.completeScrapingJob, { params: { jobId } })
  },

  async failJob(jobId: string, payload: FailScrapingJobRequest): Promise<void> {
    await callEndpoint<void, FailScrapingJobRequest>(Endpoints.failScrapingJob, {
      params: { jobId },
      body: payload,
    })
  },

  async cancelJob(jobId: string, payload: CancelScrapingJobRequest): Promise<void> {
    await callEndpoint<void, CancelScrapingJobRequest>(Endpoints.cancelScrapingJob, {
      params: { jobId },
      body: payload,
    })
  },

  async browseRuns(query?: BrowseScrapingRunsQuery): Promise<PagedResponse<ScrapingRunDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseScrapingRuns,
      path: withQuery(Endpoints.browseScrapingRuns.path, query),
    })

    return unwrapPagedResponse<ScrapingRunDto>(response)
  },

  async createRun(payload: CreateScrapingRunRequest): Promise<string> {
    const response = await callEndpoint<string, CreateScrapingRunRequest>(Endpoints.createScrapingRun, {
      body: payload,
    })

    return unwrapApiResponse(response)
  },

  async startRun(runId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.startScrapingRun, { params: { runId } })
  },

  async completeRun(runId: string, payload: CompleteScrapingRunRequest): Promise<void> {
    await callEndpoint<void, CompleteScrapingRunRequest>(Endpoints.completeScrapingRun, {
      params: { runId },
      body: payload,
    })
  },

  async failRun(runId: string, payload: FailScrapingRunRequest): Promise<void> {
    await callEndpoint<void, FailScrapingRunRequest>(Endpoints.failScrapingRun, {
      params: { runId },
      body: payload,
    })
  },

  async retryRun(runId: string, reason?: string | null): Promise<void> {
    await callEndpoint<void, { reason?: string | null }>(Endpoints.retryScrapingRun, {
      params: { runId },
      body: { reason },
    })
  },

  async browseEvidences(query?: BrowseScrapedEvidencesQuery): Promise<PagedResponse<ScrapedEvidenceDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseScrapedEvidences,
      path: withQuery(Endpoints.browseScrapedEvidences.path, query),
    })

    return unwrapPagedResponse<ScrapedEvidenceDto>(response)
  },

  async createEvidence(payload: CreateScrapedEvidenceRequest): Promise<string> {
    const response = await callEndpoint<string, CreateScrapedEvidenceRequest>(
      Endpoints.createScrapedEvidence,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async deleteEvidence(evidenceId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.deleteScrapedEvidence, { params: { evidenceId } })
  },

  async browseRateCandidates(
    query?: BrowseScrapedRateCandidatesQuery,
  ): Promise<PagedResponse<ScrapedRateCandidateDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseScrapedRateCandidates,
      path: withQuery(Endpoints.browseScrapedRateCandidates.path, query),
    })

    return unwrapPagedResponse<ScrapedRateCandidateDto>(response)
  },

  async createRateCandidate(payload: CreateScrapedRateCandidateRequest): Promise<string> {
    const response = await callEndpoint<string, CreateScrapedRateCandidateRequest>(
      Endpoints.createScrapedRateCandidate,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async normalizeRateCandidate(
    candidateId: string,
    payload: NormalizeScrapedRateCandidateRequest,
  ): Promise<void> {
    await callEndpoint<void, NormalizeScrapedRateCandidateRequest>(
      Endpoints.normalizeScrapedRateCandidate,
      { params: { candidateId }, body: payload },
    )
  },

  async approveRateCandidate(candidateId: string, notes?: string | null): Promise<void> {
    await callEndpoint<void, ReviewNotesRequest>(Endpoints.approveScrapedRateCandidate, {
      params: { candidateId },
      body: { notes },
    })
  },

  async rejectRateCandidate(candidateId: string, reason: string): Promise<void> {
    await callEndpoint<void, ReviewNotesRequest>(Endpoints.rejectScrapedRateCandidate, {
      params: { candidateId },
      body: { reason },
    })
  },

  async sendRateCandidateToPricing(
    candidateId: string,
    payload: MarkScrapedRateCandidateSentToPricingRequest,
  ): Promise<void> {
    await callEndpoint<void, MarkScrapedRateCandidateSentToPricingRequest>(
      Endpoints.sendScrapedRateCandidateToPricing,
      { params: { candidateId }, body: payload },
    )
  },

  async browseExtractionRules(
    query?: BrowseExtractionRulesQuery,
  ): Promise<PagedResponse<ExtractionMappingRuleDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseExtractionRules,
      path: withQuery(Endpoints.browseExtractionRules.path, query),
    })

    return unwrapPagedResponse<ExtractionMappingRuleDto>(response)
  },

  async createExtractionRule(payload: CreateExtractionMappingRuleRequest): Promise<string> {
    const response = await callEndpoint<string, CreateExtractionMappingRuleRequest>(
      Endpoints.createExtractionRule,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async updateExtractionRule(
    ruleId: string,
    payload: UpdateExtractionMappingRuleRequest,
  ): Promise<void> {
    await callEndpoint<void, UpdateExtractionMappingRuleRequest>(Endpoints.updateExtractionRule, {
      params: { ruleId },
      body: payload,
    })
  },

  async approveExtractionRule(ruleId: string, notes?: string | null): Promise<void> {
    await callEndpoint<void, { notes?: string | null }>(Endpoints.approveExtractionRule, {
      params: { ruleId },
      body: { notes },
    })
  },

  async rejectExtractionRule(ruleId: string, reason: string): Promise<void> {
    await callEndpoint<void, { reason: string }>(Endpoints.rejectExtractionRule, {
      params: { ruleId },
      body: { reason },
    })
  },

  async setExtractionRuleActive(ruleId: string, isActive: boolean): Promise<void> {
    await callEndpoint<void, SetActiveRequest>(Endpoints.setExtractionRuleActive, {
      params: { ruleId },
      body: { isActive },
    })
  },

  async deleteExtractionRule(ruleId: string): Promise<void> {
    await callEndpoint<void>(Endpoints.deleteExtractionRule, { params: { ruleId } })
  },

  async executeManual(payload: ManualWebScrapingRequest): Promise<ManualWebScrapingResponse> {
    const response = await callEndpoint<ManualWebScrapingResponse, ManualWebScrapingRequest>(
      Endpoints.executeManualWebScraping,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async bootstrapAuthentication(
    payload: WebScrapingAuthBootstrapRequest,
  ): Promise<WebScrapingAuthBootstrapResponse> {
    const response = await callEndpoint<
      WebScrapingAuthBootstrapResponse,
      WebScrapingAuthBootstrapRequest
    >(Endpoints.bootstrapWebScrapingAuth, { body: payload })

    return unwrapApiResponse(response)
  },
}
