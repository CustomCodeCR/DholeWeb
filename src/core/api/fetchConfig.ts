import type { RequestOptions } from '@/core/api/interfaces/requestOptions'
import {
  ApiError,
  MissingParameterError,
  NetworkError,
  handleApiResponse,
  safeJsonParse,
} from '@/core/api/apiErrorHandler'

const BASE_URL = import.meta.env.VITE_API_URL as string

const STORAGE_KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
  sessionId: 'auth.sessionId',
  accessTokenExpiresAt: 'auth.accessTokenExpiresAt',
  refreshTokenExpiresAt: 'auth.refreshTokenExpiresAt',
  userId: 'auth.userId',
  sessionUserId: 'auth.sessionUserId',
  userType: 'auth.userType',
  username: 'auth.username',
  email: 'auth.email',
  clientId: 'auth.clientId',
  clientCode: 'auth.clientCode',
  clientName: 'auth.clientName',
  roles: 'auth.roles',
  scopes: 'auth.scopes',
} as const

interface StoredRefreshResponse {
  accessToken: string
  refreshToken: string
  sessionId: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
  clientId?: string | null
  clientCode?: string | null
  clientName?: string | null
}

export function replaceEndpointParams(endpoint: string, params: Record<string, string>): string {
  return endpoint.replace(/{{(\w+)}}/g, (_fullMatch, paramName: string) => {
    const value = params[paramName]
    if (value !== undefined) {
      return value
    }

    throw new MissingParameterError(paramName)
  })
}

function isJsonContentType(contentType: string): boolean {
  const value = contentType.toLowerCase()
  return value.includes('application/json') || value.includes('+json')
}

function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken)
}

function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    if (!payload) return null

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')

    return JSON.parse(atob(normalized)) as Record<string, unknown>
  } catch {
    return null
  }
}

function getJwtExpiration(token: string): number | null {
  const payload = parseJwtPayload(token)
  const exp = payload?.exp
  return typeof exp === 'number' ? exp * 1000 : null
}

function isTokenExpiredOrClose(token: string | null): boolean {
  if (!token) return true

  const expiration = getJwtExpiration(token)
  if (!expiration) return false

  return Date.now() >= expiration - 30_000
}

function isRefreshExpired(): boolean {
  const raw = localStorage.getItem(STORAGE_KEYS.refreshTokenExpiresAt)
  if (!raw) return !getRefreshToken()

  const expiresAt = new Date(raw).getTime()
  return Number.isNaN(expiresAt) ? false : Date.now() >= expiresAt
}

function isAuthEndpoint(endpoint: string): boolean {
  return endpoint === '/api/auth/login' || endpoint === '/api/auth/refresh'
}

function clearStoredSession() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent('dhole:auth:expired'))
}


function unwrapRefreshResponse(
  data: StoredRefreshResponse | { data?: StoredRefreshResponse },
): StoredRefreshResponse | null {
  if ('accessToken' in data && 'refreshToken' in data && 'sessionId' in data) {
    return data
  }

  return 'data' in data ? (data.data ?? null) : null
}

function persistRefreshResponse(data: StoredRefreshResponse) {
  localStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken)
  localStorage.setItem(STORAGE_KEYS.sessionId, data.sessionId)
  localStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, data.accessTokenExpiresAt)
  localStorage.setItem(STORAGE_KEYS.refreshTokenExpiresAt, data.refreshTokenExpiresAt)

  if (data.clientId) localStorage.setItem(STORAGE_KEYS.clientId, data.clientId)
  if (data.clientCode) localStorage.setItem(STORAGE_KEYS.clientCode, data.clientCode)
  if (data.clientName) localStorage.setItem(STORAGE_KEYS.clientName, data.clientName)

  window.dispatchEvent(new CustomEvent<StoredRefreshResponse>('dhole:auth:refreshed', { detail: data }))
}

async function refreshStoredSession(): Promise<boolean> {
  const refreshToken = getRefreshToken()

  if (!refreshToken || isRefreshExpired()) {
    clearStoredSession()
    emitSessionExpired()
    return false
  }

  try {
    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      clearStoredSession()
      emitSessionExpired()
      return false
    }

    const data = (await response.json()) as StoredRefreshResponse | { data?: StoredRefreshResponse }
    const session = unwrapRefreshResponse(data)

    if (!session?.accessToken || !session.refreshToken || !session.sessionId) {
      clearStoredSession()
      emitSessionExpired()
      return false
    }

    persistRefreshResponse(session)
    return true
  } catch {
    clearStoredSession()
    emitSessionExpired()
    return false
  }
}

async function getUsableAccessToken(endpoint: string): Promise<string | null> {
  const token = getAccessToken()

  if (isAuthEndpoint(endpoint)) return token
  if (!isTokenExpiredOrClose(token)) return token

  const refreshed = await refreshStoredSession()
  return refreshed ? getAccessToken() : null
}

function buildRequestConfig(options: RequestOptions, token: string | null): RequestInit {
  const headers: HeadersInit = {
    ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  return {
    method: options.method,
    headers,
    body:
      options.body === undefined
        ? undefined
        : options.isFormData
          ? (options.body as BodyInit)
          : JSON.stringify(options.body),
  }
}

export async function fetchClient<T>(endpoint: string, options: RequestOptions): Promise<T> {
  let token = await getUsableAccessToken(endpoint)
  let config = buildRequestConfig(options, token)

  try {
    let response = await fetch(`${BASE_URL}${endpoint}`, config)

    if (response.status === 401 && !isAuthEndpoint(endpoint)) {
      const refreshed = await refreshStoredSession()

      if (refreshed) {
        token = getAccessToken()
        config = buildRequestConfig(options, token)
        response = await fetch(`${BASE_URL}${endpoint}`, config)
      }
    }

    if (response.status === 401 && !isAuthEndpoint(endpoint)) {
      clearStoredSession()
      emitSessionExpired()
    }

    if (response.status === 204) return {} as T

    if (!response.ok) {
      await handleApiResponse(response, endpoint, options.method)
    }

    const contentType = response.headers.get('content-type') ?? ''

    if (isJsonContentType(contentType)) {
      const data = await safeJsonParse(response)
      return (data ?? {}) as T
    }

    const text = await response.text()
    return text as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new NetworkError(endpoint, options.method, error as Error)
  }
}
