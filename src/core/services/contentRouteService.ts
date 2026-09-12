import { fetchClient } from '@/core/api/fetchConfig'
import { unwrapApiResponse, unwrapListResponse } from '@/core/api/apiResponse'
import type {
  ContentRouteDto,
  CreateContentRouteRequest,
  UpdateContentRouteRequest,
} from '@/core/interfaces/contentRoutes'

type EmptyResponse = Record<string, never>

export const ContentRouteService = {
  async getByContent(contentId: string): Promise<ContentRouteDto[]> {
    return unwrapListResponse<ContentRouteDto>(
      await fetchClient<unknown>(`/api/content/routes/content/${contentId}`, { method: 'GET' }),
    )
  },

  async create(payload: CreateContentRouteRequest): Promise<string> {
    return unwrapApiResponse<string>(
      await fetchClient<unknown>('/api/content/routes/', { method: 'POST', body: payload }) as any,
    )
  },

  update(id: string, payload: UpdateContentRouteRequest) {
    return fetchClient<EmptyResponse>(`/api/content/routes/${id}`, { method: 'PUT', body: payload })
  },
}
