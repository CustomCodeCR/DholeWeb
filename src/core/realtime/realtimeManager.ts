/**
 * F4 candidate: one logical SignalR WebSocket per browser app.
 * REST snapshots remain authoritative; SignalR carries minimal invalidations.
 * This file has no DOM effects at module initialization so it can be tested.
 */
export type RealtimeStatus =
  | 'connecting' | 'connected' | 'reconnecting'
  | 'degraded' | 'offline' | 'unauthorized'
/** F6: resource kinds must match the Gateway's resource-scoped REST ACL allowlist. */
export const REALTIME_RESOURCE_KINDS = [
  'crm.account', 'crm.lead', 'crm.accountlist', 'crm.leadlist',
  'pricing.rate', 'pricing.cost-list', 'pricing.rate-list',
  'module.crm', 'module.pricing', 'module.auth', 'module.config', 'module.srm', 'module.audit', 'module.storage', 'module.extraction', 'module.reports', 'module.dynamics', 'module.ai', 'module.agent', 'module.content',
  'auth.user', 'config.catalog-group', 'config.catalog-item', 'config.catalog-list', 'srm.supplier',
  'audit.event', 'storage.file',
  'extraction.execution', 'extraction.emailjob', 'extraction.airequest',
  'reports.template', 'dynamics.job', 'ai.execution', 'ai.emailjob',
  'agent.execution', 'agent.definition', 'agent.schedule',
  'content.item', 'content.menu', 'content.setting',
] as const
export type RealtimeKind = typeof REALTIME_RESOURCE_KINDS[number]
const REALTIME_RESOURCE_KIND_SET: ReadonlySet<string> = new Set(REALTIME_RESOURCE_KINDS)
export type RefreshReason = 'initial' | 'event' | 'reconnect' | 'poll' | 'visible' | 'resume'

export interface RealtimeInvalidation {
  eventId: string
  eventType: string
  aggregateType: string
  aggregateId: string
  aggregateVersion: number
  occurredAtUtc: string
}
export interface RealtimeSnapshot<T> { value: T; version: number | null }
export interface RealtimeObserver<T> {
  kind: RealtimeKind
  id: string
  initialVersion?: number | null
  visible?: () => boolean
  dirty?: () => boolean
  fetchSnapshot: () => Promise<RealtimeSnapshot<T>>
  applySnapshot: (snapshot: RealtimeSnapshot<T>, reason: RefreshReason) => void
  onConflict?: (snapshot: RealtimeSnapshot<T>, event: RealtimeInvalidation | null) => void
  onDenied?: () => void
  onError?: (error: unknown) => void
}
export interface BrowserSocket {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  send(data: string): void
  close(code?: number, reason?: string): void
}
export interface RealtimeRuntime {
  baseUrl: string
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  createSocket: (url: string) => BrowserSocket
  online: () => boolean
  pageVisible: () => boolean
  schedule: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>
  cancel: (id: ReturnType<typeof setTimeout>) => void
  random: () => number
  onState?: (status: RealtimeStatus) => void
  onNotificationReceived?: (notification: unknown) => void
  onAuthSecurityChanged?: (event: unknown) => void
}
interface Watcher {
  key: string
  visible: () => boolean
  dirty: () => boolean
  fetchSnapshot: () => Promise<RealtimeSnapshot<unknown>>
  applySnapshot: (snapshot: RealtimeSnapshot<unknown>, reason: RefreshReason) => void
  onConflict?: (snapshot: RealtimeSnapshot<unknown>, event: RealtimeInvalidation | null) => void
  onDenied?: () => void
  onError?: (error: unknown) => void
  version: number | null
  conflictVersion: number | null
  inFlight: Promise<void> | null
  queuedRefresh: { reason: RefreshReason; event: RealtimeInvalidation | null } | null
  denied: boolean
}
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RS = '\u001e'
const MAX_EVENTS = 2048
const MAX_FRAME = 8192
export const REALTIME_BACKOFF_MS = [0, 2000, 5000, 10_000, 30_000] as const

