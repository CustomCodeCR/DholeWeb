import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const view = readFileSync(new URL('../src/modules/integrations/views/ThirdPartyApisView.vue', import.meta.url), 'utf8')
test('existing mappings keep defaults after selecting fields again', () => {
  assert.match(view, /mapSelected\(inputCatalog\.value, selected, draft\.value\.inputs\)/)
  assert.match(view, /existing\?\.defaultValue !== undefined/)
})
test('external examples and tests omit fixed data', () => {
  assert.match(view, /const exposedInputs = draft\.value\.inputs\.filter\(f => f\.defaultValue === undefined\)/)
  assert.match(view, /f\.required && f\.defaultValue === undefined/)
  assert.match(view, /f\.public === name && f\.defaultValue === undefined/)
})
test('CRM client selection requires confirmed executive', () => {
  assert.match(view, /assigned-executives\?ids=/)
  assert.match(view, /setFixedInternal\('clientName'/)
  assert.match(view, /setFixedInternal\('sellerUserId'/)
  assert.match(view, /setFixedInternal\('executiveName'/)
})
