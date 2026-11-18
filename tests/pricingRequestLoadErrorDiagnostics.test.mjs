import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const view = readFileSync(new URL('../src/modules/pricing/views/PricingRateRequestResumeView.vue', import.meta.url), 'utf8')

test('claim failures and request GET failures have separate stage diagnostics', () => {
  const begin = view.slice(view.indexOf('async function begin(id: string)'), view.indexOf('async function stop()'))
  assert.ok(begin.indexOf("let stage: 'claim' | 'load' = 'claim'") >= 0)
  assert.ok(begin.indexOf("stage = 'load'") > begin.indexOf('RateRequestLeaseService.claim('))
  assert.ok(begin.indexOf("stage === 'claim'") > begin.indexOf('} catch (cause)'))
  assert.match(begin, /failure\.status/)
  assert.match(begin, /failure\.data\?\.traceId/)
})

test('retry is serialized through the same beginInFlight tracker as first open', () => {
  assert.match(view, /@click="start\(requestId\)"/)
  const start = view.slice(view.indexOf('function start(id: string)'), view.indexOf('onMounted('))
  assert.match(start, /if \(beginInFlight \|\| stopInFlight\) return/)
  assert.match(start, /beginInFlight = operation/)
})
