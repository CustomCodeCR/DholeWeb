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
  fobScenarios: { method: 'GET', path: '/api/pricing/own-lcl-consolidations/{{id}}/fob-scenarios', headers: acceptJson },
  saveFobScenarios: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}/fob-scenarios', headers: jsonHeaders },
  saveCostOverrides: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}/cost-overrides', headers: jsonHeaders },
  pricingLines: { method: 'GET', path: '/api/pricing/own-lcl-consolidations/{{id}}/pricing-lines', headers: acceptJson },
  savePricingLines: { method: 'PUT', path: '/api/pricing/own-lcl-consolidations/{{id}}/pricing-lines', headers: jsonHeaders },
  calculate: { method: 'POST', path: '/api/pricing/own-lcl-route-matrix/{{id}}/calculate', headers: jsonHeaders },
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

export interface OwnLclFobScenarioPortDto {
  polCode: string
  costPerCbm: number
  salePerCbm: number
  recommendedSalePerCbm: number
  originSurchargePerCbm: number
}

export interface OwnLclFobScenarioCountryDto {
  destinationCode: string
  destinationName: string
  ports: OwnLclFobScenarioPortDto[]
}

export interface OwnLclFobScenarioMatrixDto {
  consolidationId: string
  consolidationNumber: number
  matrixVersion: string
  validTo: string | null
  oceanFreight: number
  maximumCbm: number
  carrierDestinationCostTotal: number
  panamaToCostaRicaCost: number
  bunkerCost: number
  costaRicaTransferBaseCbm: number
  countries: OwnLclFobScenarioCountryDto[]
}

export interface OwnLclPricingLineDto {
  lineKey: string
  scope: 'PA' | 'CR' | 'CA' | 'ORIGIN' | string
  name: string
  chargeBasis: string
  costUnit: number
  saleUnit: number
}

export interface SaveOwnLclPricingLinesRequest {
  rows: Array<{
    lineKey: string
    costUnit: number
    saleUnit: number
  }>
}

export function createDefaultOwnLclPricingLines(): OwnLclPricingLineDto[] {
  return [
    { lineKey: 'PA_DESTINATION_CHARGE', scope: 'PA', name: 'Destination Charge', chargeBasis: 'CBM', costUnit: 0, saleUnit: 20 },
    { lineKey: 'PA_DMCE', scope: 'PA', name: 'DMCE', chargeBasis: 'HBL', costUnit: 65, saleUnit: 65 },
    { lineKey: 'PA_HANDLING', scope: 'PA', name: 'Handling', chargeBasis: 'HBL', costUnit: 25, saleUnit: 25 },
    { lineKey: 'PA_ZONE', scope: 'PA', name: 'Zone Charge', chargeBasis: 'HBL', costUnit: 30, saleUnit: 30 },
    { lineKey: 'CR_HANDLING', scope: 'CR', name: 'Manejos', chargeBasis: 'HBL', costUnit: 65, saleUnit: 65 },
    { lineKey: 'CR_ZONE', scope: 'CR', name: 'Zone Charge', chargeBasis: 'HBL', costUnit: 50, saleUnit: 50 },
    { lineKey: 'CA_DOCUMENTATION', scope: 'CA', name: 'Documentación', chargeBasis: 'HBL', costUnit: 0, saleUnit: 65 },
    { lineKey: 'CA_ZONE', scope: 'CA', name: 'Zone Charge', chargeBasis: 'HBL', costUnit: 0, saleUnit: 65 },
    { lineKey: 'CA_HANDLING', scope: 'CA', name: 'Manejos destino', chargeBasis: 'HBL', costUnit: 0, saleUnit: 50 },
    { lineKey: 'ORIGIN_CFS', scope: 'ORIGIN', name: 'CFS', chargeBasis: 'CBM', costUnit: 8, saleUnit: 8 },
    { lineKey: 'ORIGIN_WHSE', scope: 'ORIGIN', name: 'WHSE FEE', chargeBasis: 'CBM', costUnit: 12, saleUnit: 12 },
    { lineKey: 'ORIGIN_CUSTOMS', scope: 'ORIGIN', name: 'CUSTOMS', chargeBasis: 'SET', costUnit: 15, saleUnit: 25 },
    { lineKey: 'ORIGIN_DOC', scope: 'ORIGIN', name: 'DOC FEE', chargeBasis: 'HBL', costUnit: 15, saleUnit: 65 },
    { lineKey: 'ORIGIN_VGM', scope: 'ORIGIN', name: 'VGM', chargeBasis: 'HBL', costUnit: 0, saleUnit: 25 },
    { lineKey: 'ORIGIN_MANIFEST', scope: 'ORIGIN', name: 'MANIFEST', chargeBasis: 'HBL', costUnit: 15, saleUnit: 25 },
    { lineKey: 'ORIGIN_PICK_UP', scope: 'ORIGIN', name: 'PICK UP', chargeBasis: 'Flat', costUnit: 0, saleUnit: 0 },
  ]
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
  routeTransferCostPerCbm: number
  routeWarehouseCostPerCbm: number
  routeInlandCostPerCbm: number
  routeCostPerCbm: number
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

export interface SaveOwnLclCostOverridesRequest {
  oceanFreight: number
  maximumCbm: number
  carrierDestinationCostTotal: number
  panamaToCostaRicaCost: number
  bunkerCost: number
  costaRicaTransferBaseCbm: number
}

export interface SaveOwnLclFobScenariosRequest {
  rows: Array<{
    destinationCode: string
    polCode: string
    salePerCbm: number
  }>
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
  async getFobScenarios(id: string): Promise<OwnLclFobScenarioMatrixDto> {
    const response = await callEndpoint<unknown>(endpoints.fobScenarios, { params: { id } })
    return unwrapApiResponse<OwnLclFobScenarioMatrixDto>(response as never)
  },
  async saveFobScenarios(id: string, payload: SaveOwnLclFobScenariosRequest): Promise<void> {
    await callEndpoint<unknown, SaveOwnLclFobScenariosRequest>(endpoints.saveFobScenarios, { params: { id }, body: payload })
  },
  async saveCostOverrides(id: string, payload: SaveOwnLclCostOverridesRequest): Promise<void> {
    await callEndpoint<unknown, SaveOwnLclCostOverridesRequest>(endpoints.saveCostOverrides, { params: { id }, body: payload })
  },
  async getPricingLines(id: string): Promise<OwnLclPricingLineDto[]> {
    const response = await callEndpoint<unknown>(endpoints.pricingLines, { params: { id } })
    return unwrapListResponse<OwnLclPricingLineDto>(response)
  },
  async savePricingLines(id: string, payload: SaveOwnLclPricingLinesRequest): Promise<void> {
    await callEndpoint<unknown, SaveOwnLclPricingLinesRequest>(endpoints.savePricingLines, { params: { id }, body: payload })
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
