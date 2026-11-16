import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/modules/integrations/views/ThirdPartyApisView.vue', import.meta.url), 'utf8')
test('POST and PUT preset fields cannot be overridden by public inputs', () => {
  assert.match(source, /defaults\?: Record<string, unknown>/)
  assert.match(source, /entries\[internal\] = value/)
  assert.match(source, /draft\.value\.inputs = draft\.value\.inputs\.filter\(f => f\.internal !== internal\)/)
  assert.match(source, /method !== 'GET'/)
})
test('CRM provides customer, seller and executive for rate requests', () => {
  assert.match(source, /\/api\/crm\/pricing-client-options\?/)
  assert.match(source, /setLockedDefault\('clientName', record\.displayName\)/)
  assert.match(source, /setLockedDefault\('sellerUserId', record\.executiveUserId\)/)
  assert.match(source, /setLockedDefault\('executiveName', executiveName\)/)
})
