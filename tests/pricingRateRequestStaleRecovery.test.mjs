import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('../src/modules/pricing/services/rateRequestLeaseService.ts', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/modules/pricing/components/PricingRateRequestsPanel.vue', import.meta.url), 'utf8')

test('owner release never reclaims before releasing', () => {
  const own = service.slice(service.indexOf('async releaseOwn('), service.indexOf('async releaseStale('))
  assert.match(own, /path\(id, 'release-own'\)/)
  assert.doesNotMatch(own, /this\.claim\(|this\.release\(/)
  assert.match(own, /sessionStorage\.removeItem\(key\(id\)\)/)
})

test('stale release is an explicit user action and no healthy lock can be released', () => {
  assert.match(service, /path\(id, 'release-stale'\)/)
  assert.match(panel, /return isLocked\(request\) && !isOwnLock\(request\)/)
  assert.match(panel, /getTime\(\) <= now\.value \+ 75000/)
  assert.match(panel, /v-if="isStaleLock\(request\)"/)
  assert.match(panel, /@click="releaseStaleRequest\(request\)"/)
})

test('stale release refreshes authoritative API state', () => {
  const action = panel.slice(panel.indexOf('async function releaseStaleRequest'), panel.indexOf('async function continueRequest'))
  assert.match(action, /await RateRequestLeaseService\.releaseStale\(request\.id\)/)
  assert.match(action, /await load\(\)/)
})