function resourceKey(kind: RealtimeKind, id: string): string {
  if (!REALTIME_RESOURCE_KIND_SET.has(kind)) throw new Error('Unsupported resource.')
  if (!GUID.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(id))
    throw new Error('Invalid realtime resource identifier.')
  return kind + ':' + id.toLowerCase()
}

function isEvent(value: unknown): value is RealtimeInvalidation {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<RealtimeInvalidation>
  return typeof v.eventId === 'string' && GUID.test(v.eventId)
    && typeof v.aggregateId === 'string' && GUID.test(v.aggregateId)
    && typeof v.aggregateType === 'string' && v.aggregateType.length < 90
    && typeof v.eventType === 'string' && v.eventType.length < 170
    && Number.isSafeInteger(v.aggregateVersion) && (v.aggregateVersion ?? 0) > 0
    && typeof v.occurredAtUtc === 'string'
}

export class RealtimeUnauthorized extends Error {}

export class RealtimeManager {
  private watchers = new Map<string, Set<Watcher>>()
  private seen = new Set<string>()
  private seenQueue: string[] = []
  private socket: BrowserSocket | null = null
  private state: RealtimeStatus = 'degraded'
  private identity: string | null = null
  private tokenProvider: (() => Promise<string | null>) | null = null
  private renewToken: (() => Promise<string | null>) | null = null
  private connecting: Promise<void> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null
  private handshakeResolve: (() => void) | null = null
  private handshakeReject: ((error: Error) => void) | null = null
  private frameBuffer = ''
  private invocationId = 0
  private pending = new Map<string, string>()
  private attempt = 0
  private pollFailures = 0
  private generation = 0
  private stopped = true

  private readonly runtime: RealtimeRuntime
  constructor(runtime: RealtimeRuntime) { this.runtime = runtime }

  get status(): RealtimeStatus { return this.state }
  get activeWatchers(): number {
    return [...this.watchers.values()].reduce((n, set) => n + set.size, 0)
  }
  get socketCount(): number {
    return this.socket && this.socket.readyState < 2 ? 1 : 0
  }
  get currentIdentity(): string | null { return this.identity }

  private changeState(next: RealtimeStatus) {
    if (this.state === next) return
    this.state = next
    this.runtime.onState?.(next)
  }

  private purgeAuthorizedSnapshots() {
    // A logout, identity switch, or rejected refresh must not leave previously
    // authorized business snapshots visible in still-mounted components.
    for (const set of this.watchers.values()) {
      for (const watcher of set) {
        if (watcher.denied) continue
        watcher.denied = true
        try { watcher.onDenied?.() } catch {
          // Other observers must still be cleared if one callback fails.
        }
      }
    }
  }

  async start(
    identity: string | null,
    token: () => Promise<string | null>,
    refresh?: () => Promise<string | null>,
  ): Promise<void> {
    if (!identity || !GUID.test(identity)) {
      this.stop()
      this.changeState('unauthorized')
      return
    }
    const changed = this.identity != null && this.identity !== identity.toLowerCase()
    if (changed) this.stop()
    this.identity = identity.toLowerCase()
    this.tokenProvider = token
    this.renewToken = refresh ?? null
    this.stopped = false
    if (!this.runtime.online()) {
      this.changeState('offline')
      return
    }
    if (!this.runtime.pageVisible()) {
      this.changeState('degraded')
      return
    }
    await this.connect()
  }

  stop() {
    this.stopped = true
    this.generation++
    this.identity = null
    this.tokenProvider = null
    this.renewToken = null
    this.clearTimers()
    this.closeSocket()
    this.connecting = null
    this.pending.clear()
    this.purgeAuthorizedSnapshots()
    this.watchers.clear()
    this.seen.clear()
    this.seenQueue.length = 0
    this.attempt = 0
    this.pollFailures = 0
    this.changeState('degraded')
  }

  refreshAuthentication() {
    if (this.stopped) return
    this.generation++
    this.clearTimers()
    this.closeSocket()
    this.connecting = null
    this.attempt = 0
    for (const set of this.watchers.values())
      for (const watcher of set) watcher.denied = false
    this.changeState('reconnecting')
    void this.connect()
  }

