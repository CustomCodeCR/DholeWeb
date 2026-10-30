import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('editing a quotation opens its saved revision in read-only detail instead of returning to the list', () => {
  const source = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const start = source.indexOf('async function saveRate() {')
  const end = source.indexOf('function resetWizard()', start)
  assert.ok(start >= 0 && end > start)
  const save = source.slice(start, end)
  assert.match(save, /await PricingService\.updateRate\(editingRate\.value\.id, updatePayload\)/)
  assert.match(save, /await router\.replace\(\{ name: 'pricing-rate-wizard', params: \{ rateId \}, query: \{ mode: 'view' \} \}\)/)
  assert.doesNotMatch(save, /await router\.push\(\{ name: 'pricing-rates' \}\)/)
})

test('seller modification still prepares a saved revision and requires explicit delivery', () => {
  const plugin = read('build/pricingSellerModificationWizard.ts')
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  assert.match(plugin, /RateRequestLeaseService\.prepareModification\(/)
  assert.match(plugin, /const savedRateNavigation/)
  assert.match(plugin, /name: 'pricing-rate-wizard', params: \{ rateId \}, query: \{ mode: 'view' \}/)
  assert.match(resume, /RateRequestLeaseService\.completeRate\(\s*id, rateId, \{ confirmSellerModification: true \}/)
  assert.match(resume, /await router\.replace\(\{ name: 'pricing-rate-wizard', params: \{ rateId \}, query: \{ mode: 'view' \} \}\)/)
})
