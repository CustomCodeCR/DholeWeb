import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { captureInlandRows, restoreInlandRows } from '../src/modules/pricing/utils/pricingInlandDraftMemory.ts'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('Inland CostId and edited price, VAT, currency and bill-to survive P6/P7 rebuild', () => {
  const source = [
    { key: 'cost:abc', costId: 'abc', costAmount: 445, saleAmount: 600,
      included: true, currencyId: 'usd', currencyName: 'USD', currencyCode: 'USD',
      applyDestinationTax: true, destinationTaxRate: 13, billToClient: 'Cliente X' },
  ]
  const saved = captureInlandRows(source, () => true)
  const refreshed = [
    { ...source[0], key: 'refreshed:abc', costAmount: 400, saleAmount: 450,
      included: false, applyDestinationTax: false, billToClient: '' },
  ]
  restoreInlandRows(refreshed, saved, () => true, () => true)
  assert.equal(refreshed[0].costAmount, 445)
  assert.equal(refreshed[0].saleAmount, 600)
  assert.equal(refreshed[0].included, true)
  assert.equal(refreshed[0].applyDestinationTax, true)
  assert.equal(refreshed[0].billToClient, 'Cliente X')
  assert.equal(refreshed[0].currencyCode, 'USD')
  assert.equal(refreshed[0].destinationTaxRate, 13)
})

test('switching Inland mode excludes old selection without deleting remembered values', () => {
  const source = [{ key: 'cost:1', costId: '1', costAmount: 510, saleAmount: 780,
    included: true, applyDestinationTax: true }]
  const saved = captureInlandRows(source, () => true)
  const next = [{ ...source[0], costAmount: 0, saleAmount: 0 }]
  restoreInlandRows(next, saved, () => true, () => false)
  assert.equal(next[0].included, false)
  assert.equal(next[0].applyDestinationTax, false)
  assert.equal(next[0].costAmount, 510)
  assert.equal(next[0].saleAmount, 780)
  assert.equal(saved[0].included, true)
})

test('empty rebuilds cannot discard existing Inland memory, different CostIds never merge', () => {
  const old = [{ key: 'cost:old', costId: 'old', costAmount: 390, saleAmount: 590, included: true }]
  const saved = captureInlandRows(old, () => true)
  assert.deepEqual(captureInlandRows([], () => true, saved), saved)
  const wrongSupplier = [{ key: 'cost:other', costId: 'other', costAmount: 12, saleAmount: 20, included: false }]
  restoreInlandRows(wrongSupplier, saved, () => true, () => true)
  assert.equal(wrongSupplier[0].costAmount, 12)
  assert.equal(wrongSupplier[0].saleAmount, 20)
})

test('P7 obtains catalog and contextual costs from one Pricing HTTP call', () => {
  const loader = wizard.slice(wizard.indexOf('async function loadApplicableCosts()'), wizard.indexOf('function rebuildRateLines()'))
  assert.match(loader, /PricingService\.selectWizardCosts\(\{/)
  assert.doesNotMatch(loader, /PricingService\.selectCosts\(/)
  assert.match(loader, /allCosts\.value = bundle\.catalog/)
  assert.match(loader, /costs\.value = reconcileActiveCostCatalog\(bundle\.applicable, allCosts\.value\)/)
  assert.match(loader, /activeCatalogValidatedContexts\.add\(requestContext\)/)
  assert.match(loader, /serial !== applicableCostRequestSerial/)
  assert.match(wizard, /const missingCatalogLines = applicableConfiguredCosts\(\)/)
  assert.match(wizard, /if \(!force && activeCatalogValidatedContexts\.has\(context\)/)
  assert.match(wizard, /ready = \(activeCatalogValidatedContexts\.has\(activeCostContextKey\(\)\)/)
  assert.match(wizard, /\|\| await loadApplicableCosts\(\)/)
  assert.match(wizard, /if \(!ready\) \{[\s\S]*?return\s*\}\s*rebuildRateLines\(\)/)
})

test('Inland choices remain scoped per route, CRM customer, agent and services', () => {
  assert.match(wizard, /const inlandDraftMemory = ref<Record<string, InlandRouteMemory>>/)
  assert.match(wizard, /const context = activeCostContextKey\(\)/)
  assert.match(wizard, /rememberCurrentInland\(\)/)
  assert.match(wizard, /restoreCurrentInland\(\)/)
  assert.match(wizard, /captureInlandRows\(rateLines\.value/)
  assert.match(wizard, /restoreInlandRows\(/)
  assert.match(wizard, /form\.carrierHaulage = saved\.carrierHaulage/)
  assert.match(wizard, /form\.merchantHaulage = saved\.merchantHaulage/)
  assert.match(wizard, /rateLines\.value = lines\s*restoreCurrentInland\(\)/)
})

test('P6 permits a verified same-route cost snapshot to enter P7 without a second HTTP call', () => {
  const helper = wizard.slice(wizard.indexOf('function screenSixHasValidCostSnapshot('),
    wizard.indexOf('async function advanceSequentialWizard()'))
  assert.match(helper, /context !== activeCostContextKey\(\)/)
  assert.match(helper, /customerPreferentialError\.value/)
  assert.match(helper, /customerPreferentialAccountId\.value !== form\.clientId/)
  assert.match(helper, /draft\.fields\.agentId !== form\.agentId/)
  assert.match(helper, /draft\.fields\.currencyId !== form\.currencyId/)
  assert.match(helper, /activeIds\.has\(cost\.id\) && applicableCost\(cost\)/)
  assert.match(wizard, /const verifiedSnapshot = sameRoute && screenSixHasValidCostSnapshot\(screenSixContext\)/)
  assert.match(wizard, /ready = verifiedSnapshot \|\| await loadApplicableCosts\(\)/)
  assert.match(wizard, /if \(!ready && sameRoute\) ready = screenSixHasValidCostSnapshot\(screenSixContext\)/)
  assert.match(wizard, /restoreCurrentInland\(\)/)
  assert.match(wizard, /ensureProviderFreightOnScreenSeven\(\)/)
})
