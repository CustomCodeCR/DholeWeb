import test from 'node:test'
import assert from 'node:assert/strict'
import {
  panamaMultimodalWeightExcess,
  pricePanamaMultimodalOverweight,
  isPanamaOverweightSupplement,
  preservePersistedPanamaOverweightLines,
} from '../src/modules/pricing/utils/panamaMultimodalOverweight.ts'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'
import { readFileSync } from 'node:fs'

const names = [
  'Flete Terrestre Internacional Panamá a Costa Rica',
  'Bunker Panamá Costa Rica',
  'Gastos Panamá a Costa Rica',
  'Custodia + Marchamo',
]
function catalog(): CostSelectDto[] {
  return names.map((name, index) => ({
    id: 'cost-' + index,
    name,
    isActive: true,
    costDetailType: index === 0 ? 'Freight' : 'Other',
    shipmentMode: 'Ltl',
    shipmentModes: ['Ltl'],
    poes: [{ id: 'cfz', code: 'CFZ', name: 'Colón Free Zone, Panamá' }],
    pods: [{ id: 'sjo', code: 'SJO', name: 'San José, Costa Rica' }],
    pricingRulesJson: JSON.stringify([{
      dimension: 'WeightKg', minValue: 1, maxValue: 5000,
      costAmount: 2, saleAmount: 3, calculationMode: 'PerKg',
    }]),
    costAmount: 0, saleAmount: 0,
  })) as unknown as CostSelectDto[]
}

test('19,000 kg is not overweight', () => {
  assert.deepEqual(panamaMultimodalWeightExcess([19000]), {
    excessKg: 0, overweightContainers: 0,
  })
  assert.equal(pricePanamaMultimodalOverweight([19000], catalog()).charges.length, 0)
})

test('22,000 kg charges four master cost concepts on 3,000 kg only', () => {
  const result = pricePanamaMultimodalOverweight([22000], catalog())
  assert.equal(result.excessKg, 3000)
  assert.equal(result.overweightContainers, 1)
  assert.deepEqual(result.missing, [])
  assert.equal(result.charges.length, 4)
  assert.deepEqual(result.charges.map((charge) => charge.costAmount), [6000, 6000, 6000, 6000])
  assert.deepEqual(result.charges.map((charge) => charge.saleAmount), [9000, 9000, 9000, 9000])
})

test('multiple container weights are evaluated independently', () => {
  const result = pricePanamaMultimodalOverweight([19000, 22000, 12000], catalog())
  assert.equal(result.excessKg, 3000)
  assert.equal(result.overweightContainers, 1)
  assert.equal(result.charges.length, 4)
})

test('incomplete catalogs and unavailable weight bands fail closed', () => {
  assert.equal(pricePanamaMultimodalOverweight([22000], catalog().slice(0, 3)).missing.length, 1)
  const result = pricePanamaMultimodalOverweight([25000], catalog())
  assert.equal(result.excessKg, 6000)
  assert.equal(result.missing.length, 4)
  assert.equal(result.charges.length, 0)
})

test('costs for unrelated Panama origins cannot be substituted', () => {
  const wrong = catalog().map((cost) => ({ ...cost, poes: [{ id: 'balboa', name: 'Balboa Panamá', code: 'BAL' }] }))
  assert.equal(pricePanamaMultimodalOverweight([22000], wrong as CostSelectDto[]).missing.length, 4)
})


test('DH-390: FCL multimodal overweight uses the LTL master catalog from the same wizard bundle', () => {
  const transform = readFileSync(
    new URL('../build/pricingPanamaFclOverweight.ts', import.meta.url), 'utf8')
  assert.match(transform, /allCosts\.value/)
  assert.doesNotMatch(transform, /\bcosts\.value/)
  assert.match(transform, /pricePanamaMultimodalOverweight\(/)
  // In the FCL request, the applicable collection has no LTL tier rows.
  // They are retained in catalog for the local 19,000 kg excess calculation.
  const result = pricePanamaMultimodalOverweight([22000], catalog())
  assert.equal(result.excessKg, 3000)
  assert.equal(result.charges.length, 4)
})

test('saved FCL excess keeps the four charges when edit drops legacy terrestrial freight', () => {
  const notes = 'Sobrepeso sobre 19.000 kg por contenedor; costo maestro calculado únicamente por 2000 kg excedentes.'
  const details = names.map((name, index) => ({ id: 'detail-' + index, name, notes,
    costId: 'cost-' + index, costAmount: [400, 200, 165, 55][index]!, saleAmount: [400, 200, 165, 55][index]! }))
  const restore = (detail: typeof details[number]) => ({ ...detail, detailId: detail.id, included: true })
  const current = details.slice(1).map(restore)
  const result = preservePersistedPanamaOverweightLines(current, details, restore, () => false)
  assert.equal(result.length, 4)
  assert.equal(result.reduce((sum, line) => sum + line.costAmount, 0), 820)
  assert.equal(result.reduce((sum, line) => sum + line.saleAmount, 0), 820)
  assert.equal(preservePersistedPanamaOverweightLines(result, details, restore, () => false), result)
  const edited = result.map(line => line.detailId === 'detail-0' ? { ...line, saleAmount: 450 } : line)
  assert.equal(preservePersistedPanamaOverweightLines(edited, details, restore, () => false), edited)
  assert.equal(preservePersistedPanamaOverweightLines(current, details, restore,
    line => line.detailId === 'detail-0'), current)
  assert.equal(isPanamaOverweightSupplement({ name: names[0]! }), false)
  assert.equal(isPanamaOverweightSupplement({ name: names[0]!, notes }), true)
  assert.equal(isPanamaOverweightSupplement({ name: 'Excedente Panamá · ' + names[0]! }), true)
})
test('haulage reconciliation skips generated and historical excess lines before catalog lookup', () => {
  const transform = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')
  assert.match(transform, /if \(isPanamaOverweightSupplement\(line\)\) return/)
  assert.match(transform, /if \(isPanamaOverweightSupplement\(cost\)\) return null/)
})
