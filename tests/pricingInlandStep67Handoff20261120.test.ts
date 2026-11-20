import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// The previously deployed 1.106.16 handoff attempted synchronous mutations
// while step 7's cost catalog was still loading. This smoke guard prevents a
// reintroduction without authenticated multi-POE browser coverage.
const haulage = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')
const optional = readFileSync(new URL('../build/pricingOptionalChargesFinalGuard.ts', import.meta.url), 'utf8')

test('emergency stabilization does not eagerly save incomplete screen-7 rate lines', () => {
  assert.doesNotMatch(haulage, /savePricingDraftNow\(\)/)
  assert.doesNotMatch(haulage, /dholeRestoreCurrentHaulageCatalog\(\)/)
  assert.match(haulage, /if \(props\.viewOnly \|\| !multiCarrierSelectionMode\.value \|\| step\.value !== 7\) return/)
})

test('no additional synchronous screen 7 watcher mutates rate lines ahead of loadApplicableCosts', () => {
  const watcherCount = (haulage.match(/\(\) => \[step\.value, currentCostContextKey\(\)\]\.join/g) ?? []).length
  assert.equal(watcherCount, 1)
  assert.match(haulage, /async function dholeMergeScreen7OptionalCostsForComparison\(/, 'optional catalog remains async')
})

test('inland optional catalog still loads through existing step-7 integration', () => {
  assert.match(optional, /await ensureAllApplicableOptionalCosts\(\)/)
  assert.match(optional, /const optionalCosts = await loadAllApplicableOptionalCosts\(\)/)
})
