import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { linkedAcceptedQuoteNumber } from '../src/modules/pricing/utils/pricingLinkedAcceptedQuote.ts'

const crystal = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')
const legacy = readFileSync('src/modules/pricing/components/PricingRateExistingWizardStable.vue', 'utf8')
const uuid = '7d5a8cfc-ae2f-4a02-bb7e-358ac4f48632'

test('linked quote label prefers commercial QUO number, then valid rate code', () => {
  assert.equal(linkedAcceptedQuoteNumber({ quoNumber: 'QUO-00000-000618', rateCode: 'QUO-OLD' }), 'QUO-00000-000618')
  assert.equal(linkedAcceptedQuoteNumber({ quoNumber: null, rateCode: 'QUO-00000-000618' }), 'QUO-00000-000618')
})

test('linked quote label never displays the UUID even if the record is unavailable', () => {
  assert.equal(linkedAcceptedQuoteNumber(null), 'Número de QUO no disponible')
  assert.equal(linkedAcceptedQuoteNumber({ quoNumber: uuid, rateCode: uuid }), 'Número de QUO no disponible')
  assert.equal(linkedAcceptedQuoteNumber({ quoNumber: ' ', rateCode: uuid }), 'Número de QUO no disponible')
})

test('Crystal resolves the linked rate without changing UUID navigation and refreshes safely', () => {
  assert.match(crystal, /PricingService\.getRate\(linkedRateId\)/)
  assert.match(crystal, /accepted\.id === linkedRateId/)
  assert.match(crystal, /onCleanup\(\(\) => \{ current = false \}\)/)
  assert.match(crystal, /linkedAcceptedQuoteNumber\(linkedAcceptedQuote\)/)
  assert.match(crystal, /params: \{ rateId: editingRate\.linkedAcceptedRateId \}/)
  assert.doesNotMatch(crystal, /\{\{ editingRate\.linkedAcceptedRateId \}\}/)
})

test('previous wizard also does not fall back to the UUID in visible text', () => {
  assert.match(legacy, /linkedAcceptedQuoteNumber\(linkedAcceptedRate\)/)
  assert.doesNotMatch(legacy, /linkedAcceptedRate\?\.rateCode \|\| editingRate\.linkedAcceptedRateId/)
})
