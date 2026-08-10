export type NotificationChannel = 'System' | 'Email' | 'WhatsAppFuture' | 'SmsFuture' | 'WebhookFuture'
export type NotificationStatus = 'Pending' | 'Scheduled' | 'Processing' | 'Sent' | 'Failed' | 'Retrying' | 'Cancelled' | 'DeadLetter'

export interface NotificationTemplateDto {
  id: string
  code: string
  name: string
  description: string | null
  notificationType: string
  channel: NotificationChannel
  subjectTemplate: string | null
  bodyTemplate: string
  designerJson: string
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc: string | null
}

export interface NotificationRecipientDto { id: string; userId: string | null; address: string; displayName: string | null }
export interface NotificationDeliveryAttemptDto {
  id: string; notificationRecipientId: string; attemptNumber: number; succeeded: boolean
  provider: string | null; providerMessageId: string | null; errorCode: string | null; errorMessage: string | null
  startedAtUtc: string; completedAtUtc: string
}
export interface NotificationMessageDto {
  id: string; notificationType: string; templateCode: string | null; channel: NotificationChannel
  entityType: string | null; entityId: string | null; subject: string | null; body: string | null
  status: NotificationStatus; scheduledForUtc: string | null; nextAttemptAtUtc: string | null; sentAtUtc: string | null
  attemptCount: number; maxAttempts: number; lastErrorCode: string | null; lastErrorMessage: string | null
  createdAtUtc: string; updatedAtUtc: string | null; recipients: NotificationRecipientDto[]; deliveryAttempts: NotificationDeliveryAttemptDto[]
}
export interface CreateNotificationTemplateRequest {
  code: string; name: string; description?: string | null; notificationType: string; channel: NotificationChannel
  subjectTemplate?: string | null; bodyTemplate: string; designerJson: string
}
export type UpdateNotificationTemplateRequest = Omit<CreateNotificationTemplateRequest, 'code'>
export interface CreateNotificationMessageRequest {
  notificationType: string; templateCode?: string | null; channel: NotificationChannel; entityType?: string | null; entityId?: string | null
  subject?: string | null; body?: string | null; payloadJson?: string | null; scheduledForUtc?: string | null; maxAttempts: number
  recipients: Array<{ userId?: string | null; address: string; displayName?: string | null }>
}
export interface BrowseNotificationsQuery { pageNumber?: number; pageSize?: number; search?: string; status?: string; channel?: string }
export interface BrowseNotificationTemplatesQuery { pageNumber?: number; pageSize?: number; search?: string; isActive?: boolean | null }
