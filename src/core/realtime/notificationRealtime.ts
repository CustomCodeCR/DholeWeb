import { useToastStore, type ToastType } from '@/core/stores/toastStore'

export interface SystemNotificationPush {
  notificationId: string
  recipientId: string
  userId: string
  notificationType: string
  subject?: string | null
  body?: string | null
  payloadJson: string
  entityType?: string | null
  entityId?: string | null
  occurredAtUtc: string
}

interface SignalRNegotiateResponse {
  connectionId?: string
  connectionToken?: string
  error?: string
}

interface SignalRInvocationMessage {
  type?: number
  target?: string
  arguments?: unknown[]
  error?: string
}

interface PricingVariationPayload {
  direction?: string
  previousAmount?: number
  currentAmount?: number
  delta?: number
  percentage?: number
  carrierName?: string
  polName?: string
  poeName?: string
  containerTypeName?: string
}

const recordSeparator = '\u001e'
const reconnectDelays = [0, 2_000, 5_000, 10_000, 30_000]
let socket: WebSocket | null = null
let stopped = true
let reconnectAttempt = 0
let reconnectTimer: number | null = null
let connecting: Promise<void> | null = null
let lastFailureToastAt = 0

function apiGatewayBaseUrl(): URL | null {
  const configured = String(import.meta.env.VITE_API_URL ?? '').trim()
  if (!configured) return null

  try {
    const url = new URL(configured, window.location.origin)
    url.pathname = url.pathname.replace(/\/$/, '')
    url.search = ''
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function hubHttpUrls(base: URL, path = '') {
  const basePath = base.pathname.replace(/\/$/, '')
  return ['/api/notifications/hub', '/notifications/hub'].map((hubPath) => {
    const url = new URL(base.toString())
    url.pathname = `${basePath}${hubPath}${path}`.replace(/\/+/g, '/')
    url.search = ''
    url.hash = ''
    return url
  })
}

async function negotiate(base: URL, accessToken: string) {
  let lastError: Error | null = null

  for (const url of hubHttpUrls(base, '/negotiate')) {
    url.searchParams.set('negotiateVersion', '1')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain;charset=UTF-8',
      },
    })

    if (!response.ok) {
      lastError = new Error(`SignalR negotiate failed (${response.status}) at ${url.toString()}.`)
      continue
    }

    const result = (await response.json()) as SignalRNegotiateResponse
    if (result.error) {
      lastError = new Error(result.error)
      continue
    }

    if (!result.connectionToken && !result.connectionId) {
      lastError = new Error('SignalR negotiate did not return a connection token.')
      continue
    }

    return {
      result,
      hubUrl: new URL(url.toString().replace(/\/negotiate(?:\?.*)?$/, '')),
    }
  }

  throw lastError ?? new Error('SignalR negotiate failed.')
}

function websocketUrl(hubUrl: URL, connectionToken: string, accessToken: string) {
  const url = new URL(hubUrl.toString())
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('id', connectionToken)
  url.searchParams.set('access_token', accessToken)
  return url.toString()
}

function parsePricingPayload(payloadJson: string): PricingVariationPayload | null {
  if (!payloadJson) return null

  try {
    return JSON.parse(payloadJson) as PricingVariationPayload
  } catch {
    return null
  }
}

function showPricingVariation(notification: SystemNotificationPush) {
  const toast = useToastStore()
  const payload = parsePricingPayload(notification.payloadJson)
  const direction = String(payload?.direction ?? '').toLocaleLowerCase()
  const type: ToastType = direction.includes('baj') ? 'success' : 'warning'

  toast.show({
    title: notification.subject || 'Cambio en tarifa importada',
    message: notification.body || 'Pricing detectó una variación en una tarifa importada utilizada.',
    type,
    duration: 10_000,
  })
}

function handleNotification(notification: SystemNotificationPush) {
  if (notification.notificationType === 'pricing.imported-rate.variation') {
    showPricingVariation(notification)

    window.dispatchEvent(
      new CustomEvent('dhole:data:changed', {
        detail: {
          endpoint: '/api/pricing/import-rates',
          method: 'SIGNALR',
          occurredAt: notification.occurredAtUtc,
        },
      }),
    )
  } else {
    const toast = useToastStore()
    toast.show({
      title: notification.subject || 'Nueva notificación',
      message: notification.body || undefined,
      type: 'info',
      duration: 6_000,
    })
  }

  window.dispatchEvent(new CustomEvent('dhole:notification:received', { detail: notification }))
}

