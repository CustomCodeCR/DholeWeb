import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { AuthService } from '@/core/services/authService'

import type { LoginRequest, LoginResponse, RefreshTokenResponse } from '@/core/interfaces/auth'

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
  displayName: 'auth.displayName',
  email: 'auth.email',
  clientId: 'auth.clientId',
  clientCode: 'auth.clientCode',
  clientName: 'auth.clientName',
  roles: 'auth.roles',
  scopes: 'auth.scopes',
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    if (!payload) return null

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')

    const decoded = atob(normalized)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function readStringFromStorage(key: string): string | null {
  const value = localStorage.getItem(key)

  if (!value || value === 'undefined' || value === 'null') {
    return null
  }

  return value
}

function readArrayFromStorage(key: string): string[] {
  const value = localStorage.getItem(key)
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function readClaimString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return null
}

function splitClaimValue(value: string): string[] {
  return value
    .split(/[\s,;]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
}

function readClaimArray(payload: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = []

  for (const key of keys) {
    const value = payload[key]

    if (Array.isArray(value)) {
      values.push(...value.flatMap((x) => (typeof x === 'string' ? splitClaimValue(x) : [])))
      continue
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      values.push(...splitClaimValue(value))
    }
  }

  return [...new Set(values)]
}

function getJwtExpiration(token: string): number | null {
  const payload = parseJwtPayload(token)
  if (!payload) return null

  const exp = payload.exp
  if (typeof exp !== 'number') return null

  return exp * 1000
}

function getStoredDateTime(key: string): number | null {
  const value = readStringFromStorage(key)
  if (!value) return null

  const date = new Date(value).getTime()
  return Number.isNaN(date) ? null : date
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(readStringFromStorage(STORAGE_KEYS.accessToken))
  const refreshToken = ref<string | null>(readStringFromStorage(STORAGE_KEYS.refreshToken))
  const sessionId = ref<string | null>(readStringFromStorage(STORAGE_KEYS.sessionId))
  const accessTokenExpiresAt = ref<string | null>(
    readStringFromStorage(STORAGE_KEYS.accessTokenExpiresAt),
  )
  const refreshTokenExpiresAt = ref<string | null>(
    readStringFromStorage(STORAGE_KEYS.refreshTokenExpiresAt),
  )

  const userId = ref<string | null>(readStringFromStorage(STORAGE_KEYS.userId))
  const sessionUserId = ref<string | null>(readStringFromStorage(STORAGE_KEYS.sessionUserId))
  const userType = ref<string | null>(readStringFromStorage(STORAGE_KEYS.userType))
  const username = ref<string | null>(readStringFromStorage(STORAGE_KEYS.username))
  const displayName = ref<string | null>(readStringFromStorage(STORAGE_KEYS.displayName))
  const email = ref<string | null>(readStringFromStorage(STORAGE_KEYS.email))
  const clientId = ref<string | null>(readStringFromStorage(STORAGE_KEYS.clientId))
  const clientCode = ref<string | null>(readStringFromStorage(STORAGE_KEYS.clientCode))
  const clientName = ref<string | null>(readStringFromStorage(STORAGE_KEYS.clientName))

  const roles = ref<string[]>(readArrayFromStorage(STORAGE_KEYS.roles))
  const scopes = ref<string[]>(readArrayFromStorage(STORAGE_KEYS.scopes))

  const token = computed(() => accessToken.value)

  const isAuthenticated = computed(() => hasValidSession())
  const userDisplayName = computed(() => displayName.value || username.value || email.value)

  function persistString(key: string, value: string | null) {
    if (value) {
      localStorage.setItem(key, value)
      return
    }

    localStorage.removeItem(key)
  }

  function persistArray(key: string, value: string[]) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  function applyClaimsFromAccessToken(currentAccessToken: string | null) {
    if (!currentAccessToken) {
      userId.value = null
      sessionUserId.value = null
      userType.value = null
      username.value = null
      displayName.value = null
      email.value = null
      clientId.value = null
      clientCode.value = null
      clientName.value = null
      roles.value = []
      scopes.value = []
      return
    }

    const payload = parseJwtPayload(currentAccessToken)

    if (!payload) {
      return
    }

    userId.value = readClaimString(payload, [
      'sub',
      'nameid',
      'userId',
      'uid',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    ])

    const tokenSessionId = readClaimString(payload, ['session_id', 'sessionId', 'sid'])

    if (!sessionId.value && tokenSessionId) {
      sessionId.value = tokenSessionId
    }

    sessionUserId.value = tokenSessionId

    userType.value = readClaimString(payload, ['userType', 'typ'])

    username.value = readClaimString(payload, [
      'userName',
      'username',
      'unique_name',
      'preferred_username',
    ])

    displayName.value = readClaimString(payload, [
      'displayName',
      'display_name',
      'fullName',
      'full_name',
      'name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    ])

    email.value = readClaimString(payload, [
      'email',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ])

    clientId.value = readClaimString(payload, [
      'clientId',
      'client_id',
      'tenantId',
      'tenant_id',
      'customerId',
      'customer_id',
    ])

    clientCode.value = readClaimString(payload, [
      'clientCode',
      'client_code',
      'tenantCode',
      'tenant_code',
      'customerCode',
      'customer_code',
    ])

    clientName.value = readClaimString(payload, [
      'clientName',
      'client_name',
      'tenantName',
      'tenant_name',
      'customerName',
      'customer_name',
    ])

    roles.value = readClaimArray(payload, [
      'roles',
      'role',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    ])

    scopes.value = readClaimArray(payload, ['scopes', 'scope'])
  }

  function persistSession() {
    persistString(STORAGE_KEYS.accessToken, accessToken.value)
    persistString(STORAGE_KEYS.refreshToken, refreshToken.value)
    persistString(STORAGE_KEYS.sessionId, sessionId.value)
    persistString(STORAGE_KEYS.accessTokenExpiresAt, accessTokenExpiresAt.value)
    persistString(STORAGE_KEYS.refreshTokenExpiresAt, refreshTokenExpiresAt.value)

    persistString(STORAGE_KEYS.userId, userId.value)
    persistString(STORAGE_KEYS.sessionUserId, sessionUserId.value)
    persistString(STORAGE_KEYS.userType, userType.value)
    persistString(STORAGE_KEYS.username, username.value)
    persistString(STORAGE_KEYS.displayName, displayName.value)
    persistString(STORAGE_KEYS.email, email.value)
    persistString(STORAGE_KEYS.clientId, clientId.value)
    persistString(STORAGE_KEYS.clientCode, clientCode.value)
    persistString(STORAGE_KEYS.clientName, clientName.value)

    persistArray(STORAGE_KEYS.roles, roles.value)
    persistArray(STORAGE_KEYS.scopes, scopes.value)
  }

  function setSession(data: LoginResponse | RefreshTokenResponse) {
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    sessionId.value = data.sessionId
    accessTokenExpiresAt.value = data.accessTokenExpiresAt
    refreshTokenExpiresAt.value = data.refreshTokenExpiresAt

    applyClaimsFromAccessToken(data.accessToken)

    username.value = data.userName ?? username.value
    displayName.value = data.displayName ?? displayName.value
    email.value = data.email ?? email.value
    clientId.value = data.clientId ?? clientId.value
    clientCode.value = data.clientCode ?? clientCode.value
    clientName.value = data.clientName ?? clientName.value

    persistSession()
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    sessionId.value = null
    accessTokenExpiresAt.value = null
    refreshTokenExpiresAt.value = null

    userId.value = null
    sessionUserId.value = null
    userType.value = null
    username.value = null
    displayName.value = null
    email.value = null
    clientId.value = null
    clientCode.value = null
    clientName.value = null
    roles.value = []
    scopes.value = []

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
  }

  function isAccessTokenExpired(currentToken?: string | null): boolean {
    if (!currentToken) return true

    const jwtExpiresAt = getJwtExpiration(currentToken)

    if (jwtExpiresAt) {
      return Date.now() >= jwtExpiresAt
    }

    const storedExpiresAt = getStoredDateTime(STORAGE_KEYS.accessTokenExpiresAt)

    if (storedExpiresAt) {
      return Date.now() >= storedExpiresAt
    }

    return false
  }

  function isRefreshTokenExpired(): boolean {
    const storedExpiresAt = getStoredDateTime(STORAGE_KEYS.refreshTokenExpiresAt)

    if (!storedExpiresAt) {
      return !refreshToken.value
    }

    return Date.now() >= storedExpiresAt
  }

  function hasValidSession(): boolean {
    if (!accessToken.value || !refreshToken.value || !sessionId.value) return false

    if (isAccessTokenExpired(accessToken.value)) {
      return !isRefreshTokenExpired()
    }

    return true
  }

  async function refreshSession(): Promise<boolean> {
    if (!refreshToken.value || isRefreshTokenExpired()) {
      clearSession()
      return false
    }

    try {
      const response = await AuthService.refreshToken({
        refreshToken: refreshToken.value,
      })

      setSession(response)

      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function ensureValidAccessToken(): Promise<string | null> {
    if (!accessToken.value) {
      return null
    }

    if (!isAccessTokenExpired(accessToken.value)) {
      return accessToken.value
    }

    const refreshed = await refreshSession()

    return refreshed ? accessToken.value : null
  }

  async function login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await AuthService.login(payload)

    if (!response?.accessToken || !response?.refreshToken) {
      throw new Error('Authentication tokens were not returned by the server')
    }

    setSession(response)

    return response
  }

  function logout() {
    clearSession()
  }

  async function initialize() {
    if (!accessToken.value) {
      return
    }

    applyClaimsFromAccessToken(accessToken.value)

    if (isAccessTokenExpired(accessToken.value)) {
      await refreshSession()
      return
    }

    persistSession()
  }

  function hasRole(role: string): boolean {
    return roles.value.some((x) => x.toLowerCase() === role.toLowerCase())
  }

  function hasScope(scope: string): boolean {
    return scopes.value.some((x) => x.toLowerCase() === scope.toLowerCase())
  }

  return {
    accessToken,
    refreshToken,
    sessionId,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,

    token,
    userId,
    sessionUserId,
    userType,
    username,
    displayName,
    userDisplayName,
    email,
    clientId,
    clientCode,
    clientName,
    roles,
    scopes,

    isAuthenticated,

    login,
    logout,
    clearSession,
    initialize,
    refreshSession,
    setSession,
    ensureValidAccessToken,
    hasValidSession,
    hasRole,
    hasScope,
    isAccessTokenExpired,
    isRefreshTokenExpired,
  }
})
