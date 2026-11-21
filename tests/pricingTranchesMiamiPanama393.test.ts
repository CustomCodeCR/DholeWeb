import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'
import {
  selectMultimodalLandFreight391, selectPanamaLtlCharges391,
  type P7CostRoute391,
} from '../src/modules/pricing/utils/pricingP7Context391.ts'

const route: P7CostRoute391 = {
  originIds: ['balboa'], destinationIds: ['san-jose'],
  incotermId: 'fca', agentId: null, serviceIds: ['transport'], weightKg: 1200,
}
function row(id: string, name: string, overrides: Partial<CostSelectDto> = {}): CostSelectDto {
  return {
    id, name, costDetailType: 'Freight', costType: 'Fixed',
    isActive: true, isAccountant: false, costAmount: 0, saleAmount: 0,
    utilityAmount: 0, currencyId: 'usd', currencyCode: 'USD',
    currencyName: 'USD', chargeBasis: 'PerShipment',
    shipmentModes: ['Ltl'], incoterms: [], services: [],
    poes: [{ id: 'balboa', name: 'Balboa, Panama', code: 'BLB' }],
    pods: [{ id: 'san-jose', name: 'San José, Costa Rica', code: 'SJO' }],
    ...overrides,
  }
}

test('multimodal FCL matches the independent FTL inland master, not only Freight/Fcl', () => {
  const inland = row('land', 'Flete Internacional Terrestre Panamá a Costa Rica', {
    costDetailType: 'InlandTransport', shipmentModes: ['Ftl'],
    costAmount: 2140, saleAmount: 2400,
  })
  assert.equal(selectMultimodalLandFreight391([inland], route)?.id, 'land')
  assert.equal(selectMultimodalLandFreight391([row('other', inland.name, {
    costDetailType: 'InlandTransport', shipmentModes: ['Ftl'],
    poes: [{ id: 'other', name: 'Puerto Caldera', code: 'CAL' }],
  })], route), null)
})

test('Panama LTL includes four independent weight-tiered charges, even zero-value Gastos', () => {
  const prices = (costAmount: number, saleAmount: number) => JSON.stringify([
    { dimension: 'WeightKg', minValue: 1, maxValue: 2000,
      containerTypeId: null, calculationMode: 'Flat', costAmount, saleAmount },
  ])
  const costs = [
    row('freight', 'Flete Internacional Terrestre Panama a Costa Rica',
      { pricingRulesJson: prices(170, 200) }),
    row('bunker', 'Bunker Panamá a Costa Rica', { pricingRulesJson: prices(30, 40) }),
    row('expenses', 'Gastos Panamá a Costa Rica', { pricingRulesJson: prices(0, 0) }),
    row('custody', 'Custodia + Marchamo', { pricingRulesJson: prices(20, 35) }),
  ]
  const result = selectPanamaLtlCharges391(costs, route)
  assert.deepEqual([...result.keys()].sort(), ['bunker', 'custody', 'freight', 'panama-expenses'].sort())
  assert.equal(result.get('freight')?.costAmount, 170)
  assert.equal(result.get('bunker')?.saleAmount, 40)
  assert.equal(result.get('panama-expenses')?.costAmount, 0)
})

test('P7 preserves persisted detail ids, and allows partial catalog reconciliation', () => {
  const plugin = readFileSync(new URL('../build/pricingP7Reconcile391.ts', import.meta.url), 'utf8')
  assert.match(plugin, /if \(selected\.size > 0\)/)
  assert.match(plugin, /!existing\.detailId && !existing\.manual/)
  assert.match(plugin, /key: 'p7-393-panama-gam-fcl-land'/)
  assert.match(plugin, /costId: null/)
  assert.match(plugin, /costAmount: 2140, saleAmount: 2140/)
})

test('Miami plan D matches the attached cotizador HTML', () => {
  const plugin = readFileSync(new URL('../build/pricingMiamiLclRules20261002.ts', import.meta.url), 'utf8')
  assert.match(plugin, /D: \{ label: 'Cliente D', salePerCft: 2\.92, minimumFreightSale: 292, sed: 35, handling: 55, vgm: 45, tica: 30, seal: 35, documentation: 50, forwarding: 65, insurancePct: 0\.80, insuranceMinimum: 60 \}/)
  const breakdown = readFileSync(new URL('../build/pricingMiamiOwnLclBreakdown.ts', import.meta.url), 'utf8')
  assert.match(breakdown, /number\(miamiChargeableCft\.value\)/)
})
