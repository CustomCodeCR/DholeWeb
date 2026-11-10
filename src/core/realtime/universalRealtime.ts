import { ref } from 'vue'
import { callEndpoint } from '@/core/api/callEndpoint'
import { useAuthStore } from '@/core/stores/authStore'
import {
  RealtimeManager,
  type RealtimeObserver,
  type RealtimeKind,
  type RealtimeStatus,
} from './realtimeManager'

/**
 * F4 candidate: intentional triple interlock until the *entire* batch is
 * validated. Defaults OFF even when the Gateway serves the Hub.
 */
export const UNIVERSAL_REALTIME_ENABLED =
  import.meta.env.VITE_DHOLE_REALTIME_ENABLED === 'true'
  && import.meta.env.VITE_DHOLE_REALTIME_NOTIFICATIONS_PILOT === 'true'
  && import.meta.env.VITE_DHOLE_REALTIME_RELEASE === 'rt-20261107-01'

const CATALOG_LIST_ID = '00000000-0000-4000-8000-000000000042'
let stopCatalogObserver: (() => void) | null = null

function startCatalogInvalidations() {
  if (stopCatalogObserver) return
  stopCatalogObserver = universalRealtimeManager.subscribe({
    kind: 'config.catalog-list',
    id: CATALOG_LIST_ID,
    // Authenticated owner REST check remains mandatory for every invalidation.
    fetchSnapshot: async () => {
      await callEndpoint<unknown>({ method: 'GET', path: '/api/config/catalog-items/realtime-access' })
      return { value: true, version: null }
    },
    applySnapshot: (_snapshot, reason) => {
      window.dispatchEvent(new CustomEvent('dhole:catalog:changed', { detail: { reason } }))
      window.dispatchEvent(new CustomEvent('dhole:data:changed', {
        detail: {
          endpoint: '/api/config/catalog-items/select',
          method: 'SIGNALR',
          occurredAt: new Date().toISOString(),
        },
      }))
    },
  })
}

const LIST_SUBSCRIPTIONS = [
  { kind: 'pricing.cost-list', id: '00000000-0000-4000-8000-000000000043', endpoint: '/api/pricing/costs' },
  { kind: 'pricing.rate-list', id: '00000000-0000-4000-8000-000000000044', endpoint: '/api/pricing/rates' },
  { kind: 'crm.accountlist', id: '00000000-0000-4000-8000-000000000045', endpoint: '/api/crm/accounts' },
  { kind: 'crm.leadlist', id: '00000000-0000-4000-8000-000000000046', endpoint: '/api/crm/leads' },
] as const

let stopCollectionObservers: Array<() => void> = []
function startCollectionInvalidations() {
  if (stopCollectionObservers.length) return
  stopCollectionObservers = LIST_SUBSCRIPTIONS.map(({ kind, id, endpoint }) =>
    universalRealtimeManager.subscribe({
      kind,
      id,
      fetchSnapshot: async () => {
        // Use the same owner ACL as the actual collection REST. Never accept
        // a notification as permission to read a customer's or cost data.
        await callEndpoint<unknown>({ method: 'GET', path: endpoint + '/realtime-access' })
        return { value: true, version: null }
      },
      applySnapshot: (_snapshot, reason) => {
        window.dispatchEvent(new CustomEvent('dhole:data:changed', {
          detail: { endpoint, method: 'SIGNALR', reason, occurredAt: new Date().toISOString() },
        }))
      },
    }),
  )
}

const MODULE_TOPICS = [
  { domain: 'crm', id: '00000000-0000-4000-8000-000000000051', path: '/api/crm' },
  { domain: 'pricing', id: '00000000-0000-4000-8000-000000000052', path: '/api/pricing' },
  { domain: 'auth', id: '00000000-0000-4000-8000-000000000053', path: '/api/auth' },
  { domain: 'config', id: '00000000-0000-4000-8000-000000000054', path: '/api/config' },
  { domain: 'srm', id: '00000000-0000-4000-8000-000000000055', path: '/api/config/srm' },
  { domain: 'audit', id: '00000000-0000-4000-8000-000000000056', path: '/api/auditlogs' },
  { domain: 'storage', id: '00000000-0000-4000-8000-000000000057', path: '/api/v1/storage' },
  { domain: 'extraction', id: '00000000-0000-4000-8000-000000000058', path: '/api/data-extraction' },
  { domain: 'reports', id: '00000000-0000-4000-8000-000000000059', path: '/api/reports' },
  { domain: 'dynamics', id: '00000000-0000-4000-8000-000000000060', path: '/api/dynamics-connector' },
  { domain: 'ai', id: '00000000-0000-4000-8000-000000000061', path: '/api/ai' },
  { domain: 'agent', id: '00000000-0000-4000-8000-000000000062', path: '/api/agents' },
  { domain: 'content', id: '00000000-0000-4000-8000-000000000063', path: '/api/content' },
] as const

let stopModuleObservers: Array<() => void> = []
function startModuleInvalidations() {
  if (stopModuleObservers.length) return
  // The Hub rechecks the original record's owner REST ACL before forwarding
  // any module event to this authenticated client. Only a minimal hint is sent.
  stopModuleObservers = MODULE_TOPICS.map(({ domain, id, path }) =>
    universalRealtimeManager.subscribe({
      kind: `module.${domain}` as RealtimeKind,
      id,
      fetchSnapshot: async () => ({ value: true, version: null }),
      applySnapshot: (_snapshot, reason) => {
        if (reason === 'initial') return
        // Existing screen data is always reloaded using its own authorized REST.
        window.dispatchEvent(new CustomEvent('dhole:data:changed', {
          detail: { endpoint: path, method: 'SIGNALR', reason, occurredAt: new Date().toISOString() },
        }))
      },
    }),
  )
}

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
  startCatalogInvalidations()
  startCollectionInvalidations()
  startModuleInvalidations()
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
  stopCatalogObserver?.()
  stopCatalogObserver = null
  for (const dispose of stopCollectionObservers) dispose()
  stopCollectionObservers = []
  for (const dispose of stopModuleObservers) dispose()
  stopModuleObservers = []
  universalRealtimeManager.stop()
  removeLifecycleListeners()
}

export function subscribeUniversalRealtime<T>(observer: RealtimeObserver<T>): () => void {
  if (!UNIVERSAL_REALTIME_ENABLED) return () => {}
  return universalRealtimeManager.subscribe(observer)
}
