export interface SessionDto {
  id: string
  userId: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  isRevoked: boolean
  revokedAt: string | null
  revocationReason: string | null
}

export interface RevokeSessionRequest {
  revokedBy?: string | null
  reason?: string | null
}

export interface BrowseUserSessionsQuery {
  pageNumber?: number
  pageSize?: number
}
