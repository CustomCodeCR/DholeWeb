import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RealtimeManager,
  type BrowserSocket,
  type RealtimeRuntime,
  type RealtimeInvalidation,
  REALTIME_RESOURCE_KINDS,
} from '../src/core/realtime/realtimeManager.ts'

const ID = '12345678-1111-4111-8111-111111111111'
const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const RS = '\u001e'
const TICKET = 'abcdefghijklmnopqrstuvwxyz0123456789-_ABCde'

async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  await new Promise<void>(resolve => setImmediate(resolve))
}
class FakeClock {
  private nextId = 1
  callbacks = new Map<number, { cb: () => void; delay: number }>()
  schedule = (cb: () => void, delay: number): ReturnType<typeof setTimeout> => {
    const id = this.nextId++
    this.callbacks.set(id, { cb, delay })
    return id as unknown as ReturnType<typeof setTimeout>
  }
  cancel = (id: ReturnType<typeof setTimeout>) => {
    this.callbacks.delete(id as unknown as number)
  }
  async advanceNext() {
    const next = [...this.callbacks.entries()].sort((a, b) => a[1].delay - b[1].delay)[0]
    if (!next) throw new Error('No timers to advance.')
    this.callbacks.delete(next[0])
    next[1].cb()
    await settle()
  }
}

class FakeSocket implements BrowserSocket {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  sent: string[] = []
  closed = false
  url: string
  constructor(url: string) { this.url = url; queueMicrotask(() => this.open()) }
  private open() {
    if (this.closed) return
    this.readyState = 1
    this.onopen?.({} as Event)
  }
  send(text: string) {
    this.sent.push(text)
    if (text.includes('"protocol":"json"')) queueMicrotask(() =>
      this.onmessage?.({ data: '{}' + RS } as MessageEvent))
  }
  emitEvent(event: RealtimeInvalidation) {
    this.onmessage?.({ data: JSON.stringify({
      type: 1, target: 'resourceChanged', arguments: [event],
    }) + RS } as MessageEvent)
  }
  emitRevoked(kind: string, id: string) {
    this.onmessage?.({ data: JSON.stringify({
      type: 1, target: 'resourceRevoked', arguments: [kind, id],
    }) + RS } as MessageEvent)
  }
  close() {
    if (this.closed) return
    this.closed = true
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }
}

class FakeHost {
  clock = new FakeClock()
  sockets: FakeSocket[] = []
  requests: { url: string; bearer: string }[] = []
  states: string[] = []
  online = true
  visible = true
  initialFailures = 0
  expired = false
  restVersion = 1
  restFetches = 0
  bearer = 'CI-JWT-BEARER-SHOULD-NEVER-BE-PLACED-IN-WS-URL'
  runtime: RealtimeRuntime = {
    baseUrl: 'https://gateway.example',
    fetch: async (url, options) => {
      const bearer = new Headers(options?.headers).get('Authorization') ?? ''
      this.requests.push({ url, bearer })
      if (this.expired) return new Response('', { status: 401 })
      if (this.initialFailures > 0) {
        this.initialFailures--
        throw new Error('simulated connect failure')
      }
      if (url.includes('/negotiate')) {
        return Response.json({ connectionId: 'local-id', connectionToken: 'opaque-conn-id' })
      }
      if (url.includes('/ticket')) return Response.json({ ticket: TICKET })
      throw new Error('Unexpected REST endpoint for realtime host')
    },
    createSocket: url => {
      const socket = new FakeSocket(url)
      this.sockets.push(socket)
      return socket
    },
    online: () => this.online,
    pageVisible: () => this.visible,
    schedule: this.clock.schedule,
    cancel: this.clock.cancel,
    random: () => 0.5,
    onState: state => this.states.push(state),
  }
  manager = new RealtimeManager(this.runtime)
  async start(user = USER_A) {
    await this.manager.start(user, async () => this.bearer)
    await settle()
  }
  latestSocket() {
    const socket = this.sockets.at(-1)
    assert.ok(socket)
    return socket
  }
  event(version: number, eventId = crypto.randomUUID()): RealtimeInvalidation {
    return {
      eventId, eventType: 'crm.account.updated.v1', aggregateType: 'account',
      aggregateId: ID, aggregateVersion: version,
      occurredAtUtc: new Date().toISOString(),
    }
  }
  bind(dirty: () => boolean = () => false, hooks?: {
    conflicts?: number[]
    applied?: number[]
  }) {
    const data = hooks ?? {}
    data.conflicts ??= []
    data.applied ??= []
    const unsubscribe = this.manager.subscribe({
      kind: 'crm.account', id: ID, dirty,
      fetchSnapshot: async () => {
        this.restFetches++
        return { value: this.restVersion, version: this.restVersion }
      },
      applySnapshot: snapshot => { data.applied?.push(snapshot.value) },
      onConflict: () => { data.conflicts?.push(this.restVersion) },
    })
    return { unsubscribe, hooks: data }
  }
}

