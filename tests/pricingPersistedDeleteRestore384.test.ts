import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const remove = readFileSync(new URL('../build/pricingScreen7RemoveVariableLines.ts', import.meta.url), 'utf8')
const refresh = readFileSync(new URL('../build/pricingWizardScreen7CostChoice.ts', import.meta.url), 'utf8')
test('explicit removal passes the persisted ID to the backend removal reconciliation', () => {
  assert.match(remove, /line\.detailId\) explicitlyRemovedPersistedDetailIds\.value\.add\(line\.detailId\)/)
  assert.match(refresh, /explicitlyRemovedPersistedDetailIds\.value = new Set/)
  assert.match(refresh, /restored\.length !== originals\.length/)
  assert.match(refresh, /removedScreen7LineKeys\.value = \[\]/)
})
test('explicit refresh is not disabled by the saved quote guard', () => {
  assert.match(wizard, /loadApplicableCosts\(forceRefresh = false\)/)
  assert.match(wizard, /rebuildRateLines\(forceRefresh = false\)/)
  assert.match(refresh, /loadApplicableCosts\(true\)/)
  assert.match(refresh, /rebuildRateLines\(true\)/)
  assert.doesNotMatch(refresh, /await loadAllApplicableOptionalCosts\(\)/)
})
test('navigating existing quote must never append insurance', () => {
  assert.match(wizard, /if \(props\.rateId \|\| props\.viewOnly \|\| hydratingExistingRate\.value \|\| !editingRate\.value\) return/)
})
