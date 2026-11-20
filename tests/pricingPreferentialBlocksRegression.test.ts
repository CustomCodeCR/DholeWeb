import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CostSelectDto } from '../src/core/interfaces/pricing'
import { customerPreferentialAmounts, customerPreferentialScopeIssues,
  customerPreferentialCatalogContext, customerManualPreferentialRates,
  type CustomerPreferentialRate } from '../src/modules/pricing/utils/pricingPreferentialBenefits'
import { groupCustomerAgreementBlocks } from '../src/modules/crm/utils/crmPreferentialGroups'

const quote = { modality:'FCL', polCode:'POL-2026-029', poeCode:'POE-2026-001',
  podCode:'POD-2026-012', carrierCode:'NAV-2026-005', incotermCode:'CIF',
  equipmentCode:'40HC', serviceCodes:['CUSTOMS_CR','RECEPTION'] }
const scope = { modality:'FCL', polCodes:[quote.polCode],poeCodes:[quote.poeCode],
  podCodes:[quote.podCode], carrierCode:quote.carrierCode,
  incotermCode:'CIF',equipmentCodes:['40HC'],
  serviceCodes:['CUSTOMS_CR','RECEPTION'], isActive:true }
const cost = (id:string,name:string,type:string,basis:string,sale=50,extra={}) =>
  ({id,name,costDetailType:type,chargeBasis:basis,currencyCode:'USD',
    costAmount:20,saleAmount:sale,...extra}) as CostSelectDto
const saved = (id:string,name:string,type:string,value:number|null,unit:string|null,
  extra:Partial<CustomerPreferentialRate>={}) => ({
    id,customChargeName:name,chargeCode:type,rateType:'FIXED_AMOUNT',
    sourceCostId:'old-'+id,value,unitCode:unit,currencyCode:'USD',...scope,...extra,
  }) as CustomerPreferentialRate
const catalog = [
  cost('live-agency','Servicio de agencia','AgentCharge','PerShipment',70,{
    pricingRulesJson:JSON.stringify([{dimension:'ContainerType',containerTypeId:'equip-40',
      minValue:null,maxValue:null,costAmount:25,saleAmount:70,calculationMode:'Flat'}])}),
  cost('live-marchamo','Marchamo Electronico','DestinationCharge','PerContainer',130),
  cost('live-doc','Documentacion','Documentation','PerShipment',55),
  cost('live-naviera','Cargos en destino Linea Naviera','DestinationCharge','PerShipment',795),
  cost('live-anticipado','Anticipado','DestinationCharge','PerContainer',145),
  cost('live-descon','Desconsolidación','DestinationCharge','PerContainer',220),
]
const tier = [{dimension:'ContainerType',containerTypeId:'equip-40',minValue:null,
  maxValue:null,calculationMode:'Flat',includedStorageDays:null,saleAmount:90}]
const agreements = [
  saved('agency','Servicio de agencia','AgentCharge',null,null,{
    rateType:'TIERED_SALE',tierSalesJson:JSON.stringify(tier)}),
  saved('marchamo','Marchamo Electronico','DestinationCharge',100,'CONTAINER'),
  saved('doc','Documentacion','Documentation',0,'DOCUMENT'),
  saved('naviera','Cargos en destino Linea Naviera','DestinationCharge',695,'CONTAINER'),
  saved('anticipado','Anticipado','DestinationCharge',125,'CONTAINER'),
  saved('descon','Desconsolidacion','Other',175,'SHIPMENT',{sourceCostId:null}),
]

test('six independently saved CRM items are one commercial block even with legacy manual charge', () => {
  const blocks=groupCustomerAgreementBlocks(agreements)
  assert.equal(blocks.length,1)
  assert.equal(blocks[0]?.lines.length,6)
})

test('CIF 40HC ONE Caldera/San Jose: agreements match current CostIds and current quote services', () => {
  const expected:Record<string,number> = {
    'live-agency':90,'live-marchamo':100,'live-doc':0,
    'live-naviera':695,'live-anticipado':125,'live-descon':175,
  }
  for(const item of catalog){
    const before={costAmount:item.costAmount,saleAmount:item.saleAmount}
    const result=customerPreferentialAmounts(item,before,agreements,quote,{
      containerTypeId:'equip-40',containerQuantity:1,teuQuantity:2,
    },catalog)
    assert.equal(result.saleAmount,expected[item.id],item.name)
    assert.equal(result.costAmount,before.costAmount,item.name+' supplier cost cannot change')
    assert.ok(result.agreement,item.name+' must name the matched agreement')
  }
})