test('F4: one logical WebSocket per browser instance and no JWT in WSS URL', async () => {
  const host = new FakeHost()
  await Promise.all(Array.from({ length: 25 }, () => host.start()))
  assert.equal(host.sockets.length, 1)
  assert.equal(host.manager.socketCount, 1)
  assert.equal(host.manager.status, 'connected')
  assert.ok(host.latestSocket().url.startsWith('wss://gateway.example/api/notifications/hub?'))
  assert.ok(!host.latestSocket().url.includes(host.bearer))
  assert.ok(!host.latestSocket().url.includes('access_token'))
  assert.equal(new URL(host.latestSocket().url).searchParams.get('ticket'), TICKET)
  assert.ok(host.requests.every(request => request.bearer === 'Bearer ' + host.bearer))
  host.manager.stop()
  assert.equal(host.manager.socketCount, 0)
})

test('F4 gate: 100 mount/unmount cycles leave zero observers and no new sockets', async () => {
  const host = new FakeHost()
  await host.start()
  for (let i = 0; i < 100; i++) {
    const { unsubscribe } = host.bind()
    await settle()
    assert.equal(host.manager.activeWatchers, 1)
    unsubscribe()
    assert.equal(host.manager.activeWatchers, 0)
  }
  assert.equal(host.sockets.length, 1)
  host.manager.stop()
  assert.equal(host.clock.callbacks.size, 0)
})

test('F4 gate: 30 unexpected socket closes reconnect and resubscribe with fresh ticket', async () => {
  const host = new FakeHost()
  await host.start()
  const { unsubscribe } = host.bind()
  for (let i = 0; i < 30; i++) {
    const previous = host.latestSocket()
    previous.close()
    assert.ok(host.manager.status === 'degraded' || host.manager.status === 'reconnecting')
    await host.clock.advanceNext()
    assert.equal(host.manager.status, 'connected')
    assert.equal(host.manager.socketCount, 1)
    assert.ok(host.latestSocket().sent.some(frame => frame.includes('"target":"SubscribeResource"')))
  }
  assert.equal(host.sockets.length, 31)
  unsubscribe()
  host.manager.stop()
})

test('F4 gate: 30 initial negotiation failures recover with jittered backoff', async () => {
  const host = new FakeHost()
  host.initialFailures = 30
  await host.start()
  assert.equal(host.manager.status, 'degraded')
  // Initial start consumes failure #1, 29 retry failures, then a successful retry.
  for (let i = 0; i < 30; i++) await host.clock.advanceNext()
  assert.equal(host.initialFailures, 0)
  assert.equal(host.manager.status, 'connected')
  assert.equal(host.sockets.length, 1)
  assert.ok(host.requests.length >= 31)
  host.manager.stop()
})

test('F4: initial, duplicate, stale, gap and reconnect all reconcile via authoritative REST', async () => {
  const host = new FakeHost()
  await host.start()
  const bound = host.bind()
  await settle()
  assert.deepEqual(bound.hooks.applied, [1])
  host.restVersion = 3
  const e = host.event(3)
  host.latestSocket().emitEvent(e)
  await settle()
  assert.deepEqual(bound.hooks.applied, [1, 3])
  const queries = host.restFetches
  host.latestSocket().emitEvent(e)
  await settle()
  assert.equal(host.restFetches, queries, 'Duplicate eventId must not refetch')
  // A distinct event may have a lower process-local version hint; REST must
  // still be consulted, because event versions are not always global.
  host.latestSocket().emitEvent(host.event(2))
  await settle()
  assert.equal(host.restFetches, queries + 1)
  host.latestSocket().close()
  host.restVersion = 6
  await host.clock.advanceNext()
  assert.equal(bound.hooks.applied?.at(-1), 6)
  bound.unsubscribe()
  host.manager.stop()
})

