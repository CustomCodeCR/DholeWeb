import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeCostMergeVisibility } from '../build/pricingWizardScreen4CostSelectors.ts'

const declaration = '  const visible = new Set(visibleSections.value)\n'
const oldGuard = "      if (!visible.has(section) || existingCostIds.has(cost.id) || existingKeys.has(equivalentKey)) return"
const currentGuard = "      if (!visible.has(section) || existingCostIds.has(cost.id)) return"
const desiredGuard = 'if (existingCostIds.has(cost.id)) return'

test('generated P7 merge removes old and current visible guards without dangling identifiers', () => {
  for (const guard of [oldGuard, currentGuard]) {
    const transformed = normalizeCostMergeVisibility('function mergeConfiguredOptionalCostsIntoRateLines() {\n'
      + declaration + guard + '\n}')
    assert.match(transformed, /if \(existingCostIds\.has\(cost\.id\)\) return/)
    assert.doesNotMatch(transformed, /visible\.has\(/)
    assert.doesNotMatch(transformed, /const visible =/)
  }
})

test('a future visibility condition cannot silently lose its lexical declaration', () => {
  const newGuard = "  if (visible.has('international_freight')) return"
  const transformed = normalizeCostMergeVisibility(declaration + newGuard)
  assert.match(transformed, /const visible = new Set/)
  assert.match(transformed, /visible\.has/)
  assert.throws(() => normalizeCostMergeVisibility(newGuard), /unresolved visible reference/)
})

test('real source P7 CostId guard is compatible with generated transform', () => {
  const source = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const start = source.indexOf('function mergeConfiguredOptionalCostsIntoRateLines(')
  const end = source.indexOf('\nfunction addManualCharge()', start)
  assert.ok(start >= 0 && end > start, 'P7 merge method must exist')
  const result = normalizeCostMergeVisibility(source.slice(start, end))
  assert.match(result, /existingCostIds\.has\(cost\.id\)/)
  assert.doesNotMatch(result, /visible\.has\(/)
  assert.match(result, /rateLines\.value\.push/)
})

test('P6/P7 freight and route-filter guard remain present on the wizard', () => {
  const source = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(source, /costs\.value = bundle\.applicable/)
  assert.match(source, /const freightRequested =/)
  assert.match(source, /if \(cost\.shipmentMode && String\(cost\.shipmentMode\) !== 'Any'/)
})
