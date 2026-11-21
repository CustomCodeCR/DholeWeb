import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
test('saved quote cannot regenerate catalog charges on edit', () => {
  assert.match(source, /if \(props\.rateId && !allowCatalogRefreshForSavedQuote\.value\) return true/)
  assert.match(source, /costs\.value = bundle\.applicable/)
  assert.match(source, /const uniqueReleaseLines = props\.rateId \? rateLines\.value/)
  assert.match(source, /if \(!props\.rateId && !props\.viewOnly\)/)
  assert.match(source, /async function loadCostsForSelectedAlternative\(force = false\) \{\s*if \(props\.rateId\) return/)
})
