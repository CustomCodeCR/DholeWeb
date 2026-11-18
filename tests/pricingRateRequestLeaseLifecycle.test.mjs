import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const resume = readFileSync(new URL('../src/modules/pricing/views/PricingRateRequestResumeView.vue', import.meta.url), 'utf8')

test('heartbeat never reacquires a released reservation automatically', () => {
  const renew = resume.slice(resume.indexOf('async function renewLease'), resume.indexOf('async function recoverLease'))
  assert.match(renew, /await RateRequestLeaseService\.heartbeat\(id\)/)
  assert.doesNotMatch(renew, /RateRequestLeaseService\.claim/)
  assert.match(renew, /heartbeatInFlight = renewal/)
  const recover = resume.slice(resume.indexOf('async function recoverLease'), resume.indexOf('function renewOnFocus'))
  assert.match(recover, /RateRequestLeaseService\.claim\(id, \{ recoverOwnLease: true \}\)/)
})

test('close waits for in-flight lease operations before unlocking', () => {
  const stop = resume.slice(resume.indexOf('async function stop()'), resume.indexOf('function start(id: string)'))
  assert.match(stop, /\+\+generation/)
  assert.match(stop, /window.clearInterval\(heartbeatTimer\)/)
  assert.match(stop, /pendingClaim\?\.catch/)
  assert.match(stop, /pendingHeartbeat\?\.catch/)
  assert.ok(stop.indexOf('await Promise.all(') < stop.indexOf('await RateRequestLeaseService.release(id)'))
  assert.match(resume, /onBeforeRouteLeave\(async \(\) => \{[\s\S]*?await stop\(\)/)
})

test('stale request loading cannot mount a new heartbeat', () => {
  const begin = resume.slice(resume.indexOf('async function begin(id: string)'), resume.indexOf('async function stop()'))
  const get = begin.indexOf('const response = await callEndpoint')
  const guard = begin.indexOf('if (version !== generation)', get)
  const heartbeat = begin.indexOf('window.setInterval(', get)
  assert.ok(get >= 0 && guard > get && heartbeat > guard)
})


test('explicit same-owner release is offered and account-scoped', () => {
  const service = readFileSync(new URL('../src/modules/pricing/services/rateRequestLeaseService.ts', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../src/modules/pricing/components/PricingRateRequestsPanel.vue', import.meta.url), 'utf8')
  assert.match(service, /useAuthStore\(\)\.userId/)
  assert.match(service, /async releaseOwn\(id: string\)/)
  assert.match(service, /idempotencyKey: createUuid\(\)/)
  assert.match(panel, /v-if="isOwnLock\(request\)"/)
  assert.match(panel, /Liberar mi reserva/)
})
