import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
test('FCA always requires Pricing WHS or address fallback, regardless of collection', () => {
  assert.match(opening, /const requiresWarehouse = computed\(\(\) => selectedIncoterm\.value === 'FCA'\)/)
  assert.ok(opening.includes('label="WHS global"'))
  assert.ok(opening.includes('label="Dirección del WHS"'))
  assert.ok(opening.includes('if (requiresWarehouse.value && !(warehouse.value'))
})
test('EXW and inland stops share Pricing location component; contact and window stay in Operations', () => {
  assert.ok(opening.includes('PricingInlandServiceLocation'))
  assert.ok(opening.includes('v-model:locations="form.pickupLocations"'))
  assert.ok(opening.includes('v-model:locations="form.deliveryLocations"'))
  for (const field of ['pickupContact', 'pickupWindow']) {
    assert.ok(opening.includes('v-model="form.' + field + '"'))
    assert.ok(opening.includes('!form.value.' + field + '.trim()'))
  }
})
