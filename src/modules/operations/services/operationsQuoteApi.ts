import { fetchClient } from '@/core/api/fetchConfig'
import type { RateDto } from '@/core/interfaces/pricing'

// Explicit operational DTO, never the financial RateDto routes.
export type OperationsQuoteSummary = Pick<RateDto,
  'id' | 'rateCode' | 'quoNumber' | 'clientName' | 'clientAccountId' | 'idtraNumber' |
  'polName' | 'poeName' | 'podName' | 'shipmentMode' | 'status'>
export type OperationsQuoteDetail = OperationsQuoteSummary & Pick<RateDto,
  'operationType' | 'polId' | 'polCode' | 'poeId' | 'poeCode' | 'podId' | 'podCode' |
  'incotermCode' | 'incotermName' | 'carrierId' | 'carrierCode' | 'carrierName' |
  'agentId' | 'agentCode' | 'agentName' | 'warehouseId' | 'totalPackages' | 'totalWeightKg' |
  'totalVolumeCbm' | 'containerTypeId' | 'containerTypeName' | 'containerTypeCode' |
  'containerQuantity' | 'containers' | 'services' | 'cargoLines' |
  'inlandPickupLocations' | 'inlandPickupLocation' | 'pickupLocations' |
  'pickupAddress' | 'pickupLatitude' | 'pickupLongitude' |
  'inlandDeliveryLocations' | 'inlandDeliveryLocation'>
const base = '/api/pricing/operations-quotes'
export const operationsQuoteApi = {
  search(search: string, accountId?: string) {
    const query = new URLSearchParams({ search: search.trim(), ...(accountId ? { accountId } : {}) })
    return fetchClient<{ items: OperationsQuoteSummary[] }>(base + '?' + query, { method: 'GET' })
  },
  detail(rateId: string) {
    return fetchClient<OperationsQuoteDetail>(base + '/' + encodeURIComponent(rateId), { method: 'GET' })
  },
}
