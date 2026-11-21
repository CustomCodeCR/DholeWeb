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

test('P7 waits for both active and contextual queries and does not cache partial CostIds', () => {
  assert.match(wizard, /const catalogFetch = refreshCatalog/)
  assert.match(wizard, /PricingService\.selectCosts\(\{ isActive: true \}\)/)
  assert.match(wizard, /const active = await catalogFetch/)
  assert.match(wizard, /allCosts\.value = active\.list/)
  assert.match(wizard, /activeCatalogValidatedContexts\.add\(requestContext\)/)
  assert.match(wizard, /serial !== applicableCostRequestSerial/)
  assert.match(wizard, /const missingCatalogLines = applicableConfiguredCosts\(\)/)
  assert.match(wizard, /if \(!force && activeCatalogValidatedContexts\.has\(context\)/)
  assert.match(wizard, /ready = await loadApplicableCosts\(\)/)
  assert.match(wizard, /if \(!ready\) return\s*rebuildRateLines\(\)/)
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
