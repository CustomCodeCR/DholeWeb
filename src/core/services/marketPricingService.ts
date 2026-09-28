import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { Endpoints } from '@/core/composables/endpoints'
import type {
  ApplyAutoPricingRequest,
  ApproveAutoPricingRequest,
  AutoPricingApplyDto,
  AutoPricingApprovalDto,
  AutoPricingCalculationDto,
  AutoPricingDecisionDto,
  AutoPricingOverrideDto,
  CalculateAutoPricingRequest,
  CalculateMarketBenchmarkRequest,
  MarketBenchmarkAmountKind,
  MarketBenchmarkDto,
  OverrideAutoPricingRequest,
} from '@/core/interfaces/marketPricing'

export interface RateMarketBenchmarkQuery extends Record<string, unknown> {
  referenceDate?: string | null
  containerTypeId?: string | null
  amountKind?: MarketBenchmarkAmountKind | null
  targetPercentile?: number | null
  competitiveCeilingPercentile?: number | null
}

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

export const MarketPricingService = {
  async calculateMarketBenchmark(
    payload: CalculateMarketBenchmarkRequest,
  ): Promise<MarketBenchmarkDto> {
    const response = await callEndpoint<unknown, CalculateMarketBenchmarkRequest>(
      Endpoints.calculateMarketBenchmark,
      { body: payload },
    )
    return unwrapApiResponse<MarketBenchmarkDto>(response as never)
  },

  async getRateMarketBenchmark(
    rateId: string,
    query?: RateMarketBenchmarkQuery,
  ): Promise<MarketBenchmarkDto> {
    const endpoint = {
      ...Endpoints.getRateMarketBenchmark,
      path: withQuery(Endpoints.getRateMarketBenchmark.path, query),
    }
    const response = await callEndpoint<unknown>(endpoint, { params: { rateId } })
    return unwrapApiResponse<MarketBenchmarkDto>(response as never)
  },

  async calculateAutoPricing(
    rateId: string,
    payload: CalculateAutoPricingRequest,
  ): Promise<AutoPricingCalculationDto> {
    const response = await callEndpoint<unknown, CalculateAutoPricingRequest>(
      Endpoints.calculateAutoPricing,
      {
        params: { rateId },
        body: payload,
      },
    )
    return unwrapApiResponse<AutoPricingCalculationDto>(response as never)
  },

  async recalculateAutoPricing(
    rateId: string,
    payload: CalculateAutoPricingRequest,
  ): Promise<AutoPricingCalculationDto> {
    const response = await callEndpoint<unknown, CalculateAutoPricingRequest>(
      Endpoints.recalculateAutoPricing,
      {
        params: { rateId },
        body: payload,
      },
    )
    return unwrapApiResponse<AutoPricingCalculationDto>(response as never)
  },

  async getAutoPricing(rateId: string): Promise<AutoPricingDecisionDto> {
    const response = await callEndpoint<unknown>(
      Endpoints.getAutoPricing,
      { params: { rateId } },
    )
    return unwrapApiResponse<AutoPricingDecisionDto>(response as never)
  },

  async applyAutoPricing(
    rateId: string,
    payload: ApplyAutoPricingRequest,
  ): Promise<AutoPricingApplyDto> {
    const response = await callEndpoint<unknown, ApplyAutoPricingRequest>(
      Endpoints.applyAutoPricing,
      {
        params: { rateId },
        body: payload,
      },
    )
    return unwrapApiResponse<AutoPricingApplyDto>(response as never)
  },

  async overrideAutoPricing(
    rateId: string,
    payload: OverrideAutoPricingRequest,
  ): Promise<AutoPricingOverrideDto> {
    const response = await callEndpoint<unknown, OverrideAutoPricingRequest>(
      Endpoints.overrideAutoPricing,
      {
        params: { rateId },
        body: payload,
      },
    )
    return unwrapApiResponse<AutoPricingOverrideDto>(response as never)
  },

  async approveAutoPricing(
    rateId: string,
    payload: ApproveAutoPricingRequest,
  ): Promise<AutoPricingApprovalDto> {
    const response = await callEndpoint<unknown, ApproveAutoPricingRequest>(
      Endpoints.approveAutoPricing,
      {
        params: { rateId },
        body: payload,
      },
    )
    return unwrapApiResponse<AutoPricingApprovalDto>(response as never)
  },
}
