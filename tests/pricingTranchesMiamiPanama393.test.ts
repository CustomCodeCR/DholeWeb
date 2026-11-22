import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { CostSelectDto } from '../src/core/interfaces/pricing.ts'
import {
  selectMultimodalLandFreight391, selectPanamaLtlCharges391, isTerrestrialFreightRow395,
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


test('DH-394: CFZ commercial POL resolves all Panama LTL costs through the physical POE name', () => {
  const names = {
    pol: 'c2600000-0000-4000-8000-000000000010',
    poe: 'c2610000-0000-4000-8000-000000000010',
    commercialPoe: 'c2610000-0000-4000-8000-000000000008',
    pod: '7bca5d96-127f-4c90-9453-22f5057380b6',
    agent: '0c5be554-8842-4eef-abae-824dc474ae65',
    service: 'c2300000-0000-4000-8000-000000000001',
  }
  const route394: P7CostRoute391 = {
    originIds: [names.pol, names.commercialPoe],
    destinationIds: [names.pod],
    originNames: ['Colon Free Zone, Panama', 'San Jose, Costa Rica'],
    destinationNames: ['San Jose, Costa Rica'],
    agentId: names.agent, serviceIds: [names.service], weightKg: 500,
    incotermId: 'fca',
  }
  const amounts = (costAmount: number, saleAmount: number) => JSON.stringify([
    { dimension: 'WeightKg', minValue: 1, maxValue: 500, calculationMode: 'Flat',
      containerTypeId: null, costAmount, saleAmount },
  ])
  const selected = [
    row('freight', 'Flete Terrestre Internacional Panama a Costa Rica',
      { pricingRulesJson: amounts(180, 205) }),
    row('bunker', 'Bunker Panama a Costa Rica',
      { pricingRulesJson: amounts(90, 90) }),
    row('expenses', 'Gastos Panama a Costa Rica',
      { pricingRulesJson: amounts(0, 0) }),
    row('custody', 'Custodia + Marchamo',
      { costAmount: 55, saleAmount: 55 }),
  ].map(c => ({
    ...c, costType: 'Optional', agentId: names.agent,
    agents: [{ id: names.agent, name: 'GRUPO CASTRO FALLAS', code: 'GCF' }],
    services: [{ id: names.service, name: 'Transporte Internacional', code: 'INT_TRANSPORT' }],
    poes: [{ id: names.poe, name: 'Colon Free Zone, Panama', code: 'CFZ' }],
    pods: [{ id: names.pod, name: 'San Jose, Costa Rica', code: 'SJO' }],
    shipmentModes: ['Lcl','Ltl'],
  })) as CostSelectDto[]
  const matches = selectPanamaLtlCharges391(selected, route394)
  assert.equal(matches.size, 4)
  assert.equal(matches.get('freight')?.costAmount, 180)
  assert.equal(matches.get('bunker')?.costAmount, 90)
  assert.equal(matches.get('panama-expenses')?.costAmount, 0)
  assert.equal(matches.get('custody')?.saleAmount, 55)
  const wrong: P7CostRoute391 = {
    ...route394, originIds: ['wrong'], originNames: ['Miami, United States'],
  }
  assert.equal(selectPanamaLtlCharges391(selected, wrong).size, 0)
})

test('DH-394: FCL multimodal retains the second (road) Freight master', () => {
  const fcl = row('ae17c229-3d18-48a2-a22d-61f23264780d',
    'Flete Internacional Terrestre', {
      shipmentModes: ['Fcl','Ftl'], costAmount: 2140, saleAmount: 2140,
      poes: [{ id: 'balboa', name: 'Balboa, Panama', code: 'BAL' }],
    })
  assert.equal(selectMultimodalLandFreight391([fcl], route)?.id, fcl.id)
  const transform = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
  assert.match(transform, /form.modality === 'Multimodal' && isTerrestrial/)
  const p7 = readFileSync(new URL('../build/pricingP7Reconcile391.ts', import.meta.url), 'utf8')
  assert.match(p7, /costs.value.find\(cost =>/)
  assert.match(p7, /isTerrestrialFreightRow395\(cost.name, cost.costDetailType\)/)
  assert.match(p7, /isRealRoadFreight396\(line\)/)
})

test('DH-394: missing Miami FAK items are restored only for new own-LCL quotes', () => {
  const plugin = readFileSync(new URL('../build/pricingP7Reconcile391.ts', import.meta.url), 'utf8')
  for (const expected of ['p7SyncMiamiCommercialItems394', "name: 'VGM'", "name: 'Documentación'",
    "name: 'Forwarding'", "name: 'SED'", "name: 'Marchamo'", "name: 'TICA'",
    'props.rateId', "lclSelectedSource.value?.kind !== 'Own'"]) {
    assert.ok(plugin.includes(expected), expected)
  }
})

test('DH-395: Bunker cannot masquerade as the FCL Panama terrestrial freight', () => {
  const bunker = 'Bunker Flete Internacional Terrestre Panama a Costa Rica'
  assert.equal(isTerrestrialFreightRow395(bunker, 'DestinationCharge'), false)
  assert.equal(isTerrestrialFreightRow395(bunker, 'Freight'), false)
  assert.equal(isTerrestrialFreightRow395('Gastos Flete Internacional Terrestre', 'InlandTransport'), false)
  assert.equal(isTerrestrialFreightRow395('Flete internacional terrestre', 'Freight'), true)
  assert.equal(isTerrestrialFreightRow395('Flete Terrestre Internacional Panamá a Costa Rica', 'InlandTransport'), true)
  assert.equal(isTerrestrialFreightRow395('Land freight Panama to Costa Rica', 'Freight'), true)
  assert.equal(isTerrestrialFreightRow395('Flete internacional marítimo', 'Freight'), false)
  assert.equal(isTerrestrialFreightRow395('Flete internacional terrestre', 'DestinationCharge'), false)
  const plugin = readFileSync(new URL('../build/pricingP7Reconcile391.ts', import.meta.url), 'utf8')
  assert.match(plugin, /const hasPricedLand/)
  assert.match(plugin, /!hasPricedLand && !validMaster && isPanamaToGam/)
  assert.match(plugin, /costAmount: 2140, saleAmount: 2140/)
})

test('DH-395: VGM from Miami plan survives own-LCL matrix restoration', () => {
  const p7 = readFileSync(new URL('../build/pricingP7Reconcile391.ts', import.meta.url), 'utf8')
  const persistence = readFileSync(new URL('../build/pricingWizardOwnLclLinePersistence.ts', import.meta.url), 'utf8')
  assert.match(p7, /name: 'VGM', sale: plan.vgm/)
  assert.match(p7, /lclSelectedSource.value\?\.kind !== 'Own'/)
  assert.match(persistence, /line.included && \(!ownLclFromMatrix\(line.notes\)/)
  assert.equal(persistence.split("startsWith('p7-394-miami:')").length - 1, 2)
  assert.match(persistence, /ownLclKeepQuotedLine\(line, rateLines.value\)/)
})

test('DH-395: LTL transit is editable on consolidated screens and saved as transitDays', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.equal(wizard.split('v-model.number="form.transitDays"').length - 1, 3)
  assert.match(wizard, /data-testid="pricing-ltl-transit-days"/)
  assert.match(wizard, /shipmentModeForApi === 'Ltl'/)
  assert.match(wizard, /transitDays: Math.max\(0, Math.trunc\(number\(form.transitDays\)\)\)/)
  assert.match(wizard, /transitTime: number\(form.transitDays\) > 0/)
})