test('F4: a dirty form never gets overwritten and raises a stable server conflict', async () => {
  const host = new FakeHost()
  await host.start()
  let dirty = false
  const bound = host.bind(() => dirty)
  await settle()
  dirty = true
  host.restVersion = 2
  const e = host.event(2)
  host.latestSocket().emitEvent(e)
  await settle()
  assert.deepEqual(bound.hooks.applied, [1])
  assert.deepEqual(bound.hooks.conflicts, [2])
  host.latestSocket().emitEvent(e)
  await settle()
  assert.deepEqual(bound.hooks.conflicts, [2])
  dirty = false
  host.manager.resume('crm.account', ID)
  await settle()
  assert.deepEqual(bound.hooks.applied, [1, 2])
  bound.unsubscribe()
  host.manager.stop()
})

test('F4: offline never writes or polls and online reconciles open views', async () => {
  const host = new FakeHost()
  await host.start()
  const bound = host.bind()
  await settle()
  const previous = host.restFetches
  host.online = false
  host.manager.networkChanged()
  assert.equal(host.manager.status, 'offline')
  assert.equal(host.manager.socketCount, 0)
  host.restVersion = 5
  host.manager.visibilityChanged()
  await settle()
  assert.equal(host.restFetches, previous)
  host.online = true
  host.manager.networkChanged()
  await settle()
  assert.equal(bound.hooks.applied?.at(-1), 5)
  bound.unsubscribe()
  host.manager.stop()
})

test('F4: tab hidden does not refresh until it becomes visible', async () => {
  const host = new FakeHost()
  await host.start()
  const bound = host.bind()
  await settle()
  host.visible = false
  host.manager.visibilityChanged()
  host.restVersion = 7
  const before = host.restFetches
  host.latestSocket().emitEvent(host.event(7))
  await settle()
  assert.equal(host.restFetches, before)
  host.visible = true
  host.manager.visibilityChanged()
  await settle()
  assert.equal(bound.hooks.applied?.at(-1), 7)
  bound.unsubscribe()
  host.manager.stop()
})

test('F4: expired token is unauthorized and cannot reconnect using previous privileges', async () => {
  const host = new FakeHost()
  host.expired = true
  await host.start()
  assert.equal(host.manager.status, 'unauthorized')
  assert.equal(host.sockets.length, 0)
  assert.equal(host.clock.callbacks.size, 0)
  host.expired = false
  await host.start(USER_B)
  assert.equal(host.manager.currentIdentity, USER_B)
  assert.equal(host.manager.status, 'connected')
  host.manager.stop()
})

test('F4: logout and switch identity clear old resources and detach old sockets', async () => {
  const host = new FakeHost()
  await host.start(USER_A)
  host.bind()
  await settle()
  assert.equal(host.manager.activeWatchers, 1)
  await host.start(USER_B)
  assert.equal(host.manager.currentIdentity, USER_B)
  assert.equal(host.manager.activeWatchers, 0)
  assert.equal(host.manager.socketCount, 1)
  host.manager.stop()
  assert.equal(host.manager.currentIdentity, null)
  assert.equal(host.manager.activeWatchers, 0)
  assert.equal(host.clock.callbacks.size, 0)
})


test('F4: an invalidation arriving during slow REST is replayed after the old snapshot completes', async () => {
  const host = new FakeHost()
  await host.start()
  let firstComplete: ((value: { value: number; version: number }) => void) | undefined
  let requests = 0
  const applied: number[] = []
  const unsubscribe = host.manager.subscribe({
    kind: 'crm.account',
    id: ID,
    fetchSnapshot: async () => {
      requests++
      if (requests === 1) return await new Promise<{ value: number; version: number }>(
        resolve => { firstComplete = resolve })
      return { value: 2, version: 2 }
    },
    applySnapshot: snapshot => { applied.push(snapshot.value) },
  })
  await settle()
  host.latestSocket().emitEvent(host.event(2))
  await settle()
  assert.equal(requests, 1, 'Two concurrent GETs were issued for the same observer.')
  assert.ok(firstComplete, 'First snapshot is pending.')
  firstComplete({ value: 1, version: 1 })
  await settle()
  assert.deepEqual(applied, [1, 2], 'Newer event was lost while REST GET was pending.')
  assert.equal(requests, 2)
  unsubscribe()
  host.manager.stop()
})

