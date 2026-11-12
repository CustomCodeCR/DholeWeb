import assert from 'node:assert/strict'
import test from 'node:test'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'
import { resolveCostPricing } from '../src/modules/pricing/utils/pricingCostRules.ts'
import {
  isCfzToSanJoseOwnLtl,
  ltlPanamaCostKind,
  selectLtlPanamaCosts,
  LTL_PANAMA_REQUIRED_KINDS,
} from '../src/modules/pricing/utils/ltlPanamaOwnCosts.ts'

function cost(id: string, name: string, extra: Partial<CostSelectDto> = {}): CostSelectDto {
  return {
    id, name,
    costType: 'Optional', costDetailType: 'Other',
    costAmount: 0, saleAmount: 0, utilityAmount: 0,
    isAccountant: false, isActive: true,
    currencyId: 'usd', currencyName: 'USD', currencyCode: 'USD',
    incoterms: [], services: [],
    shipmentModes: ['Lcl', 'Ltl'], chargeBasis: 'PerShipment',
    poes: [{ id: 'cfz', name: 'Colón Free Zone, Panamá', code: 'CFZ' }],
    pods: [{ id: 'sj', name: 'San José, Costa Rica', code: 'SJO' }],
    ...extra,
  }
}

test('CFZ to San José only: no FTL, NVOCC, other origin or other destination', () => {
  assert.ok(isCfzToSanJoseOwnLtl('Colon Free Zone, Panama', 'San Jose, Costa Rica', 'Ltl', 'FinalClient'))
  assert.ok(isCfzToSanJoseOwnLtl('CFZ, Panamá', 'San José, Costa Rica', 'Ltl', 'FinalClient'))
  assert.equal(isCfzToSanJoseOwnLtl('Balboa, Panamá', 'San Jose', 'Ltl', 'FinalClient'), false)
  assert.equal(isCfzToSanJoseOwnLtl('CFZ, Panamá', 'Cartago', 'Ltl', 'FinalClient'), false)
  assert.equal(isCfzToSanJoseOwnLtl('CFZ, Panamá', 'San José', 'Ftl', 'FinalClient'), false)
  assert.equal(isCfzToSanJoseOwnLtl('CFZ, Panamá', 'San José', 'Ltl', 'Nvocc'), false)
})

test('the four operational names are recognized without unrelated costs', () => {
  assert.equal(ltlPanamaCostKind('Flete Terrestre Internacional Panamá a Costa Rica'), 'freight')
  assert.equal(ltlPanamaCostKind('Bunker Panamá a Costa Rica'), 'bunker')
  assert.equal(ltlPanamaCostKind('Gastos Panama a Costa Rica'), 'panama-expenses')
  assert.equal(ltlPanamaCostKind('Custodia + Marchamo'), 'custody')
  assert.equal(ltlPanamaCostKind('Gastos documentales Miami'), null)
})

test('selects exactly one matching catalog cost for each concept, never a Balboa-only/Ftl cost', () => {
  const input = [
    cost('a', 'Bunker', { poes: [{ id: 'other', name: 'Balboa, Panamá', code: 'BLB' }] }),
    cost('b', 'Bunker'),
    cost('c', 'Gastos Panamá a Costa Rica'),
    cost('d', 'Custodia + Marchamo'),
    cost('e', 'Flete Terrestre Internacional Panama a Costa Rica'),
    cost('f', 'Flete Terrestre Internacional Panama a Costa Rica', { shipmentModes: ['Ftl'] }),
    cost('g', 'Gastos Panama a Costa Rica', { isActive: false }),
    cost('h', 'Bunker', { incoterms: [{ id: 'fob', name: 'FOB', code: 'FOB' }] }),
  ]
  const selected = selectLtlPanamaCosts(input, { incotermId: 'exw' })
  assert.deepEqual([...selected.keys()].sort(), [...LTL_PANAMA_REQUIRED_KINDS].sort())
  assert.equal(selected.get('bunker')?.id, 'b')
  assert.equal(selected.get('freight')?.id, 'e')
})

test('land freight tiers apply once to the TOTAL shipment weight, including the boundary', () => {
  const freight = cost('f', 'Flete Terrestre Internacional Panamá a Costa Rica', {
    pricingRulesJson: JSON.stringify([
      { dimension: 'WeightKg', minValue: 1, maxValue: 500, containerTypeId: null,
        costAmount: 90, saleAmount: 100, calculationMode: 'Flat' },
      { dimension: 'WeightKg', minValue: 501, maxValue: 3000, containerTypeId: null,
        costAmount: 0.2, saleAmount: 0.3, calculationMode: 'PerKg' },
    ]),
  })
  assert.deepEqual(resolveCostPricing(freight, { weightKg: 185.5 }), { costAmount: 90, saleAmount: 100 })
  assert.deepEqual(resolveCostPricing(freight, { weightKg: 501 }), { costAmount: 100.2, saleAmount: 150.29999999999998 })
  assert.equal(resolveCostPricing(freight, { weightKg: 0 }), null)
})
