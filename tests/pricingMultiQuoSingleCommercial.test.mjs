import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const load = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const rates = load('../src/modules/pricing/views/PricingRatesView.vue')
const wizard = load('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const sellerModal = load('../src/modules/dashboard/components/SellerRateDecisionModal.vue')
const search = load('../src/core/services/globalSearchService.ts')

test('commercial list and global search show one parent QUO, not alternative A/B rows', () => {
  assert.match(rates, /return rate\.groupQuoteNumber \|\| rate\.quoNumber \|\| rate\.rateCode/)
  assert.match(rates, /groupQuotes: true/)
  assert.match(search, /groupQuotes: true/)
})

test('wizard accepts a selected internal suboption and labels the other unselected', () => {
  assert.match(wizard, /Cotización \{\{ savedQuoteGroup\.parentQuoteNumber \}\}/)
  assert.match(wizard, /Aceptar esta opción/)
  assert.match(wizard, /groupedAcceptanceRateId/)
  assert.match(wizard, /PricingService\.selectRateGroup\(rateId\)/)
  assert.match(wizard, /status: 'AcceptedByClient'/)
  assert.match(wizard, /No seleccionada · Alternativa del mismo grupo/)
  assert.match(wizard, /groupedRateDisplayName\(editingRate\)/)
})

test('seller must choose one option of the group before accepting', () => {
  assert.match(sellerModal, /selectedOptionId/)
  assert.match(sellerModal, /quoteOptionRequired/)
  assert.match(sellerModal, /group-select/)
  assert.match(sellerModal, /encodeURIComponent\(chosenRateId\)/)
  assert.match(sellerModal, /La otra opción no se registrará como rechazada/)
})
