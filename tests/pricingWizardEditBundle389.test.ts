import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { patchPricingWizardEditBundle389 } from '../build/pricingWizardEditBundle389.ts'
import { pricingQuotationEditDelta387Runtime } from '../build/pricingQuotationEditDelta387.ts'

const testSource = [
  'let dholeHaulageRequestVersion = 0',
  '    const requestedContext = currentCostContextKey()',
  '      await loadApplicableCosts()',
  '      if (requestVersion !== dholeHaulageRequestVersion) return',
  '      if (!validCurrent) {',
  'async function loadApplicableCosts() {',
  '  if (props.rateId && !allowCatalogRefreshForSavedQuote.value) return true',
  '  const bundle = await PricingService.selectWizardCosts(contextualQuery)',
  '}',
  'function rebuildRateLines() {}',
  'function appendConfiguredCostToPersistedEdit(cost: CostSelectDto) {',
  "  if (cost.costDetailType === 'Freight') return",
  '}',
  'function addIncotermFallbackLine() {}',
  'async function quoteEditApplyDelta387(): Promise<boolean> { return true }',
].join('\n')

test('DH-389: saved quote P6 and edit delta consult wizard-bundle, not legacy select', () => {
  const result = patchPricingWizardEditBundle389(testSource)
  assert.match(result, /async function loadApplicableCosts\(forQuoteEditContext = false\)/)
  assert.match(result, /!allowCatalogRefreshForSavedQuote\.value && !forQuoteEditContext/)
  assert.match(result, /pricesLoaded = await loadApplicableCosts\(Boolean\(props\.rateId\)\)/)
  assert.match(result, /if \(!pricesLoaded\) return/)
  assert.match(result, /if \(!validCurrent && !props\.viewOnly\)/)
  assert.doesNotMatch(result, /if \(!validCurrent && !props\.rateId\)/)
  assert.match(result, /PricingService\.selectWizardCosts\(contextualQuery\)/)
  assert.doesNotMatch(result, /PricingService\.selectCosts\(/)
  assert.match(pricingQuotationEditDelta387Runtime, /let loaded = await loadApplicableCosts\(true\)/)
})

test('DH-389: quote edits can add independent terrestrial freight but never overwrite ocean Freight', () => {
  const result = patchPricingWizardEditBundle389(testSource)
  assert.match(result, /terrestre\|land freight/)
  assert.doesNotMatch(result, /if \(cost\.costDetailType === 'Freight'\) return/)
  const source = readFileSync(new URL('../build/pricingQuotationEditDelta387.ts', import.meta.url), 'utf8')
  assert.match(source, /const newlySelectedInland = contextChanged && selectedHaulage/)
  assert.match(source, /dholeHaulageOptionalAssociation\(cost\) === selectedHaulage/)
  assert.match(source, /contextChanged && \/terrestre\|land freight\//)
})

test('DH-389: guard incompatible Vite rewrites and avoid synthetic pricing lines', () => {
  assert.throws(
    () => patchPricingWizardEditBundle389(testSource.replace('PricingService.selectWizardCosts(', 'PricingService.selectCosts(')),
    /Required wizard-bundle endpoint missing/,
  )
  assert.equal(patchPricingWizardEditBundle389('test fixture without a quotation edit'), 'test fixture without a quotation edit')
})


test('P6: editable saved quote selects available or lowest-cost inland, without switching a valid saved choice', () => {
  const comparison = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')
  const start = comparison.indexOf('      const merchant = dholeMerchantAvailable.value')
  const end = comparison.indexOf('      syncHaulageOptionalLines()', start)
  assert.ok(start >= 0 && end > start)
  const selection = comparison.slice(start, end)
  const transformed = patchPricingWizardEditBundle389(testSource.replace('      if (!validCurrent) {', selection))
  const from = transformed.indexOf('      const merchant = dholeMerchantAvailable.value')
  const to = transformed.indexOf('async function loadApplicableCosts(', from)
  assert.ok(from >= 0 && to > from)
  const run = new Function('props', 'form', 'dholeMerchantAvailable', 'dholeCarrierAvailable', 'dholeHaulageRecommended', transformed.slice(from, to))
  const scenarios = [
    { merchant: true, carrier: false, recommended: 'merchant', initial: [false, false], expected: [true, false] },
    { merchant: false, carrier: true, recommended: 'carrier', initial: [false, false], expected: [false, true] },
    { merchant: true, carrier: true, recommended: 'merchant', initial: [false, false], expected: [true, false] },
    { merchant: true, carrier: true, recommended: 'carrier', initial: [false, false], expected: [false, true] },
    { merchant: true, carrier: true, recommended: 'merchant', initial: [false, true], expected: [false, true] },
    { merchant: true, carrier: false, recommended: 'merchant', initial: [false, true], expected: [true, false] },
    { merchant: true, carrier: false, recommended: 'merchant', initial: [false, false], expected: [false, false], viewOnly: true },
    { merchant: false, carrier: false, recommended: null, initial: [false, false], expected: [false, false] },
  ]
  for (const scenario of scenarios) {
    const form = { merchantHaulage: scenario.initial[0], carrierHaulage: scenario.initial[1] }
    run({ rateId: 'existing-quote', viewOnly: scenario.viewOnly ?? false }, form, { value: scenario.merchant }, { value: scenario.carrier }, { value: scenario.recommended })
    assert.deepEqual([form.merchantHaulage, form.carrierHaulage], scenario.expected)
  }
})