  networkChanged() {
    if (this.stopped) return
    if (!this.runtime.online()) {
      this.generation++
      this.clearTimers()
      this.closeSocket()
      this.connecting = null
      this.changeState('offline')
      return
    }
    this.changeState('reconnecting')
    void this.reconcileAll('reconnect')
    if (this.runtime.pageVisible()) void this.connect()
    else this.schedulePoll()
  }

  visibilityChanged() {
    if (this.stopped) return
    if (!this.runtime.pageVisible()) {
      this.cancelTimer('poll')
      this.cancelTimer('reconnect')
      return
    }
    void this.reconcileAll('visible')
    if (this.runtime.online() && this.state !== 'connected') void this.connect()
    else this.schedulePoll()
  }

  subscribe<T>(observer: RealtimeObserver<T>): () => void {
    const key = resourceKey(observer.kind, observer.id)
    const watcher: Watcher = {
      key, visible: observer.visible ?? (() => true),
      dirty: observer.dirty ?? (() => false),
      fetchSnapshot: observer.fetchSnapshot,
      applySnapshot: observer.applySnapshot as Watcher['applySnapshot'],
      onConflict: observer.onConflict as Watcher['onConflict'],
      onDenied: observer.onDenied, onError: observer.onError,
      version: observer.initialVersion ?? null, conflictVersion: null, inFlight: null,
      queuedRefresh: null, denied: false,
    }
    let set = this.watchers.get(key)
    const first = !set
    if (!set) { set = new Set(); this.watchers.set(key, set) }
    set.add(watcher)
    if (!this.stopped && this.runtime.pageVisible()) {
      void this.reconcile(watcher, 'initial')
      if (first && this.state === 'connected') this.invoke('Subscribe', key)
      // A healthy websocket can silently lose a stream event or subscription.
      // Periodic REST reconciliation must run even while it remains connected.
      this.schedulePoll()
    }
    return () => {
      const existing = this.watchers.get(key)
      if (!existing) return
      existing.delete(watcher)
      if (existing.size === 0) {
        this.watchers.delete(key)
        for (const [id, value] of this.pending)
          if (value === key) this.pending.delete(id)
        if (this.state === 'connected') this.invoke('Unsubscribe', key)
      }
      if (this.watchers.size === 0) this.cancelTimer('poll')
    }
  }

  resume(kind: RealtimeKind, id: string) {
    const key = resourceKey(kind, id)
    for (const watcher of this.watchers.get(key) ?? [])
      if (!watcher.dirty()) void this.reconcile(watcher, 'resume')
  }

