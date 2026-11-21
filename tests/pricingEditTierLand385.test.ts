import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolveCostPricing } from '../src/modules/pricing/utils/pricingCostRules.ts'

const loader = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
const refresher = readFileSync(new URL('../build/pricingWizardScreen7CostChoice.ts', import.meta.url), 'utf8')

test('DH-385: final Vite cost loader sends each tier dimension to Pricing', () => {
  for (const input of ['containerTypeId:', 'weightKg:', 'packages:', 'storageDays:']) {
    assert.ok(loader.includes(input), 'Missing contextual input: ' + input)
  }
  assert.match(loader, /if \(props\.rateId && !allowCatalogRefreshForSavedQuote\.value\) return true/)
  assert.match(loader, /if \(maritimeFcl && !props\.rateId\)|if \(!props\.rateId\) \{\s*fullCatalog/)
})

test('DH-385: explicitly refreshing a saved quote never resurrects unselected optional rows', () => {
  assert.match(refresher, /if \(props\.rateId && !previous\.some\(\(line\) => line\.costId === cost\.id\)\) continue/)
  assert.match(refresher, /if \(props\.rateId && !original && line\.costDetailType !== 'Freight'\) continue/)
  assert.doesNotMatch(refresher, /if \(originalContextUnchanged && !previous\.some/)
})

test('DH-385: quotes may carry a separately priced terrestrial multimodal freight', () => {
  assert.match(loader, /form\.modality === 'Multimodal' && isTerrestrial/)
  assert.match(loader, /emptyGeneric/)
})

test('DH-385: FCL 40HC takes its exact container tariff instead of zero base', () => {
  const hc = 'c1300000-0000-4000-8000-000000000003'
  const cost = {
    costAmount: 0, saleAmount: 0,
    pricingRulesJson: JSON.stringify([
      { dimension: 'ContainerType', containerTypeId: 'other', costAmount: 275, saleAmount: 275 },
      { dimension: 'ContainerType', containerTypeId: hc, costAmount: 350, saleAmount: 350 },
    ]),
  }
  assert.deepEqual(resolveCostPricing(cost, { containerTypeId: hc }), { costAmount: 350, saleAmount: 350 })
})

test('DH-385: tiered Panama to Costa Rica land freight uses 28000kg weight bracket', () => {
  const cost = {
    costAmount: 0, saleAmount: 0,
    pricingRulesJson: JSON.stringify([
      { dimension: 'WeightKg', minValue: 1, maxValue: 500, costAmount: 180, saleAmount: 180, calculationMode: 'Flat' },
      { dimension: 'WeightKg', minValue: 501, maxValue: 3000, costAmount: .2, saleAmount: .2, calculationMode: 'PerKg' },
      { dimension: 'WeightKg', minValue: 3001, maxValue: null, costAmount: .18, saleAmount: .18, calculationMode: 'PerKg' },
    ]),
  }
  assert.deepEqual(resolveCostPricing(cost, { weightKg: 28000 }), { costAmount: 5040, saleAmount: 5040 })
  assert.deepEqual(resolveCostPricing(cost, { weightKg: 500 }), { costAmount: 180, saleAmount: 180 })
  assert.equal(resolveCostPricing(cost, {}), null)
})

test('DH-385: package band and extra storage days use actual declared cargo dimensions', () => {
  const cost = {
    costAmount: 0, saleAmount: 0,
    pricingRulesJson: JSON.stringify([
      { dimension: 'Packages', minValue: 1, maxValue: 3, costAmount: 1500, saleAmount: 1500, calculationMode: 'PerExtraDay', includedStorageDays: 5 },
      { dimension: 'Packages', minValue: 4, maxValue: 15, costAmount: 2000, saleAmount: 2000, calculationMode: 'PerExtraDay', includedStorageDays: 5 },
    ]),
  }
  assert.deepEqual(resolveCostPricing(cost, { packages: 4, storageDays: 8 }), { costAmount: 6000, saleAmount: 6000 })
  assert.equal(resolveCostPricing(cost, { packages: 4, storageDays: 5 }), null)
})
