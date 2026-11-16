import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/modules/integrations/views/ThirdPartyApisView.vue', import.meta.url), 'utf8')

test('POST and PUT fixed fields are removed from public input', () => {
  assert.match(source, /defaults\?: Record<string, unknown>/)
  assert.match(source, /entries\[internal\] = value/)
  assert.match(source, /draft\.value\.inputs = draft\.value\.inputs\.filter\(f => f\.internal !== internal\)/)
  assert.match(source, /method !== 'GET'/)
})

test('CRM searches both clients and prospects with permission-respecting endpoints', () => {
  assert.match(source, /fetchClient<\{ items: CrmAccount\[\] \}>\('\/api\/crm\/accounts' \+ suffix/)
  assert.match(source, /fetchClient<\{ items: CrmLead\[\] \}>\('\/api\/crm\/leads' \+ suffix/)
  assert.match(source, /Promise\.allSettled/)
  assert.match(source, /lead => !lead\.convertedAt/)
  assert.match(source, /\/api\/crm\/accounts\/.*assigned-executive/)
  assert.match(source, /\/api\/crm\/leads\/assigned-executives\?ids=/)
  assert.match(source, /accountCommercialPreset\(account, assignment\)/)
  assert.match(source, /leadCommercialPreset\(lead, assignment\.sellers\?\.\[id\]\)/)
})