test('F4: invalid client resource identifier cannot become a subscription', async () => {
  const host = new FakeHost()
  await host.start()
  assert.throws(() => host.manager.subscribe({
    kind: 'crm.account', id: 'not-a-guid',
    fetchSnapshot: async () => ({ value: null, version: 1 }),
    applySnapshot: () => {},
  }))
  assert.equal(host.manager.activeWatchers, 0)
  host.manager.stop()
})

test('F6: resource revocation immediately clears only the denied account without REST refresh', async () => {
  const host = new FakeHost()
  await host.start()
  let denied = 0
  const applied: number[] = []
  const unsubscribe = host.manager.subscribe({
    kind: 'crm.account', id: ID,
    fetchSnapshot: async () => ({ value: host.restVersion, version: host.restVersion }),
    applySnapshot: snapshot => applied.push(snapshot.value as number),
    onDenied: () => { denied++ },
  })
  await settle()
  const previous = applied.length
  host.latestSocket().emitRevoked('pricing.rate', ID)
  host.latestSocket().emitRevoked('crm.account', '00000000-0000-0000-0000-000000000000')
  host.latestSocket().emitRevoked('crm.account', ID)
  assert.equal(denied, 1)
  host.restVersion = 2
  host.latestSocket().emitEvent(host.event(2))
  await settle()
  assert.equal(applied.length, previous, 'Revoked resource must not be repopulated by stale events.')
  unsubscribe()
  host.manager.stop()
})


test('F6 coverage: all 27 supported resource kinds trigger owner REST refresh and scoped revocation', async () => {
  const host = new FakeHost()
  await host.start()
  const applied = new Map<string, number>()
  const denied = new Map<string, number>()
  const subscriptions = REALTIME_RESOURCE_KINDS.map(kind => host.manager.subscribe({
    kind, id: ID,
    fetchSnapshot: async () => ({ value: kind, version: null }),
    applySnapshot: () => applied.set(kind, (applied.get(kind) ?? 0) + 1),
    onDenied: () => denied.set(kind, (denied.get(kind) ?? 0) + 1),
  }))
  await settle()
  assert.equal(REALTIME_RESOURCE_KINDS.length, 27)
  for (const kind of REALTIME_RESOURCE_KINDS) {
    assert.equal(applied.get(kind), 1, kind + ' initial REST')
    host.latestSocket().emitEvent({
      ...host.event(2), eventType: kind + '.changed.v1',
      aggregateType: kind.slice(kind.indexOf('.') + 1),
    })
    await settle()
  }
  for (const kind of REALTIME_RESOURCE_KINDS)
    assert.equal(applied.get(kind), 2, kind + ' targeted realtime REST refresh')
  host.latestSocket().emitRevoked('ai.emailjob', ID)
  assert.equal(denied.get('ai.emailjob'), 1)
  assert.equal(denied.get('crm.account') ?? 0, 0)
  host.latestSocket().emitEvent({
    ...host.event(3), eventType: 'ai.emailjob.changed.v1', aggregateType: 'emailjob',
  })
  await settle()
  assert.equal(applied.get('ai.emailjob'), 2, 'Revoked resource must remain cleared')
  // A domain event cannot be redirected to a different resource sharing an aggregate ID.
  host.latestSocket().emitEvent({
    ...host.event(4), eventType: 'auth.user.changed.v1', aggregateType: 'emailjob',
  })
  await settle()
  assert.equal(applied.get('auth.user'), 2, 'Cross-domain aggregate type rejected')
  subscriptions.forEach(unsubscribe => unsubscribe())
  host.manager.stop()
})

test('F7 C01 candidate: 10 browser outages retain prior snapshots and converge after recovery', async () => {
  const host = new FakeHost()
  await host.start()
  const bound = host.bind()
  await settle()
  for (let i = 0; i < 10; i++) {
    const last = bound.hooks.applied?.at(-1)
    host.online = false
    host.manager.networkChanged()
    assert.equal(host.manager.status, 'offline')
    assert.equal(host.manager.socketCount, 0)
    host.restVersion = i + 2
    await settle()
    assert.equal(bound.hooks.applied?.at(-1), last, 'No invented offline data')
    host.online = true
    host.manager.networkChanged()
    await settle()
    assert.equal(bound.hooks.applied?.at(-1), host.restVersion)
    assert.equal(host.manager.status, 'connected')
  }
  bound.unsubscribe()
  host.manager.stop()
})

