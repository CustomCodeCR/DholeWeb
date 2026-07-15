import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import { Endpoints } from '@/core/composables/endpoints'
import { toQueryString } from '@/core/api/queryString'
import type {
  BrowseCostsQuery,
  BrowseImportRatesQuery,
  BrowseRatesQuery,
  CostDto,
  CostSelectDto,
  CreateCostRequest,
  CreateImportRateRequest,
  CreateRateRequest,
  DeleteBatchRequest,
  DuplicateRateRequest,
  ExtractImportRatesResultDto,
  ImportRateBatchRequest,
  ImportRateDto,
  ImportRateSelectDto,
  ImportStatus,
  PricingDecisionDashboardDto,
  PricingDecisionDashboardQuery,
  RateDto,
  RejectImportRateBatchRequest,
  RejectImportRateRequest,
  RejectRateMarginRequest,
  SetCostActiveRequest,
  UpdateCostRequest,
  UpdateRateRequest,
} from '@/core/interfaces/pricing'

type NoContent = Record<string, never>

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

const IMPORT_STATUSES = new Set<ImportStatus>(['Pending', 'Approved', 'Rejected', 'Created'])

/**
 * The first release of the new Pricing contract inverted Status and RawDataJson
 * while mapping the browse DTO. Keeping this small normalizer makes Web work
 * with that release and with the corrected contract.
 */
function normalizeImportRate(value: ImportRateDto): ImportRateDto {
  const status = String(value.status ?? '')
  const rawDataJson = String(value.rawDataJson ?? '')

  if (
    !IMPORT_STATUSES.has(status as ImportStatus) &&
    IMPORT_STATUSES.has(rawDataJson as ImportStatus)
  ) {
    return { ...value, status: rawDataJson as ImportStatus, rawDataJson: status }
  }

  return value
}

export const PricingService = {
  async browseCosts(query?: BrowseCostsQuery): Promise<PagedResponse<CostDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseCosts,
      path: withQuery(Endpoints.browseCosts.path, query),
    })

    return unwrapPagedResponse<CostDto>(response)
  },

  async selectCosts(query?: BrowseCostsQuery): Promise<CostSelectDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.selectCosts,
      path: withQuery(Endpoints.selectCosts.path, query),
    })

    return unwrapListResponse<CostSelectDto>(response)
  },

  async getCost(costId: string): Promise<CostDto> {
    const response = await callEndpoint<unknown>(Endpoints.getCostById, { params: { costId } })
    return unwrapApiResponse<CostDto>(response as never)
  },

  async createCost(payload: CreateCostRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateCostRequest>(Endpoints.createCost, {
      body: payload,
    })

    return unwrapApiResponse<string>(response as never)
  },

  updateCost(costId: string, payload: UpdateCostRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateCostRequest>(Endpoints.updateCost, {
      params: { costId },
      body: payload,
    })
  },

  setCostActive(costId: string, payload: SetCostActiveRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetCostActiveRequest>(Endpoints.setCostActive, {
      params: { costId },
      body: payload,
    })
  },

  deleteCost(costId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteCost, { params: { costId } })
  },

  async getDecisionDashboard(
    query?: PricingDecisionDashboardQuery,
  ): Promise<PricingDecisionDashboardDto> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.getPricingDecisionDashboard,
      path: withQuery(Endpoints.getPricingDecisionDashboard.path, query),
    })

    return unwrapApiResponse<PricingDecisionDashboardDto>(response as never)
  },

  async browseImportRates(query?: BrowseImportRatesQuery): Promise<PagedResponse<ImportRateDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseImportRates,
      path: withQuery(Endpoints.browseImportRates.path, query),
    })
    const result = unwrapPagedResponse<ImportRateDto>(response)

    return { ...result, items: result.items.map(normalizeImportRate) }
  },

  async selectImportRates(query?: BrowseImportRatesQuery): Promise<ImportRateSelectDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.selectImportRates,
      path: withQuery(Endpoints.selectImportRates.path, query),
    })

    return unwrapListResponse<ImportRateSelectDto>(response).map(normalizeImportRate)
  },

  async getImportRate(importRateId: string): Promise<ImportRateDto> {
    const response = await callEndpoint<unknown>(Endpoints.getImportRateById, {
      params: { importRateId },
    })

    return normalizeImportRate(unwrapApiResponse<ImportRateDto>(response as never))
  },

  async createImportRate(payload: CreateImportRateRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateImportRateRequest>(
      Endpoints.createImportRate,
      {
        body: payload,
      },
    )

    return unwrapApiResponse<string>(response as never)
  },

  async extractImportRates(
    file: File,
    profileSlug: string,
    correlationId?: string,
  ): Promise<ExtractImportRatesResultDto> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('profileSlug', profileSlug)
    if (correlationId) formData.append('correlationId', correlationId)

    const response = await callEndpoint<unknown, FormData>(Endpoints.extractImportRates, {
      body: formData,
      isFormData: true,
    })

    return unwrapApiResponse<ExtractImportRatesResultDto>(response as never)
  },

  approveImportRates(ids: string[]): Promise<NoContent> {
    return callEndpoint<NoContent, ImportRateBatchRequest>(Endpoints.approveImportRates, {
      body: { ids },
    })
  },

  approveImportRate(importRateId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.approveImportRate, { params: { importRateId } })
  },

  rejectImportRates(ids: string[], payload: RejectImportRateRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RejectImportRateBatchRequest>(Endpoints.rejectImportRates, {
      body: { ids, reason: payload.reason },
    })
  },

  rejectImportRate(importRateId: string, payload: RejectImportRateRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RejectImportRateRequest>(Endpoints.rejectImportRate, {
      params: { importRateId },
      body: payload,
    })
  },

  deleteImportRates(ids: string[]): Promise<NoContent> {
    return callEndpoint<NoContent, DeleteBatchRequest>(Endpoints.deleteImportRates, {
      body: { ids },
    })
  },

  async browseRates(query?: BrowseRatesQuery): Promise<PagedResponse<RateDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseRates,
      path: withQuery(Endpoints.browseRates.path, query),
    })

    return unwrapPagedResponse<RateDto>(response)
  },

  async getRate(rateId: string): Promise<RateDto> {
    const response = await callEndpoint<unknown>(Endpoints.getRateById, { params: { rateId } })
    return unwrapApiResponse<RateDto>(response as never)
  },

  async createRate(payload: CreateRateRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateRateRequest>(Endpoints.createRate, {
      body: payload,
    })

    return unwrapApiResponse<string>(response as never)
  },

  updateRate(rateId: string, payload: UpdateRateRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateRateRequest>(Endpoints.updateRate, {
      params: { rateId },
      body: payload,
    })
  },

  async duplicateRate(rateId: string, payload: DuplicateRateRequest): Promise<string> {
    const response = await callEndpoint<unknown, DuplicateRateRequest>(Endpoints.duplicateRate, {
      params: { rateId },
      body: payload,
    })

    return unwrapApiResponse<string>(response as never)
  },

  approveRateMargin(rateId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.approveRateMargin, { params: { rateId } })
  },

  rejectRateMargin(rateId: string, payload: RejectRateMarginRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RejectRateMarginRequest>(Endpoints.rejectRateMargin, {
      params: { rateId },
      body: payload,
    })
  },

  deleteRates(ids: string[]): Promise<NoContent> {
    return callEndpoint<NoContent, DeleteBatchRequest>(Endpoints.deleteRates, { body: { ids } })
  },
}
