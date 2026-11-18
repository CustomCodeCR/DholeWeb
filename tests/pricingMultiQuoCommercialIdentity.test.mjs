import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const search = readFileSync(new URL('../src/core/services/globalSearchService.ts', import.meta.url), 'utf8')
const rates = readFileSync(new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url), 'utf8')
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('global search shows the one base quotation while preserving individual options internally', () => {
  assert.match(search, /PricingService\.browseRates\(\{ \.\.\.page, groupQuotes: true \}\)/)
  assert.match(search, /title: rate\.groupQuoteNumber \|\| rate\.quoNumber \|\| rate\.rateCode/)
  assert.doesNotMatch(search, /title: rate\.rateCode \|\| rate\.rateName/)
  assert.match(search, /rate\.quoNumber \? undefined : rate\.rateCode/)
})

test('commercial list displays base QUO instead of separately numbered A and B', () => {
  assert.match(rates, /return rate\.groupQuoteNumber \|\| rate\.quoNumber \|\| rate\.rateCode/)
  assert.match(rates, /groupQuotes: true/)
})

test('wizard has one parent quotation, internal selectable A/B options and only one acceptance', () => {
  assert.match(wizard, /commercialGroupNumber = computed/)
  assert.match(wizard, /<DhBadge :label="commercialGroupNumber"/)
  assert.match(wizard, /commercialGroupRateDisplayName\(editingRate\)/)
  assert.match(wizard, /savedQuoteGroup\.parentQuoteNumber/)
  assert.match(wizard, /selectedSavedGroupAlternative\?\.quoteNumber/)
  assert.match(wizard, /option\.quoteNumber === `\$\{refreshed\.parentQuoteNumber\}-\$\{option\.suffix\}`/)
  assert.match(wizard, /acceptedSavedGroup && option\.rateId !== savedQuoteGroup\?\.selectedRateId/)
  assert.match(wizard, /Opción no elegida · Historial de la misma QUO/)
  assert.doesNotMatch(wizard, /subQUO independientes/)
})
