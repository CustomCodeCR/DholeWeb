import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'
import {
  isPanamaCostaRicaRoute391, selectPanamaLtlCharges391,
  selectMultimodalLandFreight391, freightModeTitle391,
} from '../src/modules/pricing/utils/pricingP7Context391.ts'
import { patchPricingP7Reconcile391 } from '../build/pricingP7Reconcile391.ts'

const base = {
  costType: 'Optional', costDetailType: 'DestinationCharge',
  currencyId: 'usd', currencyName: 'USD', currencyCode: 'USD',
  costAmount: 0, saleAmount: 0, utilityAmount: 0,
  isActive: true, isAccountant: false, shipmentMode: 'Any',
  shipmentModes: ['Lcl', 'Ltl'], chargeBasis: 'PerShipment',
  poes: [
    { id: 'balboa', name: 'Balboa, Panamá', code: 'BLB' },
    { id: 'cfz', name: 'Colón Free Zone, Panamá', code: 'CFZ' },
  ],
  pods: [
    { id: 'caldera', name: 'Caldera, Costa Rica', code: 'CAL' },
    { id: 'sj', name: 'San José, Costa Rica', code: 'SJO' },
  ],
  agentId: 'gcf', services: [{ id: 'transport', name: 'Transporte Internacional', code: 'INT_TRANSPORT' }],
  incoterms: [],
}
function price(min: number, max: number | null, cost: number, sale = cost) {
  return { dimension: 'WeightKg', minValue: min, maxValue: max,
    containerTypeId: null, costAmount: cost, saleAmount: sale, calculationMode: 'Flat' }
}
function master(id: string, name: string, rules?: unknown[]) {
  return { ...base, id, name,
    pricingRulesJson: rules ? JSON.stringify(rules) : null,
    ...(rules ? {} : { costAmount: 55, saleAmount: 55 }),
  } as unknown as CostSelectDto
}
const catalog = [
  master('freight', 'Flete Terrestre Internacional Panama a Costa Rica',
    [price(1, 500, 180, 200), price(501, null, 0.3, 0.4)]),
  master('bunker', 'Bunker Panama a Costa Rica',
    [price(1, 500, 90), price(501, null, 0.2)]),
  master('expenses', 'Gastos Panama a Costa Rica',
    [price(1, 500, 0), price(501, null, 165)]),
  master('custody', 'Custodia + Marchamo'),
]
const route = { originIds: ['balboa'], destinationIds: ['sj'], agentId: 'gcf',
  incotermId: 'fca', serviceIds: ['transport'], weightKg: 100 }

test('DH-391: FCA LTL Panamá–CR includes four exact-master costs, including a valid 0/0 tier', () => {
  assert.equal(isPanamaCostaRicaRoute391('Balboa, Panamá', 'San José, Costa Rica'), true)
  assert.equal(isPanamaCostaRicaRoute391('Colón, Panamá', 'Alajuela, Costa Rica'), true)
  assert.equal(isPanamaCostaRicaRoute391('Shanghai, China', 'Costa Rica'), false)
  const selected = selectPanamaLtlCharges391(catalog, route)
  assert.deepEqual([...selected.keys()].sort(), ['bunker', 'custody', 'freight', 'panama-expenses'])
  assert.deepEqual([selected.get('freight')?.costAmount, selected.get('bunker')?.costAmount,
    selected.get('panama-expenses')?.costAmount, selected.get('custody')?.costAmount],
    [180, 90, 0, 55])
  assert.equal(selected.get('freight')?.saleAmount, 200)
  assert.equal(selected.get('expenses'), undefined)
  assert.equal(selected.get('panama-expenses')?.cost.id, 'expenses')
  assert.equal(selectPanamaLtlCharges391(catalog, { ...route, weightKg: 501 })
    .get('panama-expenses')?.costAmount, 165)
})

test('DH-391: route and service restrictions protect against another country/provider', () => {
  assert.equal(selectPanamaLtlCharges391(catalog, { ...route, originIds: ['shanghai'] }).size, 0)
  assert.equal(selectPanamaLtlCharges391(catalog, { ...route, destinationIds: ['managua'] }).size, 0)
  assert.equal(selectPanamaLtlCharges391(catalog, { ...route, agentId: 'unrelated' }).size, 0)
  assert.equal(selectPanamaLtlCharges391(catalog, { ...route, serviceIds: [] }).size, 0)
  assert.equal(selectPanamaLtlCharges391(catalog, { ...route, weightKg: 0 }).size, 1,
    'fixed-price custody is valid but unknown tier bands must NOT produce artificial zero')
})