  private clearTimers() {
    this.cancelTimer('poll')
    this.cancelTimer('reconnect')
    this.cancelTimer('handshake')
  }
  private cancelTimer(kind: 'poll' | 'reconnect' | 'handshake') {
    const key = kind === 'poll' ? 'pollTimer' :
      kind === 'reconnect' ? 'reconnectTimer' : 'handshakeTimer'
    const id = this[key]
    if (id != null) this.runtime.cancel(id)
    this[key] = null
  }
  private closeSocket() {
    const ws = this.socket
    this.socket = null
    this.frameBuffer = ''
    this.pending.clear()
    if (this.handshakeReject) this.handshakeReject(new Error('Realtime session ended.'))
    this.handshakeResolve = null
    this.handshakeReject = null
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
      if (ws.readyState < 2) ws.close(1000, 'Realtime lifecycle change')
    }
  }
  private endpoint(path: string): URL {
    if (!this.runtime.baseUrl.trim()) throw new Error('Gateway API URL is missing.')
    const base = new URL(this.runtime.baseUrl)
    if (base.protocol !== 'https:' && base.protocol !== 'http:')
      throw new Error('Realtime gateway requires HTTP(S).')
    if (base.username || base.password) throw new Error('Gateway URL cannot contain credentials.')
    base.hash = ''
    base.search = ''
    base.pathname = (base.pathname.replace(/\/$/, '') + path).replace(/\/+/g, '/')
    return base
  }
  private async negotiate(token: string): Promise<{ id: string; ticket: string }> {
    const negotiation = this.endpoint('/api/notifications/hub/negotiate')
    negotiation.searchParams.set('negotiateVersion', '1')
    const response = await this.runtime.fetch(negotiation.toString(), {
      method: 'POST', headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'text/plain;charset=UTF-8',
      }, cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) throw new RealtimeUnauthorized()
    if (!response.ok) throw new Error('Realtime negotiation failed (' + response.status + ')')
    const value = await response.json() as { connectionToken?: string; connectionId?: string; error?: string }
    const id = value.connectionToken ?? value.connectionId
    if (value.error || !id || id.length > 200) throw new Error('Invalid SignalR negotiation.')
    const ticketResponse = await this.runtime.fetch(this.endpoint('/api/notifications/hub/ticket').toString(), {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
    })
    if (ticketResponse.status === 401 || ticketResponse.status === 403)
      throw new RealtimeUnauthorized()
    if (!ticketResponse.ok) throw new Error('Realtime ticket request failed (' + ticketResponse.status + ')')
    const ticketData = await ticketResponse.json() as { ticket?: string }
    if (!ticketData.ticket || !/^[A-Za-z0-9_-]{43}$/.test(ticketData.ticket))
      throw new Error('Invalid SignalR ticket.')
    return { id, ticket: ticketData.ticket }
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.state === 'unauthorized' || !this.runtime.online() ||
      !this.runtime.pageVisible()) return
    if (this.socket && this.socket.readyState < 2) return
    if (this.connecting) return this.connecting
    const epoch = this.generation
    this.changeState(this.attempt ? 'reconnecting' : 'connecting')
    const task = (async () => {
      try {
        let token = await this.tokenProvider?.()
        if (!token) throw new RealtimeUnauthorized()
        let session: { id: string; ticket: string }
        try {
          session = await this.negotiate(token)
        } catch (error) {
          if (!(error instanceof RealtimeUnauthorized) || !this.renewToken) throw error
          token = await this.renewToken()
          if (!token) throw new RealtimeUnauthorized()
          session = await this.negotiate(token)
        }
        if (this.stopped || epoch !== this.generation) return
        const url = this.endpoint('/api/notifications/hub')
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        url.searchParams.set('id', session.id)
        url.searchParams.set('ticket', session.ticket)
        const socket = this.runtime.createSocket(url.toString())
        this.socket = socket
        this.frameBuffer = ''
        await new Promise<void>((resolve, reject) => {
          this.handshakeResolve = resolve
          this.handshakeReject = reject
          this.handshakeTimer = this.runtime.schedule(() => {
            reject(new Error('Realtime handshake timed out.'))
          }, 8000)
          socket.onopen = () => socket.send('{"protocol":"json","version":1}' + RS)
          socket.onmessage = (event) => this.receive(String(event.data))
          socket.onerror = () => reject(new Error('Realtime WebSocket failed.'))
          socket.onclose = () => {
            if (this.socket !== socket) return
            this.socket = null
            if (this.handshakeReject) this.handshakeReject(new Error('Realtime handshake closed.'))
            this.handshakeResolve = this.handshakeReject = null
            if (this.stopped || epoch !== this.generation) return
            this.changeState('degraded')
            this.queueRetry()
          }
        })
        this.cancelTimer('handshake')
        this.handshakeReject = this.handshakeResolve = null
        if (this.stopped || epoch !== this.generation) return
        this.attempt = 0
        this.pollFailures = 0
        this.cancelTimer('reconnect')
        this.cancelTimer('poll')
        this.changeState('connected')
        for (const key of this.watchers.keys()) this.invoke('Subscribe', key)
        await this.reconcileAll('reconnect')
        this.schedulePoll()
      } catch (error) {
        if (this.stopped || epoch !== this.generation) return
        this.cancelTimer('handshake')
        this.closeSocket()
        if (error instanceof RealtimeUnauthorized) {
          this.purgeAuthorizedSnapshots()
          this.changeState('unauthorized')
          return
        }
        this.changeState(this.runtime.online() ? 'degraded' : 'offline')
        this.queueRetry()
      }
    })()
    this.connecting = task
    try { await task } finally {
      if (this.connecting === task) this.connecting = null
    }
  }

  private queueRetry() {
    if (this.stopped || this.state === 'unauthorized') return
    this.schedulePoll()
    if (this.reconnectTimer || !this.runtime.online() || !this.runtime.pageVisible()) return
    const delay = REALTIME_BACKOFF_MS[Math.min(this.attempt, REALTIME_BACKOFF_MS.length - 1)]!
    this.attempt++
    this.reconnectTimer = this.runtime.schedule(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay + Math.floor(delay * 0.25 * this.runtime.random()))
  }

  private schedulePoll() {
    if (this.stopped || this.watchers.size === 0 || this.pollTimer ||
      !this.runtime.online() || !this.runtime.pageVisible() ||
      this.state === 'unauthorized') return
    const delay = this.state === 'connected' ? 60_000
      : Math.min(30_000, 5000 * 2 ** Math.min(this.pollFailures, 3))
    this.pollTimer = this.runtime.schedule(() => {
      this.pollTimer = null
      void this.reconcileAll('poll').finally(() => {
        if (!this.stopped && this.watchers.size > 0) this.schedulePoll()
      })
    }, delay)
  }

  private async reconcileAll(reason: RefreshReason) {
    if (this.stopped || !this.runtime.online() || !this.runtime.pageVisible()) return
    const all = [...this.watchers.values()].flatMap((s) => [...s])
    await Promise.all(all.filter(w => w.visible() && !w.denied)
      .map(w => this.reconcile(w, reason)))
  }

  private async reconcile(watcher: Watcher, reason: RefreshReason,
    event: RealtimeInvalidation | null = null): Promise<void> {
    if (this.stopped || watcher.denied || !watcher.visible() || !this.runtime.online() ||
      !this.runtime.pageVisible() ||
      !this.watchers.get(watcher.key)?.has(watcher)) return
    if (watcher.inFlight) {
      // An event arriving during an older REST GET must not be lost.
      watcher.queuedRefresh = { reason, event }
      return watcher.inFlight
    }
    const epoch = this.generation
    const task = (async () => {
      try {
        const snapshot = await watcher.fetchSnapshot()
        if (this.stopped || watcher.denied || epoch !== this.generation ||
          !this.watchers.get(watcher.key)?.has(watcher)) return
        const version = snapshot.version
        if (version != null && (!Number.isSafeInteger(version) || version < 0))
          throw new Error('Invalid REST aggregate version.')
        if (watcher.dirty()) {
          if (version == null || watcher.version == null || version > watcher.version) {
            if (watcher.conflictVersion !== version) {
              watcher.conflictVersion = version
              watcher.onConflict?.(snapshot, event)
            }
          }
          return
        }
        if (version == null || watcher.version == null || version >= watcher.version) {
          watcher.applySnapshot(snapshot, reason)
          if (version != null) watcher.version = version
          watcher.conflictVersion = null
        }
        this.pollFailures = 0
      } catch (error) {
        if (this.stopped || epoch !== this.generation) return
        if (isForbidden(error)) {
          watcher.denied = true
          watcher.onDenied?.()
          if (this.state === 'connected') this.invoke('Unsubscribe', watcher.key)
          return
        }
        watcher.onError?.(error)
        this.pollFailures++
      }
    })()
    watcher.inFlight = task
    try { await task } finally {
      if (watcher.inFlight === task) {
        watcher.inFlight = null
        const queued = watcher.queuedRefresh
        watcher.queuedRefresh = null
        if (queued && !this.stopped && epoch === this.generation &&
          this.watchers.get(watcher.key)?.has(watcher))
          void this.reconcile(watcher, queued.reason, queued.event)
      }
    }
  }

  private invoke(method: 'Subscribe' | 'Unsubscribe', key: string) {
    if (!this.socket || this.socket.readyState !== 1 || this.state !== 'connected') return
    const sep = key.indexOf(':')
    if (sep < 0) return
    const kind = key.slice(0, sep)
    const id = key.slice(sep + 1)
    const invocationId = String(++this.invocationId)
    if (method === 'Subscribe') this.pending.set(invocationId, key)
    this.socket.send(JSON.stringify({
      type: 1, invocationId,
      target: method === 'Subscribe' ? 'SubscribeResource' : 'UnsubscribeResource',
      arguments: [kind, id],
    }) + RS)
  }

  private receive(chunk: string) {
    this.frameBuffer += chunk
    if (this.frameBuffer.length > MAX_FRAME * 4) {
      this.socket?.close(1009, 'Frame too large')
      return
    }
    let index = this.frameBuffer.indexOf(RS)
    while (index >= 0) {
      const frame = this.frameBuffer.slice(0, index)
      this.frameBuffer = this.frameBuffer.slice(index + RS.length)
      if (frame && frame.length <= MAX_FRAME) this.processFrame(frame)
      index = this.frameBuffer.indexOf(RS)
    }
  }

  private processFrame(frame: string) {
    let message: Record<string, unknown>
    try {
      const result: unknown = JSON.parse(frame)
      if (!result || typeof result !== 'object' || Array.isArray(result)) return
      message = result as Record<string, unknown>
    } catch { return }
    if (this.handshakeResolve) {
      if (typeof message.error === 'string') this.handshakeReject?.(new Error('Handshake rejected.'))
      else this.handshakeResolve()
      return
    }
    if (message.type === 1 &&
        String(message.target ?? '').toLowerCase() === 'notificationreceived') {
      const values = message.arguments
      if (Array.isArray(values) && values.length === 1)
        this.runtime.onNotificationReceived?.(values[0])
      return
    }
    if (message.type === 1 &&
        String(message.target ?? '').toLowerCase() === 'authsecuritychanged') {
      const values = message.arguments
      if (Array.isArray(values) && values.length === 1)
        this.runtime.onAuthSecurityChanged?.(values[0])
      return
    }
    if (message.type === 7) {
      this.socket?.close(1000, 'SignalR close')
      return
    }
    if (message.type === 3 && typeof message.invocationId === 'string') {
      const key = this.pending.get(message.invocationId)
      this.pending.delete(message.invocationId)
      if (key && typeof message.error === 'string') {
        for (const watcher of this.watchers.get(key) ?? []) {
          watcher.denied = true
          watcher.onDenied?.()
        }
      }
      return
    }
    // F6: when owner REST denies a previously subscribed resource, drop its
    // cached data immediately instead of waiting for socket failure/polling.
    // The backend sends only its existing resource identifier, no business data.
    if (message.type === 1 && message.target === 'resourceRevoked') {
      const revoked = message.arguments
      if (!Array.isArray(revoked) || revoked.length !== 2) return
      const kind = revoked[0]
      const id = revoked[1]
      if (typeof kind !== 'string' || !REALTIME_RESOURCE_KIND_SET.has(kind) ||
          typeof id !== 'string') return
      let key: string
      try { key = resourceKey(kind as RealtimeKind, id) } catch { return }
      for (const watcher of this.watchers.get(key) ?? []) {
        watcher.denied = true
        watcher.onDenied?.()
      }
      return
    }
    if (message.type !== 1 || message.target !== 'resourceChanged') return
    const args = message.arguments
    if (!Array.isArray(args) || !isEvent(args[0])) return
    const event = args[0]
    if (this.seen.has(event.eventId)) return
    this.seen.add(event.eventId)
    this.seenQueue.push(event.eventId)
    if (this.seenQueue.length > MAX_EVENTS) {
      const oldest = this.seenQueue.shift()
      if (oldest) this.seen.delete(oldest)
    }
    // Match both the declared domain event and aggregate type, never infer a
    // resource by aggregateType alone (several services share e.g. "job").
    const kind = REALTIME_RESOURCE_KINDS.find(candidate =>
      event.eventType.startsWith(candidate + '.') &&
      event.aggregateType === candidate.slice(candidate.indexOf('.') + 1))
    if (!kind) return
    let key: string
    try { key = resourceKey(kind, event.aggregateId) } catch { return }
    for (const watcher of this.watchers.get(key) ?? []) {
      if (watcher.denied || !watcher.visible()) continue
      // F7 C06: several producers emit a process-local version hint rather
      // than an authoritative entity sequence. Do not discard a distinct
      // event solely because its hint is lower than the last REST snapshot.
      void this.reconcile(watcher, 'event', event)
    }
  }
}

function isForbidden(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } }
  const status = e.status ?? e.statusCode ?? e.response?.status
  return status === 401 || status === 403 || status === 404
}
