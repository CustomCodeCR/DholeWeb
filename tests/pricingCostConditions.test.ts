import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { patchPricingCostSelectedPartyContext } from '../build/pricingCostSelectedPartyContext.ts'
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

test('Manually configured fixed and per-unit bands are calculated without any seeded tariffs', () => {
  const item = makeCost(json([
    { dimension: 'WeightKg', minValue: 1, maxValue: 10, containerTypeId: null, costAmount: 9, saleAmount: 12, calculationMode: 'Flat' },
    { dimension: 'WeightKg', minValue: 11, maxValue: 20, containerTypeId: null, costAmount: 3, saleAmount: 4, calculationMode: 'PerKg' },
    { dimension: 'WeightKg', minValue: 21, maxValue: null, containerTypeId: null, costAmount: 2, saleAmount: 5, calculationMode: 'PerKg' },
  ]))
  assert.deepEqual(resolveCostPricing(item, { weightKg: 10 }), { costAmount: 9, saleAmount: 12 })
  assert.deepEqual(resolveCostPricing(item, { weightKg: 15 }), { costAmount: 45, saleAmount: 60 })
  assert.deepEqual(resolveCostPricing(item, { weightKg: 25 }), { costAmount: 50, saleAmount: 125 })
})

test('Fiscal storage extra days are only calculated from explicitly entered values', () => {
  const item = makeCost(json([
    { dimension: 'Packages', minValue: 1, maxValue: 2, containerTypeId: null,
      costAmount: 2, saleAmount: 3, calculationMode: 'PerExtraDay', includedStorageDays: 3 },
  ]))
  assert.equal(resolveCostPricing(item, { packages: 2 }), null)
  assert.equal(resolveCostPricing(item, { packages: 2, storageDays: 3 }), null)
  assert.deepEqual(resolveCostPricing(item, { packages: 2, storageDays: 5 }), { costAmount: 4, saleAmount: 6 })
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
    assert.match(source, /form\.cargoWeightKg, form\.cargoPallets, form\.cargoPackages, form\.storageDays, form\.equipmentId/)
    assert.match(source, /if \(!resolvedConditionalCost\(cost\)\) return false/)
  }
})

test('New cost tiers do not prefill prices and require manual amounts and a service', async () => {
  const source = await readFile(new URL('../src/modules/pricing/components/PricingCostFormDrawer.vue', import.meta.url), 'utf8')
  assert.match(source, /costAmount: '',\s*saleAmount: '',/)
  assert.match(source, /Seleccione el servicio al que pertenece este costo/)
  assert.match(source, /Ingrese manualmente el costo y la venta de cada tramo/)
})

test('context transform retains conditional-cost helper and other wizard functions', async () => {
  const source = await readFile(
    new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
    'utf8',
  )
  const transformed = patchPricingCostSelectedPartyContext(source)
  assert.match(transformed, /function resolvedConditionalCost\(cost: CostSelectDto\)/)
  assert.match(transformed, /function isOwnLclCarrierCatalogCost\(cost: CostSelectDto\)/)
  assert.match(transformed, /function applicableCost\(cost: CostSelectDto\)/)
  assert.match(transformed, /function costContextLabel\(cost: CostSelectDto\)/)
  assert.match(transformed, /function resolvedConditionalCost[\s\S]*?function applicableCost/)
})

test('missing cargo band never dereferences null in either quotation wizard', async () => {
  // The selected services may contain costs with unmatched weight, package, or
  // container bands, e.g. customs + warehouse-only tariffs on an FCL quote.
  for (const file of [
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /resolvedConditionalCost\(cost\)!\.(?:costAmount|saleAmount)/)
    assert.match(source, /const resolvedAmount = resolvedConditionalCost\(cost\)\s*if \(!resolvedAmount\) return/)
    assert.match(source, /costAmount: resolvedAmount\.costAmount/)
    assert.match(source, /saleAmount: resolvedAmount\.saleAmount/)
  }
  const landTransform = await readFile(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
  assert.match(landTransform, /function applicableCost\(cost: CostSelectDto\) \{\s*\/\/[^]*?if \(!resolvedConditionalCost\(cost\)\) return false/)
  const exwTransform = await readFile(new URL('../build/pricingExwFcaVariableCosts.ts', import.meta.url), 'utf8')
  assert.match(exwTransform, /if \(!resolvedConditionalCost\(cost\)\) return false/)
  assert.match(exwTransform, /costAmount: resolvedAmount\.costAmount/)
})

test('storage days appear on screen 3 for Almacenamiento and the recorded days drive storage charges', async () => {
  for (const file of [
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /return normalized\.includes\('almacen'\)/)
    assert.match(source, /const storageServiceSelected = computed/)
    assert.match(source, /v-model="form\.serviceIds"[\s\S]*?v-if="storageServiceSelected"[\s\S]*?v-model\.number="form\.storageDays"/)
    assert.match(source, /v-else-if="step === 7"[\s\S]*?v-if="storageServiceSelected"[\s\S]*?v-model\.number="form\.storageDays"/)
    assert.match(source, /storageDays: Math\.trunc\(number\(form\.storageDays\)\) > 0/)
    assert.match(source, /form\.storageDays = Math\.max\(0, Number\(rate\.storageDays \?\? 0\)\)/)
  }
})

test('cost lines no longer force CRC on importation or Costa Rica POE', async () => {
  for (const file of [
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /CRC obligatorio · POE Costa Rica/)
    assert.doesNotMatch(source, /isLineCrcForced\(/)
    assert.doesNotMatch(source, /forcedCrcServiceIds/)
    assert.match(source, /function setLineCurrency\(line: RateLine, currencyId: string\)/)
    assert.match(source, /function enforceLineCurrency\(_line: RateLine\)/)
  }
})
