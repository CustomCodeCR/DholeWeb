import { callEndpoint } from '@/core/api/callEndpoint'
import { callEndpointWithQuery } from '@/core/api/callEndpointWithQuery'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import type { Endpoint } from '@/core/composables/endpoints'

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }
const acceptJson = { Accept: 'application/json' }

const endpoints = {
  browse: { method: 'GET', path: '/api/pricing/own-lcl-consolidations', headers: acceptJson },
  get: { method: 'GET', path: '/api/pricing/own-lcl-consolidations/{{id}}', headers: acceptJson },
  createAutomatic: { method: 'POST', path: '/api/pricing/own-lcl-automation/consolidations', headers: jsonHeaders },
  updateAutomatic: { method: 'PUT', path: '/api/pricing/own-lcl-automation/consolidations/{{id}}', headers: jsonHeaders },
  getAutomation: { method: 'GET', path: '/api/pricing/own-lcl-automation/consolidations/{{id}}', headers: acceptJson },
  destinationPreview: { method: 'GET', path: '/api/pricing/own-lcl-automation/destination-preview', headers: acceptJson },
  calculate: { method: 'POST', path: '/api/pricing/own-lcl-consolidations/{{id}}/calculate', headers: jsonHeaders },
} satisfies Record<string, Endpoint>

export interface OwnLclConsolidationDto {
  id: string
  consolidationNumber: number
  name: string
  booking: string | null
  etd: string | null
  carrierId: string | null
  carrierName: string | null
  carrierCode: string | null
  containerId: string | null
  containerName: string | null
  containerCode: string | null
  polId: string | null
  polName: string | null
  polCode: string
  poeId: string | null
  poeName: string | null
  poeCode: string | null
  podId: string | null
  podName: string | null
  podCode: string | null
  oceanFreight: number
  maximumCbm: number
  carrierDestinationCostTotal: number
  panamaToCostaRicaCost: number
  bunkerCost: number
  costaRicaTransferBaseCbm: number
  oceanCostPerCbm: number
  destinationCostPerCbm: number
  panamaBaseCostPerCbm: number
  panamaToCostaRicaCostPerCbm: number
  costaRicaProjectedCostPerCbm: number
  matrixVersion: string
  status: string
  isActive: boolean
}

export interface OwnLclDestinationChargeDto {
  code: string
  name: string
  amount: number
  basis: string
  required: boolean
  optional: boolean
  included: boolean
  components: string[]
}

export interface OwnLclDestinationProfileDto {
  profileCode: string
  version: string
  profileName: string
  currency: string
  arrivalPortCode: string
  finalRatePointCode: string
  finalRatePointName: string
  includeEmptyReturn: boolean
  charges: OwnLclDestinationChargeDto[]
  totalCost: number
  costPerCbm: number
  costaRicaTransfer: {
    panamaToCostaRica: number
    bunker: number
    baseCbm: number
  }
  costsEditable: boolean
  source: string
}

export interface OwnLclAutomationSnapshotDto {
  panamaArrivalPortId: string | null
  panamaArrivalPortName: string | null
  panamaArrivalPortCode: string | null
  destinationProfileCode: string | null
  destinationProfileVersion: string | null
  destinationProfile: OwnLclDestinationProfileDto | null
  includeEmptyReturn: boolean
}

