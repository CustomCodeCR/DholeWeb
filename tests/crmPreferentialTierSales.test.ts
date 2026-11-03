import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { CostSelectDto } from '../src/core/interfaces/pricing'
import {
 costTiers, tierSignature, currentTierSale, tierSalesPayload, tierSalesMatch, discounted, tierText,
} from '../src/modules/crm/utils/crmPreferentialTierSales'

const original = (): CostSelectDto => ({
 id:'205ba6c9-75c8-4cb0-ad73-d85c704834cc',
 name:'Almacenaje', costType:'Fixed', costDetailType:'DestinationCharge',
 currencyId:'usd', currencyName:'Dólares', currencyCode:'CUR-2026-001',
 costAmount:0,saleAmount:0,utilityAmount:0,isAccountant:false,isActive:true,incoterms:[],
 chargeBasis:'PerContainer',pricingRulesJson:JSON.stringify([
  {dimension:'WeightKg',minValue:1,maxValue:99,containerTypeId:null,
   calculationMode:'Flat',includedStorageDays:null,costAmount:10,saleAmount:30},
  {dimension:'WeightKg',minValue:100,maxValue:300,containerTypeId:null,
   calculationMode:'PerKg',includedStorageDays:null,costAmount:0.25,saleAmount:0.5},
 ]),
})
test('a zero flat base cost with two tiers has independent sales',()=>{
 const c=original()
 assert.equal(c.saleAmount,0)
 assert.equal(costTiers(c).length,2)
 assert.equal(currentTierSale(c,0),'30')
 assert.equal(currentTierSale(c,1),'0.5')
 assert.match(tierText(costTiers(c)[1]!),/por kg/)
})
test('only sale amounts are serialized; costs stay in Pricing',()=>{
 const c=original()
 const json=tierSalesPayload(c,{'0':'25','1':'0.4'})
 assert.equal(json.includes('costAmount'),false)
 assert.equal(currentTierSale(c,0,undefined,json),'25')
 assert.equal(currentTierSale(c,1,undefined,json),'0.4')
 assert.equal(tierSalesMatch(c,json),true)
 const edited={...c,pricingRulesJson:JSON.stringify([{...costTiers(c)[0],maxValue:95}])}
 assert.equal(tierSalesMatch(edited,json),false)
 assert.equal(currentTierSale(edited,0,undefined,json),'30')
 assert.notEqual(tierSignature(costTiers(c)[0]!),tierSignature(costTiers(edited)[0]!))
})
test('bulk discounts preserve per-unit precision',()=>{
 assert.equal(discounted(100,10),'90')
 assert.equal(discounted(0.5,10),'0.45')
 assert.equal(discounted(0,10),'0')
})
test('the route builder uses true tier sales rather than a flat zero',()=>{
 const content=readFileSync('src/modules/crm/components/CrmPreferentialRouteBuilder.vue','utf8')
 assert.ok(content.includes("rateType: isTiered(cost) ? 'TIERED_SALE' : 'FIXED_AMOUNT'"))
 assert.ok(content.includes('tierSalesJson: isTiered(cost) ?'))
 assert.ok(content.includes('tierSalesPayload(cost,'))
 assert.ok(content.includes('sourceCostId: cost.id'))
})
