import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  ApproveMarginApprovalRequest,
  BrowseCostsQuery,
  BrowseImportFclRatesQuery,
  BrowseRateHeadersQuery,
  CostDto,
  CostSelectDto,
  CreateCostRequest,
  CreateFclRateDetailRequest,
  CreateImportFclRateRequest,
  CreateRateCostDetailRequest,
  CreateRateFromImportFclRateRequest,
  CreateRateHeaderRequest,
  DuplicateRateHeaderRequest,
  DeleteBatchRequest,
  ExtractImportFclRatesResultDto,
  ImportFclRateDto,
  ImportFclRateSelectDto,
  RateCostDetailDto,
  RateHeaderDto,
  RateHeaderSelectDto,
  RejectImportFclRateRequest,
  RejectMarginApprovalRequest,
  SetCostActiveRequest,
  SetRateHeaderActiveRequest,
  SetRateHeaderAmountsRequest,
  UpdateCostRequest,
  UpdateFclRateDetailRequest,
  UpdateRateCostDetailRequest,
  UpdateRateHeaderRequest,
} from '@/core/interfaces/pricing'

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

type NoContent = Record<string, never>

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

  async createCost(payload: CreateCostRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateCostRequest>(Endpoints.createCost, {
      body: payload,
    })

    return unwrapApiResponse<string>(response as any)
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

  async browseImportFclRates(
    query?: BrowseImportFclRatesQuery,
  ): Promise<PagedResponse<ImportFclRateDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseImportFclRates,
      path: withQuery(Endpoints.browseImportFclRates.path, query),
    })

    return unwrapPagedResponse<ImportFclRateDto>(response)
  },

  async selectImportFclRates(
    query?: BrowseImportFclRatesQuery,
  ): Promise<ImportFclRateSelectDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.selectImportFclRates,
      path: withQuery(Endpoints.selectImportFclRates.path, query),
    })

    return unwrapListResponse<ImportFclRateSelectDto>(response)
  },

  async getImportFclRate(importFclRateId: string): Promise<ImportFclRateDto> {
    const response = await callEndpoint<unknown>(Endpoints.getImportFclRateById, {
      params: { importFclRateId },
    })

    return unwrapApiResponse<ImportFclRateDto>(response as any)
  },

  async createImportFclRate(payload: CreateImportFclRateRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateImportFclRateRequest>(
      Endpoints.createImportFclRate,
      { body: payload },
    )

    return unwrapApiResponse<string>(response as any)
  },

  async extractImportFclRates(
    file: File,
    profileCode?: string | null,
  ): Promise<ExtractImportFclRatesResultDto> {
    const formData = new FormData()
    formData.append('file', file)

    if (profileCode?.trim()) {
      formData.append('profileCode', profileCode.trim())
    }

    const response = await callEndpoint<unknown, FormData>(Endpoints.extractImportFclRates, {
      body: formData,
      isFormData: true,
    })

    return unwrapApiResponse<ExtractImportFclRatesResultDto>(response as any)
  },

  approveImportFclRate(importFclRateId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.approveImportFclRate, {
      params: { importFclRateId },
    })
  },

  rejectImportFclRate(importFclRateId: string, payload: RejectImportFclRateRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RejectImportFclRateRequest>(Endpoints.rejectImportFclRate, {
      params: { importFclRateId },
      body: payload,
    })
  },

  markImportFclRateAsImportedOnly(importFclRateId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.markImportFclRateAsImportedOnly, {
      params: { importFclRateId },
    })
  },

  async createRateFromImportFclRate(
    importFclRateId: string,
    payload: CreateRateFromImportFclRateRequest,
  ): Promise<string> {
    const response = await callEndpoint<unknown, CreateRateFromImportFclRateRequest>(
      Endpoints.createRateFromImportFclRate,
      { params: { importFclRateId }, body: payload },
    )

    return unwrapApiResponse<string>(response as any)
  },

  deleteImportFclRate(importFclRateId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteImportFclRate, {
      params: { importFclRateId },
    })
  },

  deleteImportFclRatesBatch(ids: string[]): Promise<NoContent> {
    return callEndpoint<NoContent, DeleteBatchRequest>(Endpoints.deleteImportFclRatesBatch, {
      body: { ids },
    })
  },

  async browseRateHeaders(query?: BrowseRateHeadersQuery): Promise<PagedResponse<RateHeaderDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseRateHeaders,
      path: withQuery(Endpoints.browseRateHeaders.path, query),
    })

    return unwrapPagedResponse<RateHeaderDto>(response)
  },

  async selectRateHeaders(query?: BrowseRateHeadersQuery): Promise<RateHeaderSelectDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.selectRateHeaders,
      path: withQuery(Endpoints.selectRateHeaders.path, query),
    })

    return unwrapListResponse<RateHeaderSelectDto>(response)
  },

  async getActiveFclRates(query?: BrowseRateHeadersQuery): Promise<RateHeaderDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.getActiveFclRates,
      path: withQuery(Endpoints.getActiveFclRates.path, query),
    })

    return unwrapListResponse<RateHeaderDto>(response)
  },

  async getRateHeader(rateHeaderId: string): Promise<RateHeaderDto> {
    const response = await callEndpoint<unknown>(Endpoints.getRateHeaderById, {
      params: { rateHeaderId },
    })

    return unwrapApiResponse<RateHeaderDto>(response as any)
  },

  async createRateHeader(payload: CreateRateHeaderRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateRateHeaderRequest>(
      Endpoints.createRateHeader,
      { body: payload },
    )

    return unwrapApiResponse<string>(response as any)
  },

  updateRateHeader(rateHeaderId: string, payload: UpdateRateHeaderRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateRateHeaderRequest>(Endpoints.updateRateHeader, {
      params: { rateHeaderId },
      body: payload,
    })
  },

  setRateHeaderAmounts(rateHeaderId: string, payload: SetRateHeaderAmountsRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetRateHeaderAmountsRequest>(Endpoints.setRateHeaderAmounts, {
      params: { rateHeaderId },
      body: payload,
    })
  },

  setRateHeaderActive(rateHeaderId: string, payload: SetRateHeaderActiveRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetRateHeaderActiveRequest>(Endpoints.setRateHeaderActive, {
      params: { rateHeaderId },
      body: payload,
    })
  },

  async duplicateRateHeader(rateHeaderId: string, payload: DuplicateRateHeaderRequest): Promise<string> {
    const response = await callEndpoint<unknown, DuplicateRateHeaderRequest>(Endpoints.duplicateRateHeader, {
      params: { rateHeaderId },
      body: payload,
    })

    return unwrapApiResponse<string>(response as any)
  },

  deleteRateHeader(rateHeaderId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteRateHeader, { params: { rateHeaderId } })
  },

  deleteRateHeadersBatch(ids: string[]): Promise<NoContent> {
    return callEndpoint<NoContent, DeleteBatchRequest>(Endpoints.deleteRateHeadersBatch, {
      body: { ids },
    })
  },

  async addFclRateDetail(rateHeaderId: string, payload: CreateFclRateDetailRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateFclRateDetailRequest>(
      Endpoints.addFclRateDetail,
      { params: { rateHeaderId }, body: payload },
    )

    return unwrapApiResponse<string>(response as any)
  },

  updateFclRateDetail(
    rateHeaderId: string,
    fclRateDetailId: string,
    payload: UpdateFclRateDetailRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateFclRateDetailRequest>(Endpoints.updateFclRateDetail, {
      params: { rateHeaderId, fclRateDetailId },
      body: payload,
    })
  },

  removeFclRateDetail(rateHeaderId: string, fclRateDetailId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.removeFclRateDetail, {
      params: { rateHeaderId, fclRateDetailId },
    })
  },

  async addRateCostDetail(rateHeaderId: string, payload: CreateRateCostDetailRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateRateCostDetailRequest>(
      Endpoints.addRateCostDetail,
      { params: { rateHeaderId }, body: payload },
    )

    return unwrapApiResponse<string>(response as any)
  },

  updateRateCostDetail(
    rateHeaderId: string,
    rateCostDetailId: string,
    payload: UpdateRateCostDetailRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateRateCostDetailRequest>(Endpoints.updateRateCostDetail, {
      params: { rateHeaderId, rateCostDetailId },
      body: payload,
    })
  },

  removeRateCostDetail(rateHeaderId: string, rateCostDetailId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.removeRateCostDetail, {
      params: { rateHeaderId, rateCostDetailId },
    })
  },

  approveMarginApproval(
    rateHeaderId: string,
    marginApprovalId: string,
    payload: ApproveMarginApprovalRequest = {},
  ): Promise<NoContent> {
    return callEndpoint<NoContent, ApproveMarginApprovalRequest>(Endpoints.approveMarginApproval, {
      params: { rateHeaderId, marginApprovalId },
      body: payload,
    })
  },

  rejectMarginApproval(
    rateHeaderId: string,
    marginApprovalId: string,
    payload: RejectMarginApprovalRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, RejectMarginApprovalRequest>(Endpoints.rejectMarginApproval, {
      params: { rateHeaderId, marginApprovalId },
      body: payload,
    })
  },
}
