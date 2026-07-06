export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  sessionId: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
  displayName?: string | null
  userName?: string | null
  email?: string | null
  clientId?: string | null
  clientCode?: string | null
  clientName?: string | null
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  sessionId: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
  displayName?: string | null
  userName?: string | null
  email?: string | null
  clientId?: string | null
  clientCode?: string | null
  clientName?: string | null
}
