export interface AuditEventDto {
  id: string
  eventId: string
  correlationId: string
  sourceService: string
  entityType: string | null
  entityId: string | null
  action: string
  eventType: string | null
  userId: string | null
  userName: string | null
  ipAddress: string | null
  userAgent: string | null
  occurredAt: string
  createdAt: string
  beforeJson: string | null
  afterJson: string | null
  payloadJson: string | null
  metadata: string | null
  errorMessage: string | null
  stackTrace: string | null
  details: string | null
}

export interface AuditEventListItemDto {
  id: string
  eventId: string
  correlationId: string
  sourceService: string
  entityType: string | null
  entityId: string | null
  action: string
  eventType: string | null
  userId: string | null
  userName: string | null
  ipAddress: string | null
  occurredAt: string
  createdAt: string
  hasBeforeJson: boolean
  hasAfterJson: boolean
  hasPayloadJson: boolean
  hasMetadata: boolean
  hasError: boolean
  hasDetails: boolean
}

export interface AuditEventDetailDto {
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  metadata: string | null
}

export interface AuditEventSourceServiceDto {
  sourceService: string
  total: number
}

export interface AuditEventActionDto {
  action: string
  total: number
}

export interface AuditEventSummaryDto {
  totalEvents: number
  totalErrors: number
  totalAccessDenied: number
  totalUsers: number
  totalEntities: number
  sourceServices: AuditEventSourceServiceDto[]
  actions: AuditEventActionDto[]
}

export interface BrowseAuditEventsQuery {
  pageNumber?: number
  pageSize?: number
  sourceService?: string | null
  entityType?: string | null
  entityId?: string | null
  userId?: string | null
  correlationId?: string | null
  action?: string | null
  eventType?: string | null
  fromUtc?: string | null
  toUtc?: string | null
}

export interface AuditEventSummaryQuery {
  sourceService?: string | null
  entityType?: string | null
  entityId?: string | null
  userId?: string | null
  correlationId?: string | null
  action?: string | null
  eventType?: string | null
  fromUtc?: string | null
  toUtc?: string | null
}

export interface EntityHistoryQuery {
  entityType: string
  entityId: string
}
