import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import type { Endpoint } from '@/core/composables/endpoints'

const json = { Accept: 'application/json', 'Content-Type': 'application/json' }
const acceptJson = { Accept: 'application/json' }

const endpoints = {
  listRateSources: { method: 'GET', path: '/api/pricing/lcl/rate-sources', headers: acceptJson },
  createOwn: { method: 'POST', path: '/api/pricing/lcl/own-consolidations', headers: json },
  createColoader: { method: 'POST', path: '/api/pricing/lcl/coloader-rates', headers: json },
  approveColoader: { method: 'POST', path: '/api/pricing/lcl/coloader-rates/{{id}}/approve', headers: json },
  routeRules: { method: 'GET', path: '/api/pricing/lcl/route-rules', headers: acceptJson },
  calculateCargo: { method: 'POST', path: '/api/pricing/lcl/calculate-cargo', headers: json },
} satisfies Record<string, Endpoint>

export interface LclRateSource {
  id: string
  sourceType: 'Own' | 'Coloader'
  bookingNumber?: string | null
  etd?: string | null
  providerName?: string | null
  carrierId: string
  carrierName: string
  carrierCode: string
  polId: string
  polName: string
  polCode: string
  poeId: string
  poeName: string
  poeCode: string
  containerTypeId?: string | null
  containerTypeName?: string | null
  containerTypeCode?: string | null
  maxCbm?: number | null
  oceanFreightAmount?: number | null
  destinationCostTotal?: number | null
  baseRatePerCbm: number
  currencyId: string
  currencyName: string
  currencyCode: string
  approvalStatus: string
  validFrom?: string | null
  validTo?: string | null
  defaultLandFreightAmount: number
  defaultBunkerAmount: number
  truckCapacityCbm: number
  notes?: string | null
}

export interface LclRouteRules {
  kgPerCbm: number
  minimumChargeableCbm: number
  ownChinaBasePol: string
  ownChinaBasePoe: string
  costaRica: {
    landFreightAmount: number
    bunkerAmount: number
    truckCapacityCbm: number
    landAndBunkerPerCbm: number
  }
  destinations: Array<{ destination: string; rates: Record<string, number> }>
  destinationRules: Record<string, Record<string, number>>
  originRules: {
    fcaAndExw: {
      cfsPerCbm: number
      customsPerSet: number
      docFeePerHbl: number
      vgmPerHbl: number
      manifestPerHbl: number
    }
    pickupOnlyFor: string
  }
  source: string
}

export interface LclCargoLineInput {
  units: number
  pallets: number
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export interface LclCargoCalculation {
  lines: Array<{
    line: number
    dimensionalCbm: number
    weightCbm: number
    chargeableCbm: number
  }>
  dimensionalCbm: number
  weightCbm: number
  chargeableCbm: number
  freightChargeableCbm: number
  kgPerCbm: number
}

export interface CreateOwnLclPayload {
  bookingNumber: string
  etd: string
  carrierId: string
  carrierName: string
  carrierCode: string
  polId: string
  polName: string
  polCode: string
  poeId: string
  poeName: string
  poeCode: string
  containerTypeId?: string | null
  containerTypeName?: string | null
  containerTypeCode?: string | null
  maxCbm: number
  oceanFreightAmount: number
  currencyId: string
  currencyName: string
  currencyCode: string
  defaultLandFreightAmount?: number | null
  defaultBunkerAmount?: number | null
  truckCapacityCbm?: number | null
}

function appendQuery(path: string, query?: Record<string, string | boolean | undefined>) {
  if (!query) return path
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

export const LclService = {
  async listRateSources(query?: { sourceType?: 'Own' | 'Coloader'; approvedOnly?: boolean }) {
    const response = await callEndpoint<unknown>({
      ...endpoints.listRateSources,
      path: appendQuery(endpoints.listRateSources.path, query),
    })
    return unwrapListResponse<LclRateSource>(response)
  },

  async createOwn(payload: CreateOwnLclPayload) {
    const response = await callEndpoint<Record<string, unknown>, CreateOwnLclPayload>(
      endpoints.createOwn,
      { body: payload },
    )
    return unwrapApiResponse<Record<string, unknown>>(response)
  },

  async createColoader(payload: Record<string, unknown>) {
    const response = await callEndpoint<Record<string, unknown>, Record<string, unknown>>(
      endpoints.createColoader,
      { body: payload },
    )
    return unwrapApiResponse<Record<string, unknown>>(response)
  },

  approveColoader(id: string) {
    return callEndpoint(endpoints.approveColoader, { params: { id } })
  },

  async getRouteRules() {
    const response = await callEndpoint<LclRouteRules>(endpoints.routeRules)
    return unwrapApiResponse<LclRouteRules>(response)
  },

  async calculateCargo(lines: LclCargoLineInput[], kgPerCbm = 500) {
    const response = await callEndpoint<
      LclCargoCalculation,
      { kgPerCbm: number; lines: LclCargoLineInput[] }
    >(endpoints.calculateCargo, { body: { kgPerCbm, lines } })
    return unwrapApiResponse<LclCargoCalculation>(response)
  },
}
