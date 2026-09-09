import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'

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
}

export interface ResolveFtlTariffQuery {
  originId?: string | null
  destinationId?: string | null
  originName?: string | null
  destinationName?: string | null
  equipmentClass: string
}

export interface UpdateFtlTariffItem {
  id: string
  priceAmount: number
  transitDays: number | null
  isActive: boolean
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
  async browse(): Promise<FtlTariffDto[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/ftl-tariffs',
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
        equipmentClass: query.equipmentClass,
      }),
      headers: acceptJson,
    })
    return unwrapApiResponse<FtlTariffDto | null>(response)
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
