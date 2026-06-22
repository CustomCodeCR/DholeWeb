import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type { BrowseUserSessionsQuery, RevokeSessionRequest, SessionDto } from '@/core/interfaces/sessions'

type NoContent = Record<string, never>

export const SessionsService = {
  async getByUser(userId: string, query?: BrowseUserSessionsQuery): Promise<SessionDto[]> {
    const response = await this.getByUserPaged(userId, query)
    return response.items
  },

  async getByUserPaged(userId: string, query?: BrowseUserSessionsQuery): Promise<PagedResponse<SessionDto>> {
    const endpointWithQuery = Endpoints.getUserSessions.path + (query ? toQueryString(query as Record<string, unknown>) : '')
    const response = await callEndpoint<unknown>({ ...Endpoints.getUserSessions, path: endpointWithQuery }, { params: { userId } })
    return unwrapPagedResponse<SessionDto>(response)
  },

  async getActiveByUser(userId: string): Promise<SessionDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getActiveUserSessions, { params: { userId } })
    return unwrapListResponse<SessionDto>(response)
  },

  revoke(sessionId: string, payload: RevokeSessionRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RevokeSessionRequest>(Endpoints.revokeSession, { params: { sessionId }, body: payload })
  },

  revokeByUser(userId: string, payload: RevokeSessionRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RevokeSessionRequest>(Endpoints.revokeUserSessions, { params: { userId }, body: payload })
  },
}