function processFrame(frame: string) {
  if (!frame.trim()) return

  let message: SignalRInvocationMessage
  try {
    message = JSON.parse(frame) as SignalRInvocationMessage
  } catch {
    return
  }

  if (message.type === 1 && message.target?.toLocaleLowerCase() === 'notificationreceived') {
    const notification = message.arguments?.[0] as SystemNotificationPush | undefined
    if (notification?.notificationId) handleNotification(notification)
    return
  }

  if (message.type === 7 && !stopped) {
    socket?.close()
  }
}

function scheduleReconnect() {
  if (stopped || reconnectTimer !== null) return
  const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)]
  reconnectAttempt += 1
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    void connect()
  }, delay)
}

function waitForWebSocketOpen(ws: WebSocket, timeoutMs = 7_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      try {
        ws.close()
      } catch {
        // Ignore close failures for a socket that never opened.
      }
      reject(new Error('SignalR WebSocket upgrade timed out.'))
    }, timeoutMs)

    const cleanup = () => {
      window.clearTimeout(timer)
      ws.onopen = null
      ws.onerror = null
      ws.onclose = null
    }

    ws.onopen = () => {
      cleanup()
      resolve()
    }

    ws.onerror = () => {
      cleanup()
      reject(new Error('SignalR WebSocket upgrade failed.'))
    }

    ws.onclose = () => {
      cleanup()
      reject(new Error('SignalR WebSocket closed before the connection was established.'))
    }
  })
}

async function openSignalRSocket(accessToken: string): Promise<WebSocket> {
  const base = apiGatewayBaseUrl()
  if (!base) {
    throw new Error('VITE_API_URL is not configured for realtime notifications.')
  }

  const negotiation = await negotiate(base, accessToken)
  const connectionToken = negotiation.result.connectionToken ?? negotiation.result.connectionId!
  const ws = new WebSocket(websocketUrl(negotiation.hubUrl, connectionToken, accessToken))
  await waitForWebSocketOpen(ws)
  return ws
}

async function connect() {
  if (
    stopped ||
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  )
    return
  if (connecting) return connecting

  connecting = (async () => {
    const accessToken = localStorage.getItem('auth.accessToken')
    if (!accessToken || stopped) return

    try {
      const ws = await openSignalRSocket(accessToken)
      if (stopped) {
        ws.close(1000, 'Application stopped realtime notifications.')
        return
      }

      socket = ws
      reconnectAttempt = 0

      ws.onmessage = (event) => {
        String(event.data).split(recordSeparator).filter(Boolean).forEach(processFrame)
      }

      ws.onerror = () => {
        // onclose performs the reconnect; persistent notifications remain queryable via the API.
      }

      ws.onclose = () => {
        if (socket === ws) socket = null
        window.dispatchEvent(new CustomEvent('dhole:notification:realtime-disconnected'))
        scheduleReconnect()
      }

      ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + recordSeparator)
      window.dispatchEvent(new CustomEvent('dhole:notification:realtime-connected'))
    } catch (error) {
      const now = Date.now()
      if (now - lastFailureToastAt > 60_000) {
        lastFailureToastAt = now
        useToastStore().warning(
          'Notificaciones en tiempo real desconectadas',
          'Se reintentará la conexión automáticamente. Las notificaciones siguen disponibles en el historial.',
        )
      }
      window.dispatchEvent(new CustomEvent('dhole:notification:realtime-error', { detail: error }))
      scheduleReconnect()
    }
  })().finally(() => {
    connecting = null
  })

  return connecting
}

export async function startNotificationRealtime() {
  stopped = false
  await connect()
}

export async function stopNotificationRealtime() {
  stopped = true
  reconnectAttempt = 0
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  const current = socket
  socket = null
  if (current && current.readyState < WebSocket.CLOSING)
    current.close(1000, 'Application stopped realtime notifications.')
}
