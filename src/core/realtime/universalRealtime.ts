import { ref } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import {
  RealtimeManager,
  type RealtimeObserver,
  type RealtimeStatus,
} from './realtimeManager'

/**
 * F4 candidate: intentional triple interlock until the *entire* batch is
 * validated. Defaults OFF even when the Gateway serves the Hub.
 */
export const UNIVERSAL_REALTIME_ENABLED =
  import.meta.env.VITE_DHOLE_REALTIME_ENABLED === 'true'
  && import.meta.env.VITE_DHOLE_REALTIME_NOTIFICATIONS_PILOT === 'true'
  && import.meta.env.VITE_DHOLE_REALTIME_RELEASE === 'rt-notificationshub-20261109-01'

let onNotification: ((notification: unknown) => void) | null = null
export function setUniversalRealtimeNotificationHandler(
  callback: ((notification: unknown) => void) | null,
) { onNotification = callback }

export const universalRealtimeStatus = ref<RealtimeStatus>('degraded')

export const universalRealtimeManager = new RealtimeManager({
  baseUrl: String(import.meta.env.VITE_API_URL ?? ''),
  fetch: (url, options) => fetch(url, options),
  createSocket: url => new WebSocket(url),
  online: () => navigator.onLine,
  pageVisible: () => document.visibilityState === 'visible',
  schedule: (callback, ms) => window.setTimeout(callback, ms),
  cancel: timer => window.clearTimeout(timer),
  random: () => Math.random(),
  onState: status => { universalRealtimeStatus.value = status },
  onNotificationReceived: value => onNotification?.(value),
})

let listenersInstalled = false
function handleNetworkChange() { universalRealtimeManager.networkChanged() }
function handleVisibility() { universalRealtimeManager.visibilityChanged() }

function installLifecycleListeners() {
  if (listenersInstalled) return
  window.addEventListener('online', handleNetworkChange)
  window.addEventListener('offline', handleNetworkChange)
  document.addEventListener('visibilitychange', handleVisibility)
  listenersInstalled = true
}
function removeLifecycleListeners() {
  if (!listenersInstalled) return
  window.removeEventListener('online', handleNetworkChange)
  window.removeEventListener('offline', handleNetworkChange)
  document.removeEventListener('visibilitychange', handleVisibility)
  listenersInstalled = false
}

export async function startUniversalRealtime() {
  if (!UNIVERSAL_REALTIME_ENABLED) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated || !auth.userId) {
    stopUniversalRealtime()
    return
  }
  installLifecycleListeners()
  await universalRealtimeManager.start(
    auth.userId,
    async () => auth.ensureValidAccessToken(),
    async () => {
      if (!await auth.refreshSession()) return null
      return auth.accessToken
    },
  )
}

export function refreshUniversalRealtimeCredentials() {
  if (!UNIVERSAL_REALTIME_ENABLED) return
  const auth = useAuthStore()
  if (!auth.isAuthenticated || !auth.userId) {
    stopUniversalRealtime()
    return
  }
  if (universalRealtimeManager.currentIdentity !== auth.userId.toLowerCase()) {
    void startUniversalRealtime()
    return
  }
  universalRealtimeManager.refreshAuthentication()
}

export function stopUniversalRealtime() {
  universalRealtimeManager.stop()
  removeLifecycleListeners()
}

export function subscribeUniversalRealtime<T>(observer: RealtimeObserver<T>): () => void {
  if (!UNIVERSAL_REALTIME_ENABLED) return () => {}
  return universalRealtimeManager.subscribe(observer)
}
