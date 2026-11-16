import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/modules/integrations/views/ThirdPartyApisView.vue', import.meta.url), 'utf8')
test('picker uses authorized combined accounts and leads directory', () => {
  assert.match(source, /\/api\/crm\/pricing-client-options\?/)
  assert.match(source, /mode: 'create'/)
  assert.match(source, /kind: 'account' \| 'lead'/)
  assert.match(source, /account\.kind === 'lead' \? 'Prospecto' : 'Cliente'/)
  assert.doesNotMatch(source, /\/api\/crm\/accounts\?q=/)
})
test('institutional commercial executive does not get CRM creator as Auth seller', () => {
  assert.match(source, /record\.isCastroFallasExecutive/)
  assert.match(source, /\? 'Castro Fallas' : record\.executiveName/)
  assert.match(source, /removeDefault\('sellerUserId'\)/)
  assert.match(source, /draft\.value\.inputs = draft\.value\.inputs\.filter\(f => f\.internal !== 'sellerUserId'\)/)
  assert.match(source, /setLockedDefault\('executiveName', executiveName\)/)
})
test('selection is revalidated against CRM before locking the defaults', () => {
  assert.match(source, /selectedClientId: id/)
  assert.match(source, /result\.items\.find\(a => a\.id === id && a\.kind === kind\)/)
})