test('shipment-price on per-container supplier cost normalizes at 2 containers',()=>{
  const original=catalog.find(x=>x.id==='live-descon')!
  const result=customerPreferentialAmounts(original,{costAmount:20,saleAmount:220},
    agreements,quote,{containerQuantity:2,teuQuantity:4},catalog)
  assert.equal(result.saleAmount,87.5)
  assert.equal(result.costAmount,20)
})

test('no cross-route/currency leakage, no unsafe fallback for ambiguous duplicated names',()=>{
  const doc=catalog.find(x=>x.id==='live-doc')!
  assert.equal(customerPreferentialAmounts(doc,{costAmount:20,saleAmount:55},
    agreements,{...quote,incotermCode:'FOB'},{containerQuantity:1},catalog).saleAmount,55)
  assert.equal(customerPreferentialAmounts({...doc,currencyCode:'CRC'},{costAmount:20,saleAmount:55},
    agreements,quote,{containerQuantity:1},catalog).saleAmount,55)
  assert.equal(customerPreferentialAmounts(doc,{costAmount:20,saleAmount:55},
    agreements,quote,{containerQuantity:1},[doc,{...doc,id:'duplicate'}]).saleAmount,55)
  assert.deepEqual(customerPreferentialScopeIssues(agreements[0]!,{...quote,carrierCode:'NAV-OTHER'}),['Naviera'])
})

test('Pricing catalog IDs reconcile Config route-code aliases for the six CRM agreements', () => {
  const routeCosts = catalog.map(item => ({
    ...item,
    pols: [{id:'uuid-ho-chi-minh',code:quote.polCode,name:'Ho Chi Minh'}],
    poes: [{id:'uuid-caldera',code:quote.poeCode,name:'Puerto Caldera'}],
    pods: [{id:'uuid-san-jose',code:quote.podCode,name:'San Jose'}],
    carriers: [{id:'uuid-one',code:quote.carrierCode,name:'ONE'}],
  }))
  const configCodes = {
    ...quote,polCode:'SD_HO_CHI_MINH_VIETNAM',
    poeCode:'SD_PUERTO_CALDERA_COSTA_RICA',
    podCode:'SD_SAN_JOSE_COSTA_RICA',carrierCode:'ONE',
  }
  const selected = {polId:'uuid-ho-chi-minh',poeId:'uuid-caldera',
    podId:'uuid-san-jose',carrierId:'uuid-one'}
  const cost = routeCosts.find(item => item.id === 'live-marchamo')!
  const base = {costAmount:45,saleAmount:80}
  assert.equal(customerPreferentialAmounts(cost,base,agreements,configCodes,
    {containerQuantity:1},routeCosts).saleAmount,80)
  const resolved = customerPreferentialCatalogContext(configCodes,routeCosts,selected)
  assert.equal(resolved.polCode,quote.polCode)
  assert.equal(resolved.poeCode,quote.poeCode)
  assert.equal(resolved.podCode,quote.podCode)
  assert.equal(resolved.carrierCode,quote.carrierCode)
  const matched = customerPreferentialAmounts(cost,base,agreements,resolved,
    {containerQuantity:1},routeCosts)
  assert.equal(matched.saleAmount,100)
  assert.equal(matched.costAmount,45)
  assert.equal(customerManualPreferentialRates(agreements,resolved).length,1)
  assert.equal(customerManualPreferentialRates(agreements,configCodes).length,0)
})

test('catalog alias reconciliation never bypasses IDs, ambiguous catalogs or another naviera',()=>{
  const priced = catalog[1]!
  const related = {
    ...priced,poes:[{id:'actual-caldera',code:quote.poeCode,name:'Caldera'}],
  }
  const wrongRoute = customerPreferentialCatalogContext({
    ...quote,poeCode:'OTHER-PORT'},[related],{poeId:'other-port'})
  assert.equal(wrongRoute.poeCode,'OTHER-PORT')
  const conflicting = customerPreferentialCatalogContext({
    ...quote,poeCode:'OTHER-PORT'},[related,{
      ...related,id:'another',poes:[{id:'actual-caldera',code:'POE-OTHER',name:'Other'}],
    }],{poeId:'actual-caldera'})
  assert.equal(conflicting.poeCode,'OTHER-PORT')
  assert.equal(customerPreferentialAmounts(priced,{costAmount:20,saleAmount:130},
    agreements,{...quote,carrierCode:'NAV-OTHER'}, {containerQuantity:1},catalog).saleAmount,130)
})
