import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesPreferentialRoute, matchesPreferentialCommercialScope, saleUnitForBasis } from '../src/modules/crm/utils/crmPreferentialCostRoute'
import type { CostSelectDto } from '../src/core/interfaces/pricing'

const cost = (overrides: Partial<CostSelectDto> = {}): CostSelectDto => ({
  id: '123', name: 'Handling', costType: 'Fixed', costDetailType: 'OriginCharge',
  currencyId: 'usd', currencyName: 'US Dollar', currencyCode: 'USD',
  costAmount: 100, saleAmount: 140, utilityAmount: 40, isAccountant: false,
  isActive: true, incoterms: [], shipmentMode: 'Fcl', chargeBasis: 'PerContainer',
  ...overrides,
})
const route = { shipment: 'FCL' as const, polCode: 'CNSHA', poeCode: 'CRCAL', podCode: 'CRSJO' }

test('Preferential route filters actual Pricing costs by shipment and POL/POE/POD', () => {
  assert.equal(matchesPreferentialRoute(cost(), route), true)
  assert.equal(matchesPreferentialRoute(cost({ shipmentMode: 'Air' }), route), false)
  assert.equal(matchesPreferentialRoute(cost({ pols: [{ id: '1', name: 'Other', code: 'CNNGB' }] }), route), false)
  assert.equal(matchesPreferentialRoute(cost({ poeCode: 'PANAM' }), route), false)
  assert.equal(matchesPreferentialRoute(cost({ portRole: 'Pod', portCode: 'OTHER' }), route), false)
  assert.equal(matchesPreferentialRoute(cost({ isActive: false }), route), false)
})

test('Unit of negotiated sale preserves the Pricing charge basis', () => {
  assert.equal(saleUnitForBasis('PerContainer'), 'CONTAINER')
  assert.equal(saleUnitForBasis('PerChargeableCbm'), 'CHARGEABLE_CBM')
  assert.equal(saleUnitForBasis('Per100Kg'), '100KG')
})

test('Naviera and Incoterm restrict source Pricing costs without hiding universal costs', () => {
  const focused = { ...route, carrierCode: 'CAR-MAERSK', incotermCode: 'FOB' }
  assert.equal(matchesPreferentialRoute(cost(), focused), true)
  assert.equal(matchesPreferentialRoute(cost({ carrierCode: 'CAR-OTHER' }), focused), false)
  assert.equal(matchesPreferentialRoute(cost({ carriers: [{id:'1',name:'Maersk',code:'CAR-MAERSK'}] }), focused), true)
  assert.equal(matchesPreferentialRoute(cost({ incoterms: [{id:'1',name:'CIF',code:'CIF'}] }), focused), false)
  assert.equal(matchesPreferentialRoute(cost({ incoterms: [{id:'2',name:'FOB',code:'FOB'}] }), focused), true)
})

test('Preferential saved scope identifies carrier and Incoterm, including unrestricted legacy records', () => {
  assert.equal(matchesPreferentialCommercialScope({}, {}), true)
  assert.equal(matchesPreferentialCommercialScope({}, {carrierCode:'MAERSK'}), false)
  assert.equal(matchesPreferentialCommercialScope({carrierCode:'MAERSK',incotermCode:'FOB'},
    {carrierCode:'MAERSK',incotermCode:'FOB'}), true)
  assert.equal(matchesPreferentialCommercialScope({carrierCode:'MAERSK',incotermCode:'CIF'},
    {carrierCode:'MAERSK',incotermCode:'FOB'}), false)
})
