import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('seller modification allows only one in-flight save per wizard instance', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.match(wizard, /if \(rateSaveInFlight\) return/)
  assert.match(wizard, /rateSaveInFlight = true/)
  assert.match(wizard, /finally \{\s*rateSaveInFlight = false/)
})

test('modification saves carry optimistic revision and seller work-item identity', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const contract = read('src/core/interfaces/pricing.ts')
  assert.match(contract, /expectedRevisionNumber\?: number/)
  assert.match(contract, /modificationRequestId\?: string \| null/)
  assert.match(wizard, /expectedRevisionNumber: editingRate\.value\.revisionNumber/)
  assert.match(wizard, /modificationRequestId: props\.modificationRequestId \?\? null/)
})

test('a seller modification restores saved LCL freight instead of losing it', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.match(wizard, /const persistedFreight = props\.modificationRequestId/)
  assert.match(wizard, /!includedLines\.value\.some\(line => line\.costDetailType === 'Freight'\)/)
  assert.match(wizard, /detailId: persistedFreight\.id/)
  assert.match(wizard, /costAmount: Number\(persistedFreight\.costAmount/)
  assert.match(wizard, /saleAmount: Number\(persistedFreight\.saleAmount/)
})
