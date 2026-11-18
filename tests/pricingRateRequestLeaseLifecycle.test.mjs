import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const resume = readFileSync(new URL('../src/modules/pricing/views/PricingRateRequestResumeView.vue', import.meta.url), 'utf8')

test('late heartbeat cannot reclaim after request close', () => {
  const renew = resume.slice(resume.indexOf('async function renewLease'), resume.indexOf('function renewOnFocus'))
  const guard = renew.indexOf('if (version !== generation || currentId !== id || !ready.value) return')
  const retry = renew.indexOf('await RateRequestLeaseService.claim(id)')
  assert.ok(guard >= 0 && guard < retry, 'generation must be checked before any fallback claim')
  assert.match(renew, /heartbeatInFlight = renewal/)
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
