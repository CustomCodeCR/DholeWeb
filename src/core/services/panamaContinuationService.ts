import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import type { ImportRateSelectDto } from '@/core/interfaces/pricing'

export interface PanamaOceanContinuationQuery {
  panamaPol: string
  finalDestination: string
  containerType?: string | null
  quoteDate?: string | null
}

export interface PanamaLandContinuationQuery {
  panamaPol: string
  finalDestination: string
  containerType?: string | null
  panamaPolCode?: string | null
  finalDestinationCode?: string | null
}

export interface PanamaLandContinuationDto {
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
}

function withQuery(path: string, query: Record<string, string | null | undefined>) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim()
    if (normalized) params.set(key, normalized)
  })
  const suffix = params.toString()
  return suffix ? `${path}?${suffix}` : path
}

export const PanamaContinuationService = {
  async ocean(query: PanamaOceanContinuationQuery): Promise<ImportRateSelectDto[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: withQuery('/api/pricing/import-rates/panama-continuation', {
        panamaPol: query.panamaPol,
        finalDestination: query.finalDestination,
        containerType: query.containerType,
        quoteDate: query.quoteDate,
      }),
      headers: { Accept: 'application/json' },
    })

    return unwrapListResponse<ImportRateSelectDto>(response)
  },

  async land(query: PanamaLandContinuationQuery): Promise<PanamaLandContinuationDto | null> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: withQuery('/api/pricing/panama-continuation/land', {
        panamaPol: query.panamaPol,
        finalDestination: query.finalDestination,
        containerType: query.containerType,
        panamaPolCode: query.panamaPolCode,
        finalDestinationCode: query.finalDestinationCode,
      }),
      headers: { Accept: 'application/json' },
    })

    return unwrapApiResponse<PanamaLandContinuationDto | null>(response as never)
  },
}
