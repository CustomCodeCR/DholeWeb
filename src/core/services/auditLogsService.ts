import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  AuditEventDto,
  AuditEventListItemDto,
  AuditEventSummaryDto,
  AuditEventSummaryQuery,
  BrowseAuditEventsQuery,
  EntityHistoryQuery,
} from '@/core/interfaces/auditLogs'

export const AuditLogsService = {
  async browse(query?: BrowseAuditEventsQuery): Promise<AuditEventListItemDto[]> {
    const response = await this.browsePaged(query)
    return response.items
  },

  async browsePaged(query?: BrowseAuditEventsQuery): Promise<PagedResponse<AuditEventListItemDto>> {
    const endpointWithQuery =
      Endpoints.browseAuditEvents.path +
      (query ? toQueryString(query as Record<string, unknown>) : '')

    const response = await callEndpoint<unknown>({
      ...Endpoints.browseAuditEvents,
      path: endpointWithQuery,
    })

    return unwrapPagedResponse<AuditEventListItemDto>(response)
  },

  async getById(auditEventId: string): Promise<AuditEventDto> {
    const response = await callEndpoint<AuditEventDto>(Endpoints.getAuditEventById, {
      params: { auditEventId },
    })

    return unwrapApiResponse(response)
  },

  async getSummary(query?: AuditEventSummaryQuery): Promise<AuditEventSummaryDto> {
    const endpointWithQuery =
      Endpoints.getAuditEventSummary.path +
      (query ? toQueryString(query as Record<string, unknown>) : '')

    const response = await callEndpoint<AuditEventSummaryDto>({
      ...Endpoints.getAuditEventSummary,
      path: endpointWithQuery,
    })

    return unwrapApiResponse(response)
  },

  async getEntityHistory(query: EntityHistoryQuery): Promise<AuditEventListItemDto[]> {
    const endpointWithQuery =
      Endpoints.getEntityHistory.path + toQueryString(query as unknown as Record<string, unknown>)

    const response = await callEndpoint<unknown>({
      ...Endpoints.getEntityHistory,
      path: endpointWithQuery,
    })

    return unwrapListResponse<AuditEventListItemDto>(response)
  },

  async getUserHistory(userId: string): Promise<AuditEventListItemDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getUserHistory, {
      params: { userId },
    })

    return unwrapListResponse<AuditEventListItemDto>(response)
  },

  async getCorrelationHistory(correlationId: string): Promise<AuditEventListItemDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getCorrelationHistory, {
      params: { correlationId },
    })

    return unwrapListResponse<AuditEventListItemDto>(response)
  },
}
