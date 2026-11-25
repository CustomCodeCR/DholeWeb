import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')

test('FCA demands warehouse for FCL, FTL, LCL and LTL alike', () => {
  assert.match(opening, /const requiresWarehouse = computed\(\(\) => selectedIncoterm\.value === 'FCA'\)/)
  assert.match(opening, /requiresWarehouse\.value && !form\.value\.whsName\.trim\(\)/)
  assert.match(opening, /Nombre WHS \(FCA\)/)
  assert.match(opening, /v-if="requiresWarehouse"/)
  assert.doesNotMatch(opening, /Nombre WHS \(FCA \+ LCL\/LTL\)/)
})

test('Incoterm resolution uses Pricing and pickup capture requires real data', () => {
  assert.match(opening, /normalizeIncotermCode/)
  assert.match(opening, /selectedIncoterm\.value/)
  assert.match(opening, /form\.value\.requiresPickup/)
  for (const field of ['pickupAddress', 'pickupContact', 'pickupWindow']) {
    assert.ok(opening.includes('v-model="form.' + field + '"'))
    assert.ok(opening.includes('!form.value.' + field + '.trim()'))
  }
})
