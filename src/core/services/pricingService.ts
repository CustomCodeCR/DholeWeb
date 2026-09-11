import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import { Endpoints } from '@/core/composables/endpoints'
import { toQueryString } from '@/core/api/queryString'
import type {
  BrowseCostsQuery,
  AssignImportRatePoeRequest,
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
  GenerateRateDocumentRequest,
  ImportRateBatchRequest,
  ImportRateDto,
  ImportRateSelectDto,
  ImportStatus,
  PricingDecisionDashboardDto,
  PricingDecisionDashboardQuery,
  PricingRateDashboardDto,
  PricingRateDashboardQuery,
  PricingExchangeRateDto,
  RateDto,
  RateRevisionDto,
  RateTermItemDto,
  CreateRateTermItemRequest,
  UpdateRateTermItemRequest,
  SetRateTermItemActiveRequest,
  CarrierFreeDayRuleDto,
  UpsertCarrierFreeDayRuleRequest,
  RateTermBlockDto,
  UpsertRateTermBlockRequest,
  RejectImportRateBatchRequest,
  RejectImportRateRequest,
  ReviewImportRateRequest,
  RejectRateMarginRequest,
  SetCostActiveRequest,
  SetRateStatusRequest,
  UpdateCostRequest,
  UpdateRateRequest,
} from '@/core/interfaces/pricing'

type NoContent = Record<string, never>

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