test('F7 C02 candidate: 10 initial SignalR failures recover without extra logical sockets', async () => {
  for (let i = 0; i < 10; i++) {
    const host = new FakeHost()
    host.initialFailures = 1
    await host.start()
    assert.equal(host.manager.status, 'degraded')
    await host.clock.advanceNext()
    assert.equal(host.manager.status, 'connected')
    assert.equal(host.manager.socketCount, 1)
    host.manager.stop()
  }
})

test('F7 C03 candidate: 10 Hub disconnects reauthorize and reconcile active REST snapshots', async () => {
  const host = new FakeHost()
  await host.start()
  const bound = host.bind()
  await settle()
  for (let i = 0; i < 10; i++) {
    host.restVersion = i + 2
    host.latestSocket().close()
    await host.clock.advanceNext()
    assert.equal(host.manager.status, 'connected')
    assert.equal(bound.hooks.applied?.at(-1), host.restVersion)
    assert.ok(host.latestSocket().sent.some(frame => frame.includes('"target":"SubscribeResource"')))
  }
  bound.unsubscribe()
  host.manager.stop()
})

test('F7 C06 candidate: distinct reordered version hints still refresh REST, duplicates do not', async () => {
  const host = new FakeHost()
  host.restVersion = 50
  await host.start()
  const bound = host.bind()
  await settle()
  host.restVersion = 51
  const event = host.event(1, crypto.randomUUID()) // 1 < last authoritative REST version 50
  host.latestSocket().emitEvent(event)
  await settle()
  assert.equal(bound.hooks.applied?.at(-1), 51)
  const queries = host.restFetches
  host.latestSocket().emitEvent(event)
  await settle()
  assert.equal(host.restFetches, queries, 'Exactly-once UI invalidation by eventId')
  for (const versionHint of [8, 5, 3]) {
    host.restVersion++
    host.latestSocket().emitEvent(host.event(versionHint))
    await settle()
    assert.equal(bound.hooks.applied?.at(-1), host.restVersion)
  }
  bound.unsubscribe()
  host.manager.stop()
})

test('F7 C07 candidate: expired authentication immediately purges authorized view', async () => {
  const host = new FakeHost()
  await host.start()
  let denied = 0
  let applied = 0
  host.manager.subscribe({
    kind: 'crm.account', id: ID,
    fetchSnapshot: async () => ({ value: host.restVersion, version: host.restVersion }),
    applySnapshot: () => { applied++ },
    onDenied: () => { denied++ },
  })
  await settle()
  assert.equal(applied, 1)
  host.expired = true
  host.manager.refreshAuthentication()
  await settle()
  assert.equal(host.manager.status, 'unauthorized')
  assert.equal(denied, 1)
  assert.equal(host.manager.socketCount, 0)
  assert.equal(host.clock.callbacks.size, 0)
  host.manager.stop()
  assert.equal(denied, 1, 'No duplicate purge callbacks')
})

test('F7 C09 candidate: 10 sleeping tabs reconcile their snapshots on wake-up', async () => {
  const host = new FakeHost()
  await host.start()
  const bound = host.bind()
  await settle()
  for (let i = 0; i < 10; i++) {
    host.visible = false
    host.manager.visibilityChanged()
    const previous = host.restFetches
    host.restVersion++
    host.latestSocket().emitEvent(host.event(i + 2))
    await settle()
    assert.equal(host.restFetches, previous)
    host.visible = true
    host.manager.visibilityChanged()
    await settle()
    assert.equal(bound.hooks.applied?.at(-1), host.restVersion)
  }
  bound.unsubscribe()
  host.manager.stop()
})

test('F7 C10 candidate: REST outage with WS connected keeps last confirmed snapshot', async () => {
  const host = new FakeHost()
  await host.start()
  let restDown = false
  const applied: number[] = []
  const errors: unknown[] = []
  const unsubscribe = host.manager.subscribe({
    kind: 'crm.account', id: ID,
    fetchSnapshot: async () => {
      if (restDown) throw new Error('503 REST unavailable')
      return { value: host.restVersion, version: host.restVersion }
    },
    applySnapshot: snapshot => applied.push(snapshot.value),
    onError: error => errors.push(error),
  })
  await settle()
  restDown = true
  host.restVersion = 2
  host.latestSocket().emitEvent(host.event(2))
  await settle()
  assert.deepEqual(applied, [1])
  assert.equal(errors.length, 1)
  assert.equal(host.manager.status, 'connected')
  restDown = false
  host.manager.resume('crm.account', ID)
  await settle()
  assert.deepEqual(applied, [1, 2])
  unsubscribe()
  host.manager.stop()
})

