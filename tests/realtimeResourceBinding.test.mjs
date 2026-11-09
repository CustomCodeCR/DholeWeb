import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerHooks } from 'node:module'
import { effectScope, nextTick, ref } from 'vue'

// Only the browser singleton is replaced: the real Vue composable runs with
// its existing injected transport, without starting a live SignalR connection.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/core/realtime/universalRealtime') {
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
        'export const subscribeUniversalRealtime = () => { throw Error("Unexpected live transport") };' +
        'export const universalRealtimeManager = { resume() { throw Error("Unexpected live transport") } };') }
    }
    if (specifier.startsWith('@/')) return nextResolve(new URL('../src/' + specifier.slice(2) + '.ts', import.meta.url).href, context)
    return nextResolve(specifier, context)
  },
})
const { useResourceRealtime } = await import('../src/core/realtime/useResourceRealtime.ts')
hooks.deregister()

function fixture() {
  const scope = effectScope()
  const id = ref('aaaaaaaa-1111-4111-8111-111111111111')
  const observers = []
  const applied = []
  let denied = 0
  let binding
  scope.run(() => {
    binding = useResourceRealtime({
      kind: 'crm.account', id, dirty: () => true,
      fetchSnapshot: async () => ({ version: 1, value: { privateData: 'customer' } }),
      applySnapshot: value => applied.push(value),
      onDenied: () => { denied++; assert.equal(binding.conflictSnapshot.value, null) },
      transport: { subscribe: observer => { observers.push(observer); return () => {} }, resume() {} },
    })
  })
  return { scope, id, observers, applied, binding, denied: () => denied }
}

test('revocation clears the retained conflict snapshot before notifying the view', () => {
  const f = fixture()
  try {
    f.observers[0].onConflict({ version: 2, value: { privateData: 'customer' } }, null)
    assert.equal(f.binding.conflict.value, true)
    f.observers[0].onDenied()
    assert.equal(f.binding.conflict.value, false)
    assert.equal(f.binding.conflictSnapshot.value, null)
    assert.equal(f.denied(), 1)
  } finally { f.scope.stop() }
})

test('callbacks from an earlier subscription cannot affect a revisited resource', async () => {
  const f = fixture()
  try {
    const original = f.id.value
    const old = f.observers[0]
    f.id.value = 'bbbbbbbb-2222-4222-8222-222222222222'
    await nextTick()
    f.id.value = original
    await nextTick()
    old.applySnapshot({ version: 3, value: { privateData: 'stale' } })
    old.onConflict({ version: 4, value: { privateData: 'stale' } }, null)
    old.onDenied()
    assert.deepEqual(f.applied, [])
    assert.equal(f.binding.conflict.value, false)
    assert.equal(f.binding.conflictSnapshot.value, null)
    assert.equal(f.denied(), 0)
    f.observers[2].applySnapshot({ version: 5, value: { privateData: 'current' } })
    assert.equal(f.applied.length, 1)
  } finally { f.scope.stop() }
})

test('scope disposal clears retained conflicts and rejects late callbacks', () => {
  const f = fixture()
  f.observers[0].onConflict({ version: 2, value: { privateData: 'customer' } }, null)
  f.scope.stop()
  f.observers[0].applySnapshot({ version: 3, value: { privateData: 'late' } })
  f.observers[0].onConflict({ version: 4, value: { privateData: 'late' } }, null)
  assert.equal(f.binding.conflict.value, false)
  assert.equal(f.binding.conflictSnapshot.value, null)
  assert.deepEqual(f.applied, [])
})

test('revoked subscription rejects callbacks that arrive after denial', () => {
  const f = fixture()
  try {
    const observer = f.observers[0]
    observer.onDenied()
    observer.onConflict({ version: 2, value: { privateData: 'late' } }, null)
    observer.applySnapshot({ version: 3, value: { privateData: 'late' } })
    assert.equal(f.binding.conflict.value, false)
    assert.equal(f.binding.conflictSnapshot.value, null)
    assert.deepEqual(f.applied, [])
  } finally { f.scope.stop() }
})
