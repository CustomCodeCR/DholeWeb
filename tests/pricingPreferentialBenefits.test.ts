import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CostSelectDto } from '../src/core/interfaces/pricing'
import { customerPreferentialAmounts, customerPreferentialRate, customerManualPreferentialRates,
  type CustomerPreferentialRate } from '../src/modules/pricing/utils/pricingPreferentialBenefits'

const rate = (id:string, change:Partial<CustomerPreferentialRate>={}):CustomerPreferentialRate => ({
  id,modality:'FCL',chargeCode:'DestinationCharge',rateType:'FIXED_AMOUNT',
  value:80,isActive:true,...change,
})
const context={modality:'FCL',polCode:'POL-VN',poeCode:'POE-CR',podCode:'POD-SJ',
  equipmentCode:'40HC',carrierCode:'ONE',incotermCode:'CIF',serviceCodes:['CUSTOMS_CR','RECEPTION']}
const cost={id:'cost-hbl',name:'HBL',costDetailType:'DestinationCharge',currencyCode:'USD',
  chargeBasis:'PerContainer'} as CostSelectDto

test('Preferential sale follows the matching account, POE, POD, equipment, carrier, Incoterm and service',()=>{
  const otherPoe=rate('wrong-poe',{poeCodes:['POE-PANAMA'],value:2})
  const otherCarrier=rate('wrong-carrier',{carrierCode:'MSC',value:3})
  const otherService=rate('wrong-service',{serviceCodes:['WAREHOUSE'],value:4})
  const general=rate('general',{value:100})
  const specific=rate('specific',{poeCodes:['POE-CR'],podCodes:['POD-SJ'],
    carrierCode:'ONE',incotermCode:'CIF',equipmentCodes:['40HC'],
    serviceCodes:['RECEPTION'],value:45})
  const actual=customerPreferentialAmounts(cost,{costAmount:0,saleAmount:50},
    [otherPoe,otherCarrier,otherService,general,specific],context,{})
  assert.equal(actual.saleAmount,45)
  assert.equal(actual.costAmount,0)
  assert.equal(actual.agreement?.id,'specific')
  assert.equal(customerPreferentialAmounts(cost,{costAmount:0,saleAmount:50},
    [specific],{...context,incotermCode:'FOB'},{}).saleAmount,50)
})

test('Linked CostId outranks general charge and invalid/expired rules do not apply',()=>{
  const preferred=rate('linked',{sourceCostId:'cost-hbl',value:40})
  const general=rate('general',{value:90})
  assert.equal(customerPreferentialAmounts(cost,{costAmount:10,saleAmount:50},
    [general,preferred],context,{}).saleAmount,40)
  const expired=rate('expired',{sourceCostId:'cost-hbl',validUntil:'2020-01-01',value:1})
  assert.equal(customerPreferentialAmounts(cost,{costAmount:10,saleAmount:50},
    [expired],context,{}).saleAmount,50)
})

test('Never apply CRM USD amount to CRC charge or incompatible units',()=>{
  const preference=rate('usd',{currencyCode:'USD',unitCode:'SHIPMENT',value:20})
  assert.equal(customerPreferentialAmounts(cost,{costAmount:15,saleAmount:50},
    [preference],context,{}).saleAmount,50)
  assert.equal(customerPreferentialRate([preference],context,'CRC','SHIPMENT'),undefined)
})

test('Percent/waiver affect only sale, and manual charge respects route',()=>{
  assert.deepEqual(customerPreferentialAmounts(cost,{costAmount:18,saleAmount:100},
    [rate('discount',{rateType:'DISCOUNT_PERCENT',value:15})],context,{}).saleAmount,85)
  assert.equal(customerPreferentialAmounts(cost,{costAmount:18,saleAmount:100},
    [rate('waiver',{rateType:'WAIVE',value:null})],context,{}).saleAmount,0)
  const manual=rate('manual',{customChargeName:'Manejo especial',sourceCostId:null,value:35,
    incotermCode:'CIF'})
  assert.deepEqual(customerManualPreferentialRates([manual],context).map(x=>x.id),['manual'])
  assert.deepEqual(customerManualPreferentialRates([manual],{...context,incotermCode:'FOB'}),[])
})