test('F7 C12 candidate: logout clears authorized snapshots, sockets, listeners and timers', async () => {
  const host = new FakeHost()
  await host.start()
  let purged = 0
  host.manager.subscribe({
    kind: 'crm.account', id: ID,
    fetchSnapshot: async () => ({ value: host.restVersion, version: host.restVersion }),
    applySnapshot: () => {},
    onDenied: () => { purged++ },
  })
  await settle()
  host.manager.stop()
  assert.equal(purged, 1)
  assert.equal(host.manager.activeWatchers, 0)
  assert.equal(host.manager.socketCount, 0)
  assert.equal(host.clock.callbacks.size, 0)
  assert.equal(host.manager.currentIdentity, null)
})

for (const dirty of [false, true]) {
  test(`F7 C07: an in-flight GET cannot restore revoked data (dirty=${dirty})`, async () => {
    const host = new FakeHost()
    await host.start()
    let finish!: (value: { value: string; version: number }) => void
    const delayed = new Promise<{ value: string; version: number }>(resolve => { finish = resolve })
    let applied = 0
    let conflicts = 0
    let denied = 0
    host.manager.subscribe({
      kind: 'crm.account', id: ID, dirty: () => dirty,
      fetchSnapshot: () => delayed,
      applySnapshot: () => { applied++ },
      onConflict: () => { conflicts++ },
      onDenied: () => { denied++ },
    })
    host.latestSocket().emitRevoked('crm.account', ID)
    finish({ value: 'private-data', version: 2 })
    await settle()
    assert.equal(denied, 1)
    assert.equal(applied, 0)
    assert.equal(conflicts, 0)
    host.manager.stop()
  })
}

test('catalog and CRM/Pricing list changes refresh a second connected user without new sockets', async () => {
  const hostA = new FakeHost()
  const hostB = new FakeHost()
  await Promise.all([hostA.start(), hostB.start(USER_B)])
  const collections = [
    ['config.catalog-list', '00000000-0000-4000-8000-000000000042'],
    ['pricing.cost-list', '00000000-0000-4000-8000-000000000043'],
    ['pricing.rate-list', '00000000-0000-4000-8000-000000000044'],
    ['crm.accountlist', '00000000-0000-4000-8000-000000000045'],
    ['crm.leadlist', '00000000-0000-4000-8000-000000000046'],
  ] as const
  const notifications: string[] = []
  const dispose = collections.map(([kind, id]) => hostB.manager.subscribe({
    kind, id,
    fetchSnapshot: async () => ({ value: kind, version: null }),
    applySnapshot: (_snapshot, reason) => notifications.push(kind + ':' + reason),
  }))
  await settle()
  assert.equal(hostB.sockets.length, 1)
  for (const [kind, id] of collections) {
    hostB.latestSocket().emitEvent({
      eventId: crypto.randomUUID(),
      eventType: kind + '.changed.v1',
      aggregateType: kind.slice(kind.indexOf('.') + 1),
      aggregateId: id,
      aggregateVersion: 10,
      occurredAtUtc: new Date().toISOString(),
    })
  }
  await settle()
  for (const [kind] of collections)
    assert.ok(notifications.includes(kind + ':event'), kind + ' never refreshed')
  assert.equal(hostB.sockets.length, 1, 'collection topics must multiplex one hub socket')
  assert.equal(hostA.sockets.length, 1)
  dispose.forEach(fn => fn())
  hostA.manager.stop()
  hostB.manager.stop()
})

test('F4: connected SignalR still reconciles via REST when a change event is missed', async () => {
  const host = new FakeHost()
  await host.start()
  const { unsubscribe, hooks } = host.bind()
  await settle()
  assert.equal(host.manager.status, 'connected')
  const before = host.restFetches
  host.restVersion = 9 // Simulate changed Config owner data with a dropped stream event.
  assert.ok(host.clock.callbacks.size > 0, 'Connected subscriptions must maintain a fallback poll')
  await host.clock.advanceNext()
  assert.equal(host.restFetches, before + 1)
  assert.equal(hooks.applied?.at(-1), 9)
  unsubscribe()
  host.manager.stop()
  assert.equal(host.clock.callbacks.size, 0)
})