test('DH-391: multimodal maritime + terrestrial is a separate CostId on the real POD', () => {
  const land = { ...master('land', 'Flete Internacional Terrestre'),
    shipmentModes: ['Fcl', 'Ftl'], costDetailType: 'Freight',
    chargeBasis: 'PerContainer', costAmount: 2140, saleAmount: 2140,
    agentId: null, services: [], podId: 'managua',
    pods: [{ id: 'managua', name: 'Managua, Nicaragua', code: 'MGA' },
      { id: 'sj', name: 'San José, Costa Rica', code: 'SJO' }] } as CostSelectDto
  const selected = selectMultimodalLandFreight391([land], route)
  assert.equal(selected?.id, 'land',
    'the full multi-POD relation, not the legacy first POD, must determine the route')
  assert.equal(selectMultimodalLandFreight391([land], { ...route, destinationIds: ['caldera-ineligible'] }), null)
  assert.equal(selectMultimodalLandFreight391([land], { ...route, originIds: ['shanghai'] }), null)
})

test('DH-391: freight names distinguish terrestrial, aerial and maritime legs', () => {
  assert.equal(freightModeTitle391('Flete Internacional', 'Freight', 'Land'),
    'Flete internacional terrestre')
  assert.equal(freightModeTitle391('Flete internacional', 'Freight', 'Air'),
    'Flete internacional aéreo')
  assert.equal(freightModeTitle391('Flete Internacional', 'Freight', 'Maritime'),
    'Flete internacional marítimo')
  assert.equal(freightModeTitle391('Flete Internacional', 'Freight', 'Multimodal'),
    'Flete internacional marítimo')
  assert.equal(freightModeTitle391('Flete Internacional Terrestre', 'Freight', 'Multimodal'),
    'Flete internacional terrestre')
  assert.equal(freightModeTitle391('Servicio de agencia', 'DestinationCharge', 'Maritime'),
    'Servicio de agencia')
})

test('DH-391: final wizard transform enforces dynamic P7 and protects saved prices', () => {
  const source = [
    '<script setup lang="ts">',
    'function rebuildRateLines() {',
    '  rateLines.value = lines',
    '  lastTierPricingInputKey.value = tierPricingInputKey',
    '}',
    'function saveRate() {',
    '  rateLines.value = removeDuplicateFclFreight(rateLines.value, shipmentModeForApi.value)',
    '  if (!editingRate.value) applyIncotermAutomaticChargeGuard()',
    '}',
    'function isAutomaticOutsideIncoterm(line: RateLine) { return true }',
    'function quoteEditApplyDelta387() {}',
    'function syncPanamaOverweightLines() {}',
    'function syncOwnLclCrcAgencyLine() {}',
    '</script>',
    '<div>{{ line.name }}</div>',
  ].join('\n')
  const result = patchPricingP7Reconcile391(source)
  assert.match(result, /isTerrestrialFreightRow395/)
  assert.match(result, /hasPricedLand/)
  assert.match(result, /isPanamaToGam/)
  assert.match(result, /selectPanamaLtlCharges391/)
  assert.match(result, /quoteEditOriginalContext387/)
  assert.match(result, /!line\.detailId/)
  assert.match(result, /p7FreightTitle391\(line\)/)
  assert.match(result, /if \(step.value === 7\) p7PresentOrReconcile391\(\)/)
  assert.match(result, /if \(!props.rateId\) p7PresentOrReconcile391\(true\)/)
  assert.match(result, /normalizeCatalogValue\(line.name\) === "vgm"\) return false/)
  assert.match(result, /ensureMiamiPlanVgm396/)
  assert.match(result, /ensureIndependentRoadFreight396/)
  assert.equal(patchPricingP7Reconcile391(result), result)
})

test('DH-391: own LCL customs fetch is independent of the consolidation matrix', () => {
  const source = readFileSync(
    new URL('../build/pricingWizardOwnLclLinePersistence.ts', import.meta.url), 'utf8')
  assert.match(source, /ownLclCrcMasterCosts391/)
  assert.match(source, /PricingService\.selectWizardCosts\(/)
  assert.match(source, /\[\.\.\.ownLclCrcMasterCosts391\.value, \.\.\.costs\.value\]/)
  assert.match(source, /weightKg: number\(form\.cargoWeightKg\)/)
  assert.match(source, /configured\.pricingRulesJson|resolveCostPricing\(configured/)
})

test('DH-391: saved quote overweight is a requested delta, not an implicit repricing', () => {
  const delta = readFileSync(new URL('../build/pricingQuotationEditDelta387.ts', import.meta.url), 'utf8')
  const excess = readFileSync(new URL('../build/pricingPanamaFclOverweight.ts', import.meta.url), 'utf8')
  assert.match(delta, /changed\.has\('overweight'\) && form\.overweight/)
  assert.match(delta, /cargoWeightKg: number\(form\.cargoWeightKg\)/)
  assert.match(excess, /quoteEditChangedKeys387\(\)\.has\(key\)/)
  assert.match(excess, /detailId: original\?\.detailId/)
})
