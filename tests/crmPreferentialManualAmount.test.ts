import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseManualPreferentialAmount } from '../src/modules/crm/utils/crmPreferentialManualAmount'

test('Manual preferential rate handles Vue numeric v-model values', () => {
  assert.equal(parseManualPreferentialAmount(175), 175)
  assert.equal(parseManualPreferentialAmount('175'), 175)
  assert.equal(parseManualPreferentialAmount(0), 0)
  assert.equal(parseManualPreferentialAmount('0'), 0)
  assert.equal(parseManualPreferentialAmount(' 175.25 '), 175.25)
})
test('Manual preferential rate never accepts blank or invalid values', () => {
  for (const value of ['', ' ', null, undefined, -1, '-1', NaN, Infinity, 1000000000000, 'foo']) {
    assert.equal(parseManualPreferentialAmount(value), null, String(value))
  }
})
test('Manual preferentials use normalized numeric input and never silently block submit', () => {
  const vue = readFileSync('src/modules/crm/components/CrmPreferentialRouteBuilder.vue', 'utf8')
  assert.ok(vue.includes('parseManualPreferentialAmount(manual.amount)'))
  assert.ok(vue.includes('if (value === null)'))
  assert.doesNotMatch(vue, /manual\.amount\.trim\(/)
  assert.match(vue, /aria-label="Agregar cargo manual preferencial" novalidate @submit\.prevent="saveManual"/)
  assert.ok(vue.includes("rateType: 'FIXED_AMOUNT', value"))
  assert.ok(vue.includes("data-crm-saved-manual-rates"))
})
