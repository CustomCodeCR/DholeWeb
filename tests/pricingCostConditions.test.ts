import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolveCostPricing, readCostPricingRules, validateCostPricingRules } from '../src/modules/pricing/utils/pricingCostRules.ts'

const makeCost = (pricingRulesJson: string | null) =>
  ({ costAmount: 10, saleAmount: 20, pricingRulesJson })

const json = (rules: Array<Record<string, unknown>>) => JSON.stringify(rules)

test('Weight: 500 belongs to the first band and 500.01 to the next band', () => {
  const cost = makeCost(json([
    { dimension: 'WeightKg', minValue: 1, maxValue: 500, containerTypeId: null, costAmount: 50, saleAmount: 70 },
    { dimension: 'WeightKg', minValue: 500.01, maxValue: 1500, containerTypeId: null, costAmount: 90, saleAmount: 125 },
  ]))
  assert.deepEqual(resolveCostPricing(cost, { weightKg: 500 }), { costAmount: 50, saleAmount: 70 })
  assert.deepEqual(resolveCostPricing(cost, { weightKg: 500.01 }), { costAmount: 90, saleAmount: 125 })
  assert.equal(resolveCostPricing(cost, { weightKg: 1600 }), null)
})

test('Package and container bands select only the matching tier', () => {
  const packageCost = makeCost(json([
    { dimension: 'Packages', minValue: 1, maxValue: 3, containerTypeId: null, costAmount: 20, saleAmount: 30 },
    { dimension: 'Packages', minValue: 4, maxValue: 15, containerTypeId: null, costAmount: 45, saleAmount: 65 },
  ]))
  assert.deepEqual(resolveCostPricing(packageCost, { packages: 3 }), { costAmount: 20, saleAmount: 30 })
  assert.deepEqual(resolveCostPricing(packageCost, { packages: 4 }), { costAmount: 45, saleAmount: 65 })

  const containerCost = makeCost(json([
    { dimension: 'ContainerType', minValue: null, maxValue: null, containerTypeId: '20dv', costAmount: 100, saleAmount: 135 },
    { dimension: 'ContainerType', minValue: null, maxValue: null, containerTypeId: '40hc', costAmount: 185, saleAmount: 245 },
  ]))
  assert.deepEqual(resolveCostPricing(containerCost, { containerTypeId: '40hc' }), { costAmount: 185, saleAmount: 245 })
  assert.equal(resolveCostPricing(containerCost, { containerTypeId: 'unknown' }), null)
})

test('Overlapping bands, duplicate containers, and invalid package decimals are rejected', () => {
  const weight = readCostPricingRules(json([
    { dimension: 'WeightKg', minValue: 1, maxValue: 500, containerTypeId: null, costAmount: 50, saleAmount: 70 },
    { dimension: 'WeightKg', minValue: 500, maxValue: 1500, containerTypeId: null, costAmount: 90, saleAmount: 125 },
  ]))
  assert.match(validateCostPricingRules(weight) ?? '', /solaparse/)
  const packages = readCostPricingRules(json([
    { dimension: 'Packages', minValue: 1.5, maxValue: 3, containerTypeId: null, costAmount: 20, saleAmount: 30 },
  ]))
  assert.match(validateCostPricingRules(packages) ?? '', /enteros/)
})

test('Costs without bands keep legacy amounts and missing cargo never selects a band', () => {
  assert.deepEqual(resolveCostPricing(makeCost(null), {}), { costAmount: 10, saleAmount: 20 })
  assert.equal(resolveCostPricing(makeCost(json([
    { dimension: 'WeightKg', minValue: 1, maxValue: 500, containerTypeId: null, costAmount: 50, saleAmount: 70 },
  ])), {}), null)
})

test('Pricing wizards re-evaluate tiers when weight, pieces, or equipment changes', async () => {
  for (const file of [
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /resolvedConditionalCost\(cost\)/)
    assert.match(source, /form\.cargoWeightKg, form\.cargoPallets, form\.equipmentId/)
    assert.match(source, /if \(!resolvedConditionalCost\(cost\)\) return false/)
  }
})
