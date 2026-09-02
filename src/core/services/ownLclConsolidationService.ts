import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import type { Endpoint } from '@/core/composables/endpoints'

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }
const acceptJson = { Accept: 'application/json' }

const endpoints = {
  browse: { method: 'GET', path: '/api/pricing/own-lcl-consolidations', headers: acceptJson },
  get: { method: 'GET', path: '/api/pricing/own-lcl-consolidations/{{id}}', headers: acceptJson },
  create: { method: 'POST', path: '/api/pricing/own-lcl-consolidations', headers: jsonHeaders },
  update: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}', headers: jsonHeaders },
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
  oceanFreight: number
  maximumCbm: number
  carrierDestinationCostTotal: number
  panamaToCostaRicaCost: number
  bunkerCost: number
  costaRicaTransferBaseCbm: number
  matrixVersion: string
  status: string
  isActive: boolean
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
  costaRicaTransferCostPerCbm: number
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

export interface CreateOwnLclConsolidationRequest {
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
  carrierDestinationCostTotal: number
  panamaToCostaRicaCost: number
  bunkerCost: number
  costaRicaTransferBaseCbm: number
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

type CreatedOwnLcl = { id: string; consolidationNumber: number; name: string; matrixVersion: string }

export const OwnLclConsolidationService = {
  async browse(): Promise<OwnLclConsolidationDto[]> {
    const response = await callEndpoint<unknown>(endpoints.browse)
    return unwrapListResponse<OwnLclConsolidationDto>(response)
  },
  async get(id: string): Promise<OwnLclConsolidationDto> {
    const response = await callEndpoint<unknown>(endpoints.get, { params: { id } })
    return unwrapApiResponse<OwnLclConsolidationDto>(response as never)
  },
  async create(payload: CreateOwnLclConsolidationRequest): Promise<CreatedOwnLcl> {
    const response = await callEndpoint<unknown, CreateOwnLclConsolidationRequest>(endpoints.create, { body: payload })
    return unwrapApiResponse<CreatedOwnLcl>(response as never)
  },
  update(id: string, payload: CreateOwnLclConsolidationRequest) {
    return callEndpoint<Record<string, never>, CreateOwnLclConsolidationRequest>(endpoints.update, { params: { id }, body: payload })
  },
  async calculate(id: string, payload: CalculateOwnLclQuoteRequest): Promise<OwnLclQuoteCalculationDto> {
    const response = await callEndpoint<unknown, CalculateOwnLclQuoteRequest>(endpoints.calculate, { params: { id }, body: payload })
    return unwrapApiResponse<OwnLclQuoteCalculationDto>(response as never)
  },
}
