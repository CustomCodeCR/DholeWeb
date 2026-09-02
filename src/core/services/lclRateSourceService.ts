import { callEndpointWithQuery } from '@/core/api/callEndpointWithQuery'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { Endpoint } from '@/core/composables/endpoints'
import type { ChargeBasis, CostDetailType, CostType } from '@/core/interfaces/pricing'

const endpoints = {
  coloaders: {
    method: 'GET',
    path: '/api/pricing/lcl-rate-sources/coloaders',
    headers: { Accept: 'application/json' },
  },
} satisfies Record<string, Endpoint>

export interface LclColoaderRateLineDto extends Record<string, unknown> {
  rateHeaderId: string
  id: string
  costId: string | null
  name: string
  costDetailType: CostDetailType
  costType: CostType
  chargeBasis: ChargeBasis
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  quantity: number
  utilityAmount: number
  notes: string | null
  applyDestinationTax: boolean
  destinationTaxRate: number
}

export interface LclColoaderRateDto extends Record<string, unknown> {
  sourceType: 'Coloader'
  id: string
  rateCode: string
  rateName: string
  providerId: string | null
  providerName: string | null
  providerCode: string | null
  carrierId: string | null
  carrierName: string | null
  carrierCode: string | null
  polId: string
  polName: string
  polCode: string
  poeId: string
  poeName: string
  poeCode: string
  podId: string | null
  podName: string | null
  podCode: string | null
  incotermId: string | null
  incotermName: string | null
  incotermCode: string | null
  currencyId: string
  currencyName: string
  currencyCode: string
  freeDays: number
  transitTime: string | null
  validFrom: string
  validTo: string
  chargeableQuantity: number
  totalCostAmount: number
  totalSaleAmount: number
  totalUtilityAmount: number
  marginPercentage: number
  includes: string | null
  subjectTo: string | null
  excludes: string | null
  status: string
  lines: LclColoaderRateLineDto[]
}

export interface BrowseLclColoaderRatesQuery {
  polId?: string | null
  poeId?: string | null
  podId?: string | null
  incotermId?: string | null
  quoteDate?: string | null
}

export const LclRateSourceService = {
  async browseColoaders(query: BrowseLclColoaderRatesQuery): Promise<LclColoaderRateDto[]> {
    const response = await callEndpointWithQuery<unknown>(endpoints.coloaders, {
      query: query as Record<string, unknown>,
    })
    return unwrapListResponse<LclColoaderRateDto>(response)
  },
}
