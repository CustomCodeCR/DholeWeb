import { computed, onScopeDispose, watch, type Ref } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { resolveGatewayBaseUrl } from '@/core/api/sameOriginGateway'

/**
 * Authorized SignalR JSON-protocol client for the Operations Hub.
 *
 * The server's JoinCase validates case access; notifications contain only
 * case identifiers and cause a new authorized REST read. On reconnect the
 * subscription is recreated. No documents, notes or JWTs are logged.
 */
export function useOperationsCaseRealtime(
  caseId: Ref<string>,
  onInvalidated: (id: string) => void,
): void {
  useOperationsRealtime(caseId, onInvalidated, false)
}

/** Subscribe to the authorized company dashboard, including cases created after mount. */
export function useOperationsDashboardRealtime(onInvalidated: () => void): void {
  const auth = useAuthStore()
  useOperationsRealtime(computed(() => auth.userId ?? ''), onInvalidated, true)
}

function useOperationsRealtime(
  caseId: Readonly<Ref<string>>,
  onInvalidated: (id: string) => void,
  dashboard: boolean,
): void {
  const auth = useAuthStore()
  let disposed = false
  let generation = 0
  let socket: WebSocket | null = null
  let reconnect: ReturnType<typeof setTimeout> | null = null
  let ping: ReturnType<typeof setInterval> | null = null
  let attempt = 0

  function clearTimers() {
    if (reconnect !== null) { clearTimeout(reconnect); reconnect = null }
    if (ping !== null) { clearInterval(ping); ping = null }
  }
  function stop() {
    ++generation
    clearTimers()
    const current = socket
    socket = null
    if (current) {
      current.onclose = null
      current.onmessage = null
      current.close()
    }
  }
  function schedule(id: string, expected: number) {
    if (disposed || expected !== generation || !id || reconnect !== null) return
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(++attempt, 5)))
    reconnect = setTimeout(() => {
      reconnect = null
      if (navigator.onLine && document.visibilityState !== 'hidden') void connect(id, expected)
      else schedule(id, expected)
    }, delay)
  }
  async function connect(id: string, expected: number) {
    if (!id || disposed || expected !== generation) return
    try {
      const token = await auth.ensureValidAccessToken()
      if (disposed || expected !== generation) return
      if (!token) { schedule(id, expected); return }
      const base = resolveGatewayBaseUrl(import.meta.env.VITE_API_URL) || window.location.origin
      const url = new URL('/hubs/operations', base)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      // Browsers cannot set a Bearer Authorization header on WebSocket.
      // The Hub explicitly reads access_token only for its authorized path.
      url.searchParams.set('access_token', token)
      const ws = new WebSocket(url.toString())
      socket = ws
      let buffer = ''
      let handshaken = false
      let joined = false
      const frame = (value: unknown) => JSON.stringify(value) + '\u001e'
      ws.onopen = () => {
        if (expected === generation) ws.send(frame({ protocol: 'json', version: 1 }))
      }
      ws.onmessage = event => {
        if (expected !== generation || typeof event.data !== 'string') return
        buffer += event.data
        if (buffer.length > 256000) { ws.close(); return }
        let separator = buffer.indexOf('\u001e')
        while (separator !== -1) {
          const packet = buffer.slice(0, separator)
          buffer = buffer.slice(separator + 1)
          if (packet) {
            try {
              const message = JSON.parse(packet) as {
                type?: number; target?: string; arguments?: Array<{ caseId?: string }>
                error?: string; invocationId?: string
              }
              if (!handshaken) {
                if (message.error) { ws.close(); return }
                handshaken = true
                ws.send(frame({ type: 1, target: dashboard ? 'JoinDashboard' : 'JoinCase',
                  arguments: dashboard ? [] : [id], invocationId: '1' }))
                ping = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) ws.send(frame({ type: 6 }))
                }, 15000)
              } else if (message.type === 3 && message.invocationId === '1') {
                if (message.error) { ws.close(); return }
                joined = true
                attempt = 0
                // Reconcile the REST snapshot after joining or reconnecting.
                // A Pub/Sub invalidation may have been missed while offline.
                onInvalidated(id)
              } else if (joined && dashboard && message.type === 1 &&
                         message.target?.toLowerCase() === 'operationsdashboardchanged') {
                onInvalidated(id)
              } else if (joined && !dashboard && message.type === 1 && message.target?.toLowerCase() === 'operationschanged' &&
                         message.arguments?.[0]?.caseId?.toLowerCase() === id.toLowerCase()) {
                onInvalidated(id)
              } else if (message.type === 7) {
                ws.close()
              }
            } catch {
              // Ignore malformed/unexpected invocation frames, never show data.
            }
          }
          separator = buffer.indexOf('\u001e')
        }
      }
      ws.onclose = () => {
        if (ping !== null) { clearInterval(ping); ping = null }
        if (socket === ws) socket = null
        schedule(id, expected)
      }
      ws.onerror = () => { ws.close() }
    } catch {
      schedule(id, expected)
    }
  }
  const stopWatch = watch([caseId, () => auth.userId], ([id, userId]) => {
    stop()
    attempt = 0
    if (id && userId) void connect(id, generation)
  }, { immediate: true })

  onScopeDispose(() => {
    disposed = true
    stopWatch()
    stop()
  })
}
