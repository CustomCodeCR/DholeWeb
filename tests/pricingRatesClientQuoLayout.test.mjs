import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url), 'utf8')

test('the QUO and client header is present on desktop and mobile', () => {
  assert.equal((source.match(/data-rate-quo-client/g) || []).length, 2)
  assert.equal((source.match(/data-rate-client/g) || []).length, 2)
  assert.equal((source.match(/row.clientName \|\|/g) || []).length, 2)
})

test('desktop columns expand without removing revision or IDTRA', () => {
  assert.match(source, /min-w-\[1900px\]/)
  assert.match(source, /w-\[450px\]/)
  assert.ok((source.match(/row.revisionNumber \|\| 1/g) || []).length >= 2)
  assert.match(source, /acceptedRateMissingIdtra\(row\)/)
})
