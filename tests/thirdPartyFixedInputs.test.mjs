import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const view = readFileSync(new URL('../src/modules/integrations/views/ThirdPartyApisView.vue', import.meta.url), 'utf8')

test('API endpoint contracts use the existing server-owned defaults object', () => {
  assert.match(view, /defaults\?: Record<string, unknown>/)
  assert.match(view, /setLockedDefault\('clientName', account\.displayName\)/)
  assert.match(view, /setLockedDefault\('sellerUserId', account\.executiveUserId\)/)
  assert.match(view, /setLockedDefault\('executiveName', assignment\.displayName\)/)
  assert.match(view, /draft\.value\.inputs = draft\.value\.inputs\.filter\(f => f\.internal !== internal\)/)
})

test('corporate CRM accounts do not invent a seller UUID', () => {
  assert.match(view, /if \(account\.isCastroFallasExecutive\)/)
  assert.match(view, /setLockedDefault\('executiveName', 'Castro Fallas'\)/)
  assert.match(view, /removeDefault\('sellerUserId'\)/)
})

test('existing route selection automatically discovers deployed routes', () => {
  assert.match(view, /void discoverService\(service\.value\)/)
  assert.match(view, /root \+ '\/discover\/'/)
})
