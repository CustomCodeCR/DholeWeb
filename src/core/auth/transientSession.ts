import type { ImpersonationResponse } from '@/core/interfaces/auth'

// A temporary impersonation belongs to the current browser tab, not to the
// administrator's durable localStorage session.
const IMPERSONATION_KEY = 'dhole:auth:impersonation:v1'

type StoredImpersonation = ImpersonationResponse & { ownerId: string }
let transientAccessToken: string | null = null

function isImpersonationTokenValid(token: string, expiresAt: string): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return false
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as Record<string, unknown>
    if (claims.impersonation !== true && claims.impersonation !== 'true' && !claims.impersonator_user_id) {
      return false
    }
    const jwtExpiration = typeof claims.exp === 'number' ? claims.exp * 1000 : NaN
    const sessionExpiration = new Date(expiresAt).getTime()
    // Impersonation access tokens cannot be refreshed. Never resurrect an
    // expired token, including when only one of the expirations is valid.
    return Number.isFinite(jwtExpiration)
      && Number.isFinite(sessionExpiration)
      && jwtExpiration > Date.now()
      && sessionExpiration > Date.now()
  } catch {
    return false
  }
}

export function restoreTransientImpersonation(): ImpersonationResponse | null {
  try {
    const stored = sessionStorage.getItem(IMPERSONATION_KEY)
    if (!stored) return null
    const data = JSON.parse(stored) as StoredImpersonation
    const ownerId = localStorage.getItem('auth.userId')
    if (!data || !ownerId || data.ownerId !== ownerId || !data.sessionId
      || !isImpersonationTokenValid(data.accessToken, data.accessTokenExpiresAt)) {
      clearTransientAccessToken()
      return null
    }
    transientAccessToken = data.accessToken
    return data
  } catch {
    clearTransientAccessToken()
    return null
  }
}

export function getTransientAccessToken(): string | null {
  // API clients may run before the Pinia store is initialized after a reload.
  return transientAccessToken ?? restoreTransientImpersonation()?.accessToken ?? null
}

export function hasTransientAccessToken(): boolean {
  return Boolean(getTransientAccessToken())
}

export function setTransientAccessToken(token: string): void {
  transientAccessToken = token
}

export function saveTransientImpersonation(data: ImpersonationResponse, ownerId: string): void {
  transientAccessToken = data.accessToken
  try {
    if (ownerId) {
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ ...data, ownerId }))
    }
  } catch {
    // Storage-restricted browsers can still impersonate until a full reload.
  }
}

export function clearTransientAccessToken(): void {
  transientAccessToken = null
  try {
    sessionStorage.removeItem(IMPERSONATION_KEY)
  } catch {
    // A blocked storage API must never prevent ending impersonation.
  }
}
