import { readFileSync } from 'node:fs'
import { sellerRateCurrencyValue } from '../src/modules/pricing/utils/sellerRateCurrency.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'
import { resolveCostPricing } from '../src/modules/pricing/utils/pricingCostRules.ts'
import {
  isCfzToSanJoseOwnLtl,
  ltlPanamaCostKind,
  selectLtlPanamaCosts,
  buildCfzSanJoseCatalogTariff,
  CFZ_SAN_JOSE_CATALOG_TARIFF_ID,
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

test('CFZ to San José is selectable directly from the four master costs, without a stored land tariff', () => {
  const costs = [
    cost('freight', 'Flete Terrestre Internacional Panama a Costa Rica', {
      costAmount: 0, saleAmount: 0,
      pricingRulesJson: JSON.stringify([
        { dimension: 'WeightKg', minValue: 1, maxValue: 500, costAmount: 180, saleAmount: 200, calculationMode: 'Flat' },
        { dimension: 'WeightKg', minValue: 501, maxValue: 3000, costAmount: 0.2, saleAmount: 0.3, calculationMode: 'PerKg' },
        { dimension: 'WeightKg', minValue: 3001, maxValue: null, costAmount: 0.18, saleAmount: 0.25, calculationMode: 'PerKg' },
      ]),
    }),
    cost('bunker', 'Bunker Panamá a Costa Rica', { costAmount: 55, saleAmount: 70 }),
    cost('expense', 'Gastos Panamá a Costa Rica', { costAmount: 40, saleAmount: 50 }),
    cost('custody', 'Custodia + Marchamo', { costAmount: 25, saleAmount: 30 }),
  ]
  const route = {
    originId: 'cfz', originName: 'Colón Free Zone, Panamá', originCode: 'CFZ',
    destinationId: 'sj', destinationName: 'San José, Costa Rica', destinationCode: 'SJO',
    weightKg: 185.5,
    billableCbm: 28.56,
  }
  const first = buildCfzSanJoseCatalogTariff(costs, route)
  assert.ok(first)
  assert.equal(first.id, CFZ_SAN_JOSE_CATALOG_TARIFF_ID)
  assert.equal(first.priceAmount * route.billableCbm, 200)
  assert.equal(first.costPerCbm! * route.billableCbm, 180)
  assert.equal(first.commercialProfile, 'FinalClient')
  assert.equal(first.shipmentMode, 'Ltl')
  assert.deepEqual(first.ltlChargeItems, [])
  assert.equal(buildCfzSanJoseCatalogTariff(costs, { ...route, weightKg: 501 })?.priceAmount,
    (501 * 0.3) / route.billableCbm)
  assert.equal(buildCfzSanJoseCatalogTariff(costs, { ...route, weightKg: 3001 })?.priceAmount,
    (3001 * 0.25) / route.billableCbm)
  const pending = buildCfzSanJoseCatalogTariff(costs, { ...route, weightKg: 0 })
  assert.ok(pending, 'route must remain visible before entering weight')
  assert.equal(pending.priceAmount, 0)
  assert.match(pending.notes ?? '', /Pendiente de ingresar peso/)
  assert.equal(buildCfzSanJoseCatalogTariff(costs.slice(1), route), null)
  assert.equal(buildCfzSanJoseCatalogTariff(costs, { ...route, originName: 'Balboa, Panamá', originCode: 'BLB' }), null)
})

test('cost-backed LTL selection does not borrow unrelated Balboa-only master costs', () => {
  const route = {
    originName: 'Colon Free Zone, Panama', destinationName: 'San Jose, Costa Rica',
    weightKg: 500, billableCbm: 2.07,
  }
  const all = [
    cost('freight', 'Flete Terrestre Internacional Panama a Costa Rica'),
    cost('bunker', 'Bunker', { poes: [{ id: 'blb', name: 'Balboa, Panamá', code: 'BLB' }] }),
    cost('expense', 'Gastos Panama a Costa Rica'),
    cost('custody', 'Custodia + Marchamo'),
  ]
  assert.equal(buildCfzSanJoseCatalogTariff(all, route), null)
})

test('LTL uses Config currency Value for own and coloader rates, never a generated CUR code', () => {
  const currencies = [
    { id: 'usd', code: 'CUR-2026-001', label: 'Dólares', value: 'USD' },
    { id: 'crc', code: 'CUR-2026-002', label: 'Colones', value: 'CRC' },
  ]
  assert.equal(sellerRateCurrencyValue({ currencyId: 'usd', currencyCode: 'CUR-2026-001' }, currencies), 'USD')
  assert.equal(sellerRateCurrencyValue({ currencyId: 'crc', currencyCode: 'CUR-2026-002' }, currencies), 'CRC')
  assert.equal(sellerRateCurrencyValue({ currencyId: '', currencyCode: 'CUR-2026-001' }, currencies), 'USD')
  assert.equal(sellerRateCurrencyValue({ currencyId: '', currencyCode: 'CUR-2026-999' }, currencies), null)
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLtlRateSourceSelector.vue', import.meta.url), 'utf8')
  assert.match(selector, /CatalogItemsService\.select\(\{ catalogGroupSlug: 'currencies' \}\)/)
  assert.match(selector, /currencyCatalog\.value = currencyResult\.status === 'fulfilled'/)
  assert.match(selector, /sellerRateCurrencyValue\(row, currencyCatalog\.value\)/)
  assert.match(selector, /importedCurrencyValue\(row\)/)
  assert.ok((selector.match(/ownCurrencyValue\(row\)/g) ?? []).length >= 5)
  assert.doesNotMatch(selector, /\{\{\s*row\.currencyCode\s*\|\|/)
})
