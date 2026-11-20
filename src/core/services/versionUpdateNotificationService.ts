import { callEndpoint } from '@/core/api/callEndpoint'

export interface VersionUpdateNotificationPreferences {
  globalEnabled: boolean
  userEnabled: boolean | null
  effectiveEnabled: boolean
}

const api = '/api/auth/version-update-notifications'
const headers = { Accept: 'application/json' }

export const versionUpdateNotificationService = {
  getCurrent: () => callEndpoint<VersionUpdateNotificationPreferences>({ method: 'GET', path: api, headers }),
  saveMine: (enabled: boolean | null) =>
    callEndpoint<VersionUpdateNotificationPreferences, { enabled: boolean | null }>(
      { method: 'PUT', path: `${api}/me`, headers },
      { body: { enabled } },
    ),
  saveGlobal: (enabled: boolean) =>
    callEndpoint<VersionUpdateNotificationPreferences, { enabled: boolean }>(
      { method: 'PUT', path: `${api}/global`, headers },
      { body: { enabled } },
    ),
  getUser: (userId: string) =>
    callEndpoint<VersionUpdateNotificationPreferences>({
      method: 'GET',
      path: `${api}/users/${encodeURIComponent(userId)}`,
      headers,
    }),
  saveUser: (userId: string, enabled: boolean | null) =>
    callEndpoint<VersionUpdateNotificationPreferences, { enabled: boolean | null }>(
      { method: 'PUT', path: `${api}/users/${encodeURIComponent(userId)}`, headers },
      { body: { enabled } },
    ),
}
