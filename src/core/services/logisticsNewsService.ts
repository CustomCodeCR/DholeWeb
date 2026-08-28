import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import type { Endpoint } from '@/core/composables/endpoints'

export interface LogisticsNewsDto {
  id: string
  title: string
  content: string
  sourceCountry?: string | null
  sourceOffice?: string | null
  receivedAtUtc: string
  status: 'PendingAnalysis' | 'Applied' | 'NoMatches' | 'Failed' | 'Inactive' | string
  isActive: boolean
  aiSummary?: string | null
  eventType?: string | null
  severity?: string | null
  aiConfidence?: number | null
  matchedRateCount: number
  appliedRateCount: number
  lastProcessedAtUtc?: string | null
  processingError?: string | null
}

export interface LogisticsNewsImpactDto {
  id: string
  importFclRateId: string
  carrier: string
  pol: string
  poe: string
  pod: string
  containerType: string
  validFrom?: string | null
  validTo?: string | null
  matchReason: string
  confidence: number
  appliedComment: string
  appliedAtUtc: string
}

export interface CreateLogisticsNewsRequest {
  content: string
  title?: string | null
  sourceCountry?: string | null
  sourceOffice?: string | null
  receivedAtUtc?: string | null
}

const endpoints = {
  list: {
    method: 'GET',
    path: '/api/pricing/logistics-news',
    headers: { Accept: 'application/json' },
  },
  create: {
    method: 'POST',
    path: '/api/pricing/logistics-news',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  },
  impacts: {
    method: 'GET',
    path: '/api/pricing/logistics-news/{{newsId}}/impacts',
    headers: { Accept: 'application/json' },
  },
  reprocess: {
    method: 'POST',
    path: '/api/pricing/logistics-news/{{newsId}}/reprocess',
    headers: { Accept: 'application/json' },
  },
  setActive: {
    method: 'PUT',
    path: '/api/pricing/logistics-news/{{newsId}}/active',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  },
} satisfies Record<string, Endpoint>

export const LogisticsNewsService = {
  async list(): Promise<LogisticsNewsDto[]> {
    const response = await callEndpoint<unknown>(endpoints.list)
    return unwrapListResponse<LogisticsNewsDto>(response)
  },

  async create(request: CreateLogisticsNewsRequest): Promise<LogisticsNewsDto> {
    const response = await callEndpoint<unknown, CreateLogisticsNewsRequest>(endpoints.create, {
      body: request,
    })
    return unwrapApiResponse<LogisticsNewsDto>(response)
  },

  async impacts(newsId: string): Promise<LogisticsNewsImpactDto[]> {
    const response = await callEndpoint<unknown>(endpoints.impacts, {
      params: { newsId },
    })
    return unwrapListResponse<LogisticsNewsImpactDto>(response)
  },

  async reprocess(newsId: string): Promise<LogisticsNewsDto> {
    const response = await callEndpoint<unknown>(endpoints.reprocess, {
      params: { newsId },
    })
    return unwrapApiResponse<LogisticsNewsDto>(response)
  },

  async setActive(newsId: string, isActive: boolean): Promise<LogisticsNewsDto> {
    const response = await callEndpoint<unknown, { isActive: boolean }>(endpoints.setActive, {
      params: { newsId },
      body: { isActive },
    })
    return unwrapApiResponse<LogisticsNewsDto>(response)
  },
}
