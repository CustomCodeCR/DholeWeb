import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapPagedResponse, type PagedResponse } from '@/core/api/apiResponse'
import type {
  BrowseNotificationInboxQuery, BrowseNotificationsQuery, BrowseNotificationTemplatesQuery, CreateNotificationMessageRequest,
  CreateNotificationTemplateRequest, NotificationInboxItemDto, NotificationMessageDto, NotificationTemplateDto,
  NotificationUnreadCountDto, UpdateNotificationTemplateRequest,
} from '@/core/interfaces/notifications'

type NoContent = Record<string, never>
const inboxHeaders = { Accept: 'application/json' }

export const NotificationsService = {
  async browseInbox(query: BrowseNotificationInboxQuery = {}): Promise<PagedResponse<NotificationInboxItemDto>> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/notifications/inbox' + toQueryString(query as Record<string, unknown>),
      headers: inboxHeaders,
    })
    return unwrapPagedResponse<NotificationInboxItemDto>(response)
  },
  async getUnreadInboxCount(): Promise<number> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/notifications/inbox/unread-count',
      headers: inboxHeaders,
    })
    return unwrapApiResponse<NotificationUnreadCountDto>(response as never).unreadCount ?? 0
  },
  markInboxRead(recipientId: string): Promise<NoContent> {
    return callEndpoint<NoContent>({
      method: 'POST',
      path: `/api/notifications/inbox/${encodeURIComponent(recipientId)}/read`,
      headers: inboxHeaders,
    })
  },
  markAllInboxRead(): Promise<{ markedRead: number }> {
    return callEndpoint<{ markedRead: number }>({
      method: 'POST',
      path: '/api/notifications/inbox/read-all',
      headers: inboxHeaders,
    })
  },
  async browseMessages(query: BrowseNotificationsQuery = {}): Promise<PagedResponse<NotificationMessageDto>> {
    const response = await callEndpoint<unknown>({ ...Endpoints.browseNotificationMessages, path: Endpoints.browseNotificationMessages.path + toQueryString(query as Record<string, unknown>) })
    return unwrapPagedResponse<NotificationMessageDto>(response)
  },
  async getMessage(id: string): Promise<NotificationMessageDto> {
    const response = await callEndpoint<unknown>(Endpoints.getNotificationMessage, { params: { notificationId: id } })
    return unwrapApiResponse<NotificationMessageDto>(response as never)
  },
  async createMessage(payload: CreateNotificationMessageRequest): Promise<NotificationMessageDto> {
    const response = await callEndpoint<unknown, CreateNotificationMessageRequest>(Endpoints.createNotificationMessage, { body: payload })
    return unwrapApiResponse<NotificationMessageDto>(response as never)
  },
  cancelMessage(id: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.cancelNotificationMessage, { params: { notificationId: id } })
  },
  async browseTemplates(query: BrowseNotificationTemplatesQuery = {}): Promise<PagedResponse<NotificationTemplateDto>> {
    const response = await callEndpoint<unknown>({ ...Endpoints.browseNotificationTemplates, path: Endpoints.browseNotificationTemplates.path + toQueryString(query as Record<string, unknown>) })
    return unwrapPagedResponse<NotificationTemplateDto>(response)
  },
  async getTemplate(id: string): Promise<NotificationTemplateDto> {
    const response = await callEndpoint<unknown>(Endpoints.getNotificationTemplate, { params: { templateId: id } })
    return unwrapApiResponse<NotificationTemplateDto>(response as never)
  },
  async createTemplate(payload: CreateNotificationTemplateRequest): Promise<NotificationTemplateDto> {
    const response = await callEndpoint<unknown, CreateNotificationTemplateRequest>(Endpoints.createNotificationTemplate, { body: payload })
    return unwrapApiResponse<NotificationTemplateDto>(response as never)
  },
  async updateTemplate(id: string, payload: UpdateNotificationTemplateRequest): Promise<NotificationTemplateDto> {
    const response = await callEndpoint<unknown, UpdateNotificationTemplateRequest>(Endpoints.updateNotificationTemplate, { params: { templateId: id }, body: payload })
    return unwrapApiResponse<NotificationTemplateDto>(response as never)
  },
  setTemplateActive(id: string, isActive: boolean): Promise<NoContent> {
    return callEndpoint<NoContent, { isActive: boolean }>(Endpoints.setNotificationTemplateActive, { params: { templateId: id }, body: { isActive } })
  },
  deleteTemplate(id: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteNotificationTemplate, { params: { templateId: id } })
  },
  async historyByEntity(entityType: string, entityId: string, pageNumber = 1, pageSize = 20): Promise<PagedResponse<NotificationMessageDto>> {
    const query = toQueryString({ entityType, entityId, pageNumber, pageSize })
    const response = await callEndpoint<unknown>({ ...Endpoints.notificationHistoryByEntity, path: Endpoints.notificationHistoryByEntity.path + query })
    return unwrapPagedResponse<NotificationMessageDto>(response)
  },
  async historyByRecipient(recipient: string, pageNumber = 1, pageSize = 20): Promise<PagedResponse<NotificationMessageDto>> {
    const query = toQueryString({ recipient, pageNumber, pageSize })
    const response = await callEndpoint<unknown>({ ...Endpoints.notificationHistoryByRecipient, path: Endpoints.notificationHistoryByRecipient.path + query })
    return unwrapPagedResponse<NotificationMessageDto>(response)
  },
}
