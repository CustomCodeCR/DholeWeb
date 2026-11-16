import test from 'node:test'
import assert from 'node:assert/strict'
import {
  panamaMultimodalWeightExcess,
  pricePanamaMultimodalOverweight,
} from '../src/modules/pricing/utils/panamaMultimodalOverweight.ts'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'

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
