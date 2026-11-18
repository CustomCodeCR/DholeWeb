import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const search = readFileSync(new URL('../src/core/services/globalSearchService.ts', import.meta.url), 'utf8')
const rates = readFileSync(new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url), 'utf8')
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('global search uses commercial QUO, not historical per-child consecutive', () => {
  assert.match(search, /PricingService\.browseRates\(\{ \.\.\.page, groupQuotes: true \}\)/)
  assert.match(search, /title: rate\.groupQuoteNumber \|\| rate\.quoNumber \|\| rate\.rateCode/)
  assert.doesNotMatch(search, /title: rate\.rateCode \|\| rate\.rateName/)
  assert.match(search, /rate\.quoNumber \? undefined : rate\.rateCode/)
})

test('rate listings and saved wizard keep A/B commercial suffix after selection', () => {
  assert.match(rates, /rate\.quoNumber \|\| rate\.groupQuoteNumber \|\| rate\.rateCode/)
  assert.match(wizard, /Alternativa seleccionada: \{\{ primarySavedGroupAlternative\?\.quoteNumber/)
  assert.doesNotMatch(wizard, /Principal: \{\{ primarySavedGroupAlternative\?\.quoteNumber/)
})
