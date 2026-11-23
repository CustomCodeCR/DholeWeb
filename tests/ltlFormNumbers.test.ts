import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { hasLtlNumericValue, ltlNumberOrNull } from '../src/modules/pricing/utils/ltlFormNumbers.ts'

test('Vue native number v-model numeric values reach the LTL POST payload safely', () => {
  assert.equal(ltlNumberOrNull(42.67), 42.67)
  assert.equal(ltlNumberOrNull(50), 50)
  assert.equal(ltlNumberOrNull(0), 0)
  assert.equal(ltlNumberOrNull('42.67'), 42.67)
  assert.equal(ltlNumberOrNull(' 333.33 '), 333.33)
  assert.equal(ltlNumberOrNull(''), null)
  assert.equal(ltlNumberOrNull(null), null)
  assert.ok(Number.isNaN(ltlNumberOrNull('invalid')))
  assert.ok(Number.isNaN(ltlNumberOrNull(Infinity)))
})

test('variable charges edited in native number inputs do not throw on .trim()', () => {
  for (const value of [0, 20, 1.5, '0', '20', ' 12.3 ']) {
    assert.equal(hasLtlNumericValue(value), true)
  }
  for (const value of ['', ' ', null, undefined]) {
    assert.equal(hasLtlNumericValue(value), false)
  }
})

test('LTL save uses numeric-safe functions and renders validation errors instead of silently failing', () => {
  const source = readFileSync(new URL('../src/modules/pricing/views/PricingOwnLtlView.vue', import.meta.url), 'utf8')
  assert.match(source, /ltlNumberOrNull\(form\.priceAmount\)/)
  assert.match(source, /ltlNumberOrNull\(form\.costPerCbm\)/)
  assert.match(source, /ltlNumberOrNull\(charge\.costAmount\)/)
  assert.match(source, /hasLtlNumericValue\(charge\.costAmount\)/)
  assert.match(source, /hasLtlNumericValue\(charge\.saleAmount\)/)
  assert.match(source, /try \{\s+payload = buildPayload\(\)/)
  assert.match(source, /role="alert"/)
  assert.match(source, /await FtlTariffService\.create\(payload\)/)
  assert.doesNotMatch(source, /charge\.costAmount\.trim\(/)
  assert.doesNotMatch(source, /charge\.saleAmount\.trim\(/)
})
