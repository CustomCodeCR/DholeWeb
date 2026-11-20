import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Regression guard for the transformed (production) wizard; the original Vue
// source is patched by Vite, so asserting only its untransformed source misses
// exactly the step-6 -> step-7 failure observed in production.
const haulage = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')
const optional = readFileSync(new URL('../build/pricingOptionalChargesFinalGuard.ts', import.meta.url), 'utf8')

test('step 7 restores validated screen 6 CostIds after the REST context refresh', () => {
  assert.match(haulage, /function dholeRestoreCurrentHaulageCatalog\(\)/)
  assert.match(haulage, /dholeHaulageScreen7OptionContext\.value !== context/)
  assert.match(haulage, /finalOptionalMatchesCurrentContext\(cost\)/)
  assert.match(haulage, /loader\.replace\(reloadAnchor/)
  assert.match(haulage, /dholeRestoreCurrentHaulageCatalog\(\).*?reloadAnchor/s)
})

test('selected inland is added to rate lines by CostId before save', () => {
  assert.match(haulage, /function dholeEnsureSelectedHaulageLines\(\)/)
  assert.match(haulage, /if \(props\.viewOnly \|\| step\.value !== 7 \|\| !dholeHaulageVisible\.value\) return/)
  assert.match(haulage, /const existing = rateLines\.value\.find\(\(line\) => line\.costId === cost\.id\)/)
  assert.match(haulage, /costId: cost\.id/)
})

test('manual and automatic Merchant or Carrier decisions survive POE/carrier and reload', () => {
  assert.match(haulage, /function dholeChooseHaulage\(mode: DholeHaulageChoice\)/)
  assert.match(haulage, /rememberCurrentCarrierDraft\(\)\n  savePricingDraftNow\(\)/)
  assert.match(haulage, /syncHaulageOptionalLines\(\)\n      \/\/ Automatic Merchant/)
  assert.match(haulage, /watch\(\n  \(\) => \[step\.value, currentCostContextKey\(\)\]/)
})

test('stale Optional REST responses cannot overwrite another route after navigation', () => {
  assert.match(optional, /const contextKey = currentCostContextKey\(\)\n    const optionalCosts = await loadAllApplicableOptionalCosts\(\)/)
  assert.match(optional, /if \(contextKey !== currentCostContextKey\(\) \|\| !\[6, 7\]\.includes\(step\.value\)\) return/)
})
