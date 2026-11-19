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

test('A missing route selector does not hide all items from the Pricing catalog', () => {
  assert.equal(matchesPreferentialRoute(cost(), {...route,polCode:'',poeCode:'',podCode:''}),true)
  assert.equal(matchesPreferentialRoute(cost({services:[{id:'a',name:'Customs',code:'CUSTOMS'}]}),
    {...route,serviceCodes:['CUSTOMS']}),true)
  assert.equal(matchesPreferentialRoute(cost({services:[{id:'a',name:'Storage',code:'WAREHOUSE'}]}),
    {...route,serviceCodes:['CUSTOMS']}),false)
  assert.equal(matchesPreferentialRoute(cost({shipmentMode:'AirConsol'}),
    {shipment:'AIR',polCode:'',poeCode:'',podCode:''}),true)
})

test('Showing all Pricing items never bypasses Caldera POE or San José POD', () => {
  const all = {...route, includeOtherShipmentModes:true}
  // Costs from other services/modes can still be considered if their geographic scope matches.
  assert.equal(matchesPreferentialRoute(cost({shipmentMode:'Ftl'}), all), true)
  assert.equal(matchesPreferentialRoute(cost({shipmentMode:'Ftl',poeCode:'PABAL'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({shipmentMode:'Ftl',podCode:'PAZLC'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({shipmentMode:'Fcl',podCode:'PAZLC'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({poeCode:'PABAL'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({podCode:'CRLIM'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({
    poes:[{id:'1',name:'Balboa, Panamá',code:'PABAL'}]
  }), all), false)
  assert.equal(matchesPreferentialRoute(cost({
    pods:[{id:'1',name:'Puerto Limón',code:'CRLIM'}]
  }), all), false)
  assert.equal(matchesPreferentialRoute(cost({poeCode:'CRCAL',podCode:'CRSJO'}), all), true)
  assert.equal(matchesPreferentialRoute(cost({}), all), true,
    'Truly unrestricted costs remain visible for the selected services')
})

test('Port-linked costs with Any or legacy port role must still match a selected port', () => {
  const all = {...route, includeOtherShipmentModes:true}
  assert.equal(matchesPreferentialRoute(cost({portCode:'PABAL',portRole:'Any'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({portCode:'PABAL',portRole:null}), all), false)
  assert.equal(matchesPreferentialRoute(cost({portCode:'CRCAL',portRole:'Any'}), all), true)
  assert.equal(matchesPreferentialRoute(cost({portCode:'CRSJO',portRole:'Pod'}), all), true)
  assert.equal(matchesPreferentialRoute(cost({portCode:'PABAL',portRole:'Poe'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({portCode:'CRCAL',portRole:'Pod'}), all), false)
  assert.equal(matchesPreferentialRoute(cost({portCode:'PABAL',portRole:'Any'}),
    {...all,polCode:'',poeCode:'',podCode:''}), true)
})

test('Service and carrier filters stay effective when showing other shipment modes', () => {
  const all = {...route, includeOtherShipmentModes:true, carrierCode:'ONE',serviceCodes:['CUSTOMS']}
  assert.equal(matchesPreferentialRoute(cost({
    shipmentMode:'Ftl',poeCode:'CRCAL',
    services:[{id:'s',code:'CUSTOMS',name:'Customs'}],
    carriers:[{id:'c',code:'ONE',name:'Ocean Network Express'}],
  }),all),true)
  assert.equal(matchesPreferentialRoute(cost({
    services:[{id:'s',code:'WAREHOUSE',name:'Warehouse'}],
  }),all),false)
  assert.equal(matchesPreferentialRoute(cost({carrierCode:'MSC'}),all),false)
})