const IMPORT_STATUSES = new Set<ImportStatus>([
  'Pending',
  'Approved',
  'Rejected',
  'Created',
  'Expired',
])

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

  async browseRateTermItems(isActive?: boolean): Promise<RateTermItemDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseRateTermItems,
      path: withQuery(Endpoints.browseRateTermItems.path, { isActive }),
    })
    return unwrapListResponse<RateTermItemDto>(response)
  },

  async createRateTermItem(payload: CreateRateTermItemRequest): Promise<string> {
    const response = await callEndpoint<unknown, CreateRateTermItemRequest>(
      Endpoints.createRateTermItem,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateRateTermItem(
    rateTermItemId: string,
    payload: UpdateRateTermItemRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateRateTermItemRequest>(Endpoints.updateRateTermItem, {
      params: { rateTermItemId },
      body: payload,
    })
  },

  setRateTermItemActive(
    rateTermItemId: string,
    payload: SetRateTermItemActiveRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, SetRateTermItemActiveRequest>(Endpoints.setRateTermItemActive, {
      params: { rateTermItemId },
      body: payload,
    })
  },

  deleteRateTermItem(rateTermItemId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteRateTermItem, { params: { rateTermItemId } })
  },

  async selectRateTermItems(): Promise<RateTermItemDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.selectRateTermItems)
    return unwrapListResponse<RateTermItemDto>(response)
  },

  async browseCarrierFreeDayRules(): Promise<CarrierFreeDayRuleDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.browseCarrierFreeDayRules)
    return unwrapListResponse<CarrierFreeDayRuleDto>(response)
  },

  async resolveCarrierFreeDayRule(carrierId: string): Promise<CarrierFreeDayRuleDto | null> {
    try {
      const response = await callEndpoint<unknown>(Endpoints.resolveCarrierFreeDayRule, {
        params: { carrierId },
      })
      return unwrapApiResponse<CarrierFreeDayRuleDto>(response as never)
    } catch (error: unknown) {
      const status = Number((error as { status?: number })?.status ?? 0)
      if (status === 404) return null
      throw error
    }
  },

  async createCarrierFreeDayRule(payload: UpsertCarrierFreeDayRuleRequest): Promise<string> {
    const response = await callEndpoint<unknown, UpsertCarrierFreeDayRuleRequest>(
      Endpoints.createCarrierFreeDayRule,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateCarrierFreeDayRule(
    ruleId: string,
    payload: UpsertCarrierFreeDayRuleRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, UpsertCarrierFreeDayRuleRequest>(
      Endpoints.updateCarrierFreeDayRule,
      { params: { ruleId }, body: payload },
    )
  },

  deleteCarrierFreeDayRule(ruleId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteCarrierFreeDayRule, { params: { ruleId } })
  },

  async browseRateTermBlocks(): Promise<RateTermBlockDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.browseRateTermBlocks)
    return unwrapListResponse<RateTermBlockDto>(response)
  },

  async resolveRateTermBlocks(query: {
    rateType?: string
    shipmentMode?: string
    poeId?: string
    incotermId?: string
  }): Promise<RateTermBlockDto[]> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.resolveRateTermBlocks,
      path: withQuery(Endpoints.resolveRateTermBlocks.path, query),
    })
    return unwrapListResponse<RateTermBlockDto>(response)
  },

  async createRateTermBlock(payload: UpsertRateTermBlockRequest): Promise<string> {
    const response = await callEndpoint<unknown, UpsertRateTermBlockRequest>(
      Endpoints.createRateTermBlock,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  updateRateTermBlock(blockId: string, payload: UpsertRateTermBlockRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpsertRateTermBlockRequest>(Endpoints.updateRateTermBlock, {
      params: { blockId },
      body: payload,
    })
  },

  deleteRateTermBlock(blockId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteRateTermBlock, { params: { blockId } })
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

  async getRateDashboard(query?: PricingRateDashboardQuery): Promise<PricingRateDashboardDto> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.getRateDashboard,
      path: withQuery(Endpoints.getRateDashboard.path, query),
    })

    return unwrapApiResponse<PricingRateDashboardDto>(response as never)
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
    correlationId?: string,
  ): Promise<ExtractImportRatesResultDto> {
    const formData = new FormData()
    formData.append('file', file)
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

  assignImportRatePoe(
    importRateId: string,
    payload: AssignImportRatePoeRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, AssignImportRatePoeRequest>(Endpoints.assignImportRatePoe, {
      params: { importRateId },
      body: payload,
    })
  },

  reviewImportRate(importRateId: string, payload: ReviewImportRateRequest): Promise<NoContent> {
    return callEndpoint<NoContent, ReviewImportRateRequest>(Endpoints.reviewImportRate, {
      params: { importRateId },
      body: payload,
    })
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

  async getUsdCrcExchangeRate(): Promise<PricingExchangeRateDto> {
    const response = await callEndpoint<unknown>(Endpoints.getUsdCrcExchangeRate)
    return unwrapApiResponse<PricingExchangeRateDto>(response as never)
  },

  async browseRates(query?: BrowseRatesQuery): Promise<PagedResponse<RateDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseRates,
      path: withQuery(Endpoints.browseRates.path, query),
    })

    return unwrapPagedResponse<RateDto>(response)
  },

  async getRateRevisions(rateId: string): Promise<RateRevisionDto[]> {
    const response = await callEndpoint<unknown>({ method: 'GET', path: `/api/pricing/rates/${rateId}/revisions` })
    return unwrapApiResponse<RateRevisionDto[]>(response as never)
  },

  async getRate(rateId: string): Promise<RateDto> {
    const response = await callEndpoint<unknown>(Endpoints.getRateById, { params: { rateId } })
    return unwrapApiResponse<RateDto>(response as never)
  },

  async generateRateDocument(
    rateId: string,
    payload: GenerateRateDocumentRequest = {},
  ): Promise<Blob> {
    const path = Endpoints.generateRateDocument.path.replace('{{rateId}}', rateId)
    return fetchBlobClient(path, {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: {
        templateCode: payload.templateCode?.trim() || 'pricing-fcl-client-quote',
        format: payload.format || 'pdf',
      },
    })
  },

  async downloadRateDocument(
    rateId: string,
    fileName: string,
    payload: GenerateRateDocumentRequest = {},
  ): Promise<void> {
    const format = payload.format || 'pdf'
    const blob = await this.generateRateDocument(rateId, { ...payload, format })
    const normalizedName = (fileName.trim() || 'cotizacion')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
    const extension = `.${format}`
    downloadBlob(
      blob,
      normalizedName.toLowerCase().endsWith(extension)
        ? normalizedName
        : normalizedName + extension,
    )
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

  setRateStatus(rateId: string, payload: SetRateStatusRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetRateStatusRequest>(Endpoints.setRateStatus, {
      params: { rateId },
      body: payload,
    })
  },

  deleteRates(ids: string[]): Promise<NoContent> {
    return callEndpoint<NoContent, DeleteBatchRequest>(Endpoints.deleteRates, { body: { ids } })
  },
}
