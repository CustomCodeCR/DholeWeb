import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
test('final save button runs an observable async handler', () => {
  assert.match(wizard, /@click="handleSaveRateClick"/)
  assert.match(wizard, /async function handleSaveRateClick\(\)/)
  assert.match(wizard, /saveButtonFeedback\.value = 'Validando la tarifa/)
  assert.match(wizard, /Guardado detenido antes de Pricing/)
  assert.match(wizard, /data-testid="pricing-save-feedback"/)
})
test('the caller records whether a Pricing API request was attempted', () => {
  assert.match(wizard, /saveRequestSentToBackend\.value = true\s+await PricingService\.updateRate/)
  assert.match(wizard, /saveRequestSentToBackend\.value = true\s+rateId = await PricingService\.createRate/)
  assert.match(wizard, /if \(!saveRequestSentToBackend\.value\)/)
})
test('exceptions before API dispatch are reported and do not leave a stuck button', () => {
  assert.match(wizard, /catch \(error\) \{\s+console\.error\('\[Pricing\] Guardado/)
  assert.match(wizard, /finally \{\s+saveButtonWorking\.value = false/)
})
