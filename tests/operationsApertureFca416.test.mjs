import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
test('New manual opening uses WHS for consolidated cargo; historical edits retain FCA rule', () => {
  assert.ok(opening.includes("editingId.value ? selectedIncoterm.value === 'FCA' : ['LCL', 'LTL'].includes(effectiveShipment.value)"))
  assert.ok(opening.includes('label="WHS global"'))
  assert.ok(opening.includes('label="Dirección del WHS"'))
  assert.ok(opening.includes('if (requiresWarehouse.value && !(warehouse.value'))
})
test('EXW and inland stops share Pricing location component; contact and window are not opening fields', () => {
  assert.ok(opening.includes('PricingInlandServiceLocation'))
  assert.ok(opening.includes('v-model:locations="form.pickupLocations"'))
  assert.ok(opening.includes('v-model:locations="form.deliveryLocations"'))
  for (const field of ['pickupContact', 'pickupWindow']) {
    assert.ok(!opening.includes('v-model="form.' + field + '"'))
    assert.ok(!opening.includes('!form.value.' + field + '.trim()'))
  }
})