export interface OwnLclCargoLineRequest {
  description: string
  units: number
  totalWeightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export interface OwnLclQuoteLine {
  name: string
  chargeBasis: string
  quantity: number
  costUnit: number
  saleUnit: number
  costTotal: number
  saleTotal: number
  profit: number
}

export interface OwnLclQuoteCalculationDto {
  consolidationId: string
  consolidationNumber: number
  consolidationName: string
  matrixVersion: string
  polCode: string
  destinationCode: string
  incoterm: string
  cargoLines: Array<{
    description: string
    units: number
    totalWeightKg: number
    dimensionalCbm: number
    weightCbm: number
    chargeableCbm: number
  }>
  chargeableCbm: number
  billableCbm: number
  baseOceanCostPerCbm: number
  originSurchargePerCbm: number
  destinationCostPerCbm: number
  panamaBaseCostPerCbm: number
  costaRicaTransferCostPerCbm: number
  costaRicaProjectedCostPerCbm: number
  freightCostPerCbm: number
  recommendedSalePerCbm: number
  freightSalePerCbm: number
  lines: OwnLclQuoteLine[]
  totalCost: number
  subtotalSale: number
  discount: number
  finalSale: number
  profitAmount: number
  profitPerCbm: number
  profitPercentage: number
  minimumProfitPerCbm: number
  oceanProfitPerCbm: number
  meetsMinimumMargin: boolean
  requiresLowMarginApproval: boolean
}

export interface AutomaticOwnLclConsolidationRequest {
  booking: string | null
  etd: string | null
  carrierId: string | null
  carrierName: string | null
  carrierCode: string | null
  containerId: string | null
  containerName: string | null
  containerCode: string | null
  polId: string | null
  polName: string | null
  polCode: string
  oceanFreight: number
  maximumCbm: number
  panamaArrivalPortId: string | null
  panamaArrivalPortName: string | null
  panamaArrivalPortCode: string
  includeEmptyReturn: boolean
  bunkerCost: number
}

export interface CalculateOwnLclQuoteRequest {
  destinationCode: string
  incoterm: string
  cargoLines: OwnLclCargoLineRequest[]
  polCode?: string | null
  salePerCbm?: number | null
  sets: number
  hbl: number
  pickupCost: number
  pickupSale: number
  discount: number
}

type CreatedOwnLcl = {
  id: string
  consolidationNumber: number
  name: string
  matrixVersion: string
  destinationProfile: OwnLclDestinationProfileDto
}

export const OwnLclConsolidationService = {
  async browse(): Promise<OwnLclConsolidationDto[]> {
    const response = await callEndpoint<unknown>(endpoints.browse)
    return unwrapListResponse<OwnLclConsolidationDto>(response)
  },
  async get(id: string): Promise<OwnLclConsolidationDto> {
    const response = await callEndpoint<unknown>(endpoints.get, { params: { id } })
    return unwrapApiResponse<OwnLclConsolidationDto>(response as never)
  },
  async getAutomation(id: string): Promise<OwnLclAutomationSnapshotDto> {
    const response = await callEndpoint<unknown>(endpoints.getAutomation, { params: { id } })
    return unwrapApiResponse<OwnLclAutomationSnapshotDto>(response as never)
  },
  async previewDestinationCosts(query: {
    carrierCode?: string | null
    carrierName?: string | null
    arrivalPortCode?: string | null
    maximumCbm: number
    includeEmptyReturn: boolean
    containerCode?: string | null
    bunkerCost?: number | null
  }): Promise<OwnLclDestinationProfileDto> {
    const response = await callEndpointWithQuery<unknown>(endpoints.destinationPreview, { query })
    return unwrapApiResponse<OwnLclDestinationProfileDto>(response as never)
  },
  async create(payload: AutomaticOwnLclConsolidationRequest): Promise<CreatedOwnLcl> {
    const response = await callEndpoint<unknown, AutomaticOwnLclConsolidationRequest>(endpoints.createAutomatic, { body: payload })
    return unwrapApiResponse<CreatedOwnLcl>(response as never)
  },
  async update(id: string, payload: AutomaticOwnLclConsolidationRequest): Promise<OwnLclDestinationProfileDto> {
    const response = await callEndpoint<unknown, AutomaticOwnLclConsolidationRequest>(endpoints.updateAutomatic, { params: { id }, body: payload })
    return unwrapApiResponse<OwnLclDestinationProfileDto>(response as never)
  },
  async calculate(id: string, payload: CalculateOwnLclQuoteRequest): Promise<OwnLclQuoteCalculationDto> {
    const response = await callEndpoint<unknown, CalculateOwnLclQuoteRequest>(endpoints.calculate, { params: { id }, body: payload })
    return unwrapApiResponse<OwnLclQuoteCalculationDto>(response as never)
  },
}
