import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'

export type LandShipmentMode = 'Ftl' | 'Ltl'
export type LandRateBasis = 'PerTruck' | 'PerCbm'
export type LandCommercialProfile = 'General' | 'FinalClient' | 'Nvocc'

export interface FtlTariffDto {
  id: string
  originId: string | null
  originName: string
  originCode: string | null
  destinationId: string | null
  destinationName: string
  destinationCode: string | null
  equipmentClass: string
  equipmentLabel: string
  currencyId: string
  currencyName: string
  currencyCode: string
  priceAmount: number
  transitDays: number | null
  source: string | null
  notes: string | null
  isActive: boolean
  shipmentMode: LandShipmentMode
  rateBasis: LandRateBasis
  minimumAmount: number | null
  warehouseName: string | null
  validFrom: string | null
  validTo: string | null
  commercialProfile: LandCommercialProfile
  applicableEquipmentClasses: string[]
}

export interface ResolveFtlTariffQuery {
  originId?: string | null
  destinationId?: string | null
  originName?: string | null
  destinationName?: string | null
  originCode?: string | null
  destinationCode?: string | null
  equipmentClass?: string | null
  shipmentMode?: LandShipmentMode | null
  commercialProfile?: LandCommercialProfile | null
  quoteDate?: string | null
}

export interface CreateLandTariffItem {
  originId?: string | null
  originName: string
  originCode?: string | null
  destinationId?: string | null
  destinationName: string
  destinationCode?: string | null
  shipmentMode: LandShipmentMode
  commercialProfile?: LandCommercialProfile | null
  equipmentClass: string
  equipmentLabel: string
  currencyId: string
  currencyName: string
  currencyCode: string
  priceAmount: number
  rateBasis?: LandRateBasis | null
  minimumAmount?: number | null
  transitDays?: number | null
  warehouseName?: string | null
  source?: string | null
  notes?: string | null
  validFrom?: string | null
  validTo?: string | null
  isActive?: boolean
  applicableEquipmentClasses?: string[] | null
}

export interface UpdateFtlTariffItem {
  id: string
  priceAmount: number
  minimumAmount: number | null
  transitDays: number | null
  warehouseName: string | null
  source: string | null
  notes: string | null
  validFrom: string | null
  validTo: string | null
  isActive: boolean
}

export interface ImportLandTariffResult {
  created: number
  updated: number
  total: number
}

export interface SeedLandTariffDefaultsResult {
  total: number
  ftl: number
  ltl: number
  ltlFinalClient: number
  ltlNvocc: number
  message: string
}

const acceptJson = { Accept: 'application/json' }
const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }

function withQuery(path: string, query: Record<string, string | null | undefined>) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && String(value).trim()) params.set(key, String(value))
  })
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

export const FtlTariffService = {
  async browse(shipmentMode?: LandShipmentMode | null, commercialProfile?: LandCommercialProfile | null): Promise<FtlTariffDto[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: withQuery('/api/pricing/ftl-tariffs', { shipmentMode, commercialProfile }),
      headers: acceptJson,
    })
    return unwrapListResponse<FtlTariffDto>(response)
  },

  async resolve(query: ResolveFtlTariffQuery): Promise<FtlTariffDto | null> {
    const response = await callEndpoint<FtlTariffDto | null>({
      method: 'GET',
      path: withQuery('/api/pricing/ftl-tariffs/resolve', {
        originId: query.originId,
        destinationId: query.destinationId,
        originName: query.originName,
        destinationName: query.destinationName,
        originCode: query.originCode,
        destinationCode: query.destinationCode,
        equipmentClass: query.equipmentClass,
        shipmentMode: query.shipmentMode,
        commercialProfile: query.commercialProfile,
        quoteDate: query.quoteDate,
      }),
      headers: acceptJson,
    })
    return unwrapApiResponse<FtlTariffDto | null>(response)
  },

  async create(item: CreateLandTariffItem): Promise<{ id: string; created: boolean; message: string }> {
    const response = await callEndpoint<{ id: string; created: boolean; message: string }, CreateLandTariffItem>(
      {
        method: 'POST',
        path: '/api/pricing/ftl-tariffs',
        headers: jsonHeaders,
      },
      { body: item },
    )
    return unwrapApiResponse<{ id: string; created: boolean; message: string }>(response)
  },

  async update(id: string, item: CreateLandTariffItem): Promise<void> {
    await callEndpoint<void, CreateLandTariffItem>(
      {
        method: 'PUT',
        path: '/api/pricing/ftl-tariffs/' + id,
        headers: jsonHeaders,
      },
      { body: item },
    )
  },

  async importBatch(items: CreateLandTariffItem[]): Promise<ImportLandTariffResult> {
    const response = await callEndpoint<ImportLandTariffResult, { items: CreateLandTariffItem[] }>(
      {
        method: 'POST',
        path: '/api/pricing/ftl-tariffs/import',
        headers: jsonHeaders,
      },
      { body: { items } },
    )
    return unwrapApiResponse<ImportLandTariffResult>(response)
  },

  async seedDefaults(): Promise<SeedLandTariffDefaultsResult> {
    const response = await callEndpoint<SeedLandTariffDefaultsResult>({
      method: 'POST',
      path: '/api/pricing/ftl-tariffs/seed-defaults',
      headers: jsonHeaders,
    })
    return unwrapApiResponse<SeedLandTariffDefaultsResult>(response)
  },

  async updateBatch(items: UpdateFtlTariffItem[]): Promise<void> {
    await callEndpoint<void, { items: UpdateFtlTariffItem[] }>(
      {
        method: 'PUT',
        path: '/api/pricing/ftl-tariffs/batch',
        headers: jsonHeaders,
      },
      { body: { items } },
    )
  },
}
